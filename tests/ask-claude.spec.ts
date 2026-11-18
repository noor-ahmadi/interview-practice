import { expect, test } from "@playwright/test";
import type { Page, Request } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// A fixture value only: every Anthropic request below is answered by page.route.
const fixtureKey = "sk-ant-fixture-not-a-real-key-0000";

function sse(text: string[]) {
  const events: [string, object][] = [
    [
      "message_start",
      {
        type: "message_start",
        message: {
          id: "msg_fixture",
          type: "message",
          role: "assistant",
          model: "claude-haiku-5-5",
          content: [],
          stop_reason: null,
          stop_sequence: null,
          usage: { input_tokens: 10, output_tokens: 1 },
        },
      },
    ],
    [
      "content_block_start",
      { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
    ],
    ...text.map(
      (part) =>
        [
          "content_block_delta",
          { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: part } },
        ] as [string, object],
    ),
    ["content_block_stop", { type: "content_block_stop", index: 0 }],
    [
      "message_delta",
      {
        type: "message_delta",
        delta: { stop_reason: "end_turn", stop_sequence: null },
        usage: { output_tokens: 12 },
      },
    ],
    ["message_stop", { type: "message_stop" }],
  ];
  return events.map(([event, data]) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join("");
}

async function fakeAnthropic(page: Page, replies: string[][]) {
  const requests: Request[] = [];
  await page.route("https://api.anthropic.com/v1/models/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify({
        type: "model",
        id: "claude-haiku-5-5",
        display_name: "Claude Haiku 5.5",
        created_at: "2026-01-01T00:00:00Z",
      }),
    }),
  );
  await page.route("https://api.anthropic.com/v1/messages**", (route) => {
    requests.push(route.request());
    const reply = replies.shift();
    if (!reply)
      return route.fulfill({
        status: 401,
        contentType: "application/json",
        headers: { "access-control-allow-origin": "*" },
        body: JSON.stringify({
          type: "error",
          error: { type: "authentication_error", message: "invalid x-api-key" },
        }),
      });
    return route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      headers: { "access-control-allow-origin": "*" },
      body: sse(reply),
    });
  });
  return requests;
}

test("Ask Claude uses a browser-only key and sends the revealed card as context", async ({
  page,
}) => {
  const requests = await fakeAnthropic(page, [
    ["Because a TTL bounds residence, ", "not source age."],
    ["Version the entries."],
  ]);
  await page.goto("/?view=review");
  await page.getByRole("button", { name: /Start review/ }).click();
  await expect(page.getByRole("button", { name: /Ask Claude/ })).toHaveCount(0);
  await page.locator(".notes summary").click();
  await page.getByLabel("Your review notes").fill("Read the cache, fill on a miss.");
  await page.getByRole("button", { name: /Reveal answer/ }).click();

  await page.getByRole("button", { name: "Ask Claude about this question" }).click();
  await page.getByRole("button", { name: "Add an API key" }).click();
  const dialog = page.getByRole("dialog", { name: "Ask Claude" });
  await expect(dialog).toContainText("not to a Claude.ai subscription");
  await dialog.getByLabel("Anthropic API key").fill(fixtureKey);
  await dialog.getByRole("button", { name: "Save key" }).click();
  await expect(dialog.getByText("Key saved. Ask Claude is ready.")).toBeVisible();
  await expect(dialog).toContainText("A key ending in 0000 is saved in this browser.");
  await expect(dialog.getByLabel("Anthropic API key")).toHaveValue("");
  await dialog.getByRole("button", { name: "Close" }).click();

  await page.getByRole("button", { name: "Why is the reference answer correct?" }).click();
  await expect(page.getByText("Because a TTL bounds residence, not source age.")).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze())
      .violations,
  ).toEqual([]);

  const first = requests[0]!;
  const headers = await first.allHeaders();
  expect(headers["authorization"]).toBe(`Bearer ${fixtureKey}`);
  expect(headers["anthropic-dangerous-direct-browser-access"]).toBe("true");
  const body = first.postDataJSON();
  expect(body.model).toBe("claude-haiku-5-5");
  expect(body.stream).toBe(true);
  expect(body.messages).toHaveLength(1);
  const context = body.messages[0].content as string;
  expect(context).toContain("cache-aside");
  expect(context).toContain("<reference_answer>");
  expect(context).toContain("<rubric>");
  expect(context).toContain("Read the cache, fill on a miss.");
  expect(context).toContain("Why is the reference answer correct?");

  await page.getByLabel("Ask a follow-up").fill("How do I stop stale fills?");
  await page.getByLabel("Ask a follow-up").press("Enter");
  await expect(page.getByText("Version the entries.")).toBeVisible();
  const followUp = requests[1]!.postDataJSON();
  expect(followUp.messages.map((m: { role: string }) => m.role)).toEqual([
    "user",
    "assistant",
    "user",
  ]);

  // A rejected key gives a clear message and keeps the question for a retry.
  await page.getByLabel("Ask a follow-up").fill("One more?");
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Anthropic rejected this API key");
  await expect(page.getByLabel("Ask a follow-up")).toHaveValue("One more?");

  // The key never enters the synced study data or a backup.
  const stored = await page.evaluate(() => ({
    key: localStorage.getItem("interview-practice:anthropic-key"),
    study: Object.keys(localStorage)
      .filter((name) => name.startsWith("interview-practice:study"))
      .map((name) => localStorage.getItem(name))
      .join(""),
  }));
  expect(stored.key).toBe(fixtureKey);
  expect(stored.study).not.toContain(fixtureKey);

  await page.getByRole("button", { name: "More options" }).click();
  await page.getByRole("button", { name: "Ask Claude", exact: true }).click();
  await dialog.getByRole("button", { name: "Remove key" }).click();
  await expect(dialog).toContainText("No key saved.");
  expect(
    await page.evaluate(() => localStorage.getItem("interview-practice:anthropic-key")),
  ).toBeNull();
});

test("Ask Claude checks pasted code against a coding problem's reference", async ({ page }) => {
  const requests = await fakeAnthropic(page, [["Your loop misses duplicates."]]);
  await page.goto("/?view=library");
  await page.evaluate(
    (key) => localStorage.setItem("interview-practice:anthropic-key", key),
    fixtureKey,
  );
  await page.reload();
  await page.getByRole("button", { name: "Coding practice", exact: true }).click();
  await page.getByRole("searchbox", { name: "Search problems" }).fill("Two Sum");
  const item = page.locator(".prep-problem").filter({ hasText: "Two Sum" });
  await item.getByText("Reference solution in Python").click();
  await item.getByLabel(/Your solution/).fill("def twoSum(nums, target):\n    return [0, 1]");
  await item.getByRole("button", { name: "Ask Claude about this problem" }).click();
  await item.getByRole("button", { name: "Check my solution for bugs and edge cases" }).click();
  await expect(item.getByText("Your loop misses duplicates.")).toBeVisible();
  const context = requests[0]!.postDataJSON().messages[0].content as string;
  expect(context).toContain("LeetCode 1: Two Sum");
  expect(context).toContain("<reference_solution");
  expect(context).toContain("def twoSum(self, nums: List[int], target: int)");
  expect(context).toContain("return [0, 1]");
});
