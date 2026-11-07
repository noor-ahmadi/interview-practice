import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { scenarioQuestions as questions } from "../src/scenario-content.ts";

async function continueWith(page: Page, draw = 0) {
  await page.getByRole("button", { name: "Good", exact: true }).click();
  await page.evaluate((value) => {
    Math.random = () => value;
  }, draw);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
}

for (const [family, paths] of [
  [
    "chat",
    [
      ["chat-small-start", "chat-live", "chat-reconnect", "chat-gap"],
      [
        "chat-team-start",
        "chat-fanout",
        "chat-pubsub-loss",
        "chat-retention-gap",
      ],
    ],
  ],
  [
    "shortener",
    [
      ["short-small-start", "short-collisions", "short-custom-alias"],
      [
        "short-campaign-start",
        "short-async-events",
        "short-duplicate-clicks",
        "short-replay-window",
      ],
    ],
  ],
] as const) {
  test(`${family} sessions complete both starts with hidden branches and mobile controls`, async ({
    page,
  }, info) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await page.evaluate(() => {
      Math.random = () => 0;
    });
    await page.getByLabel("Scenario family").selectOption(family);
    for (const [index, path] of paths.entries()) {
      if (index)
        await page
          .getByRole("button", { name: "Practice another path" })
          .click();
      for (const id of path) {
        const question = questions[id]!;
        await expect(
          page.getByRole("heading", { name: question.title, exact: true }),
        ).toBeVisible();
        const accessible = await page.locator("body").ariaSnapshot();
        for (const child of question.children) {
          expect(accessible).not.toContain(questions[child]!.title);
          await expect(page.locator("body")).not.toContainText(
            questions[child]!.title,
          );
        }
        await page.getByRole("button", { name: "Reveal answer" }).click();
        if (id === path.at(-1)) {
          await page.screenshot({
            path: info.outputPath(`${family}-${index}-answer.png`),
            fullPage: true,
          });
          expect(
            (
              await new AxeBuilder({ page })
                .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
                .analyze()
            ).violations,
          ).toEqual([]);
          await page.getByRole("button", { name: "Good", exact: true }).click();
          await page.getByRole("button", { name: "Finish session" }).click();
        } else await continueWith(page);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
      }
      await expect(
        page.getByRole("heading", { name: "Session complete." }),
      ).toBeVisible();
    }
    await page.reload();
    await page
      .getByRole("button", { name: "History (2)", exact: true })
      .click();
    const history = page.getByRole("dialog", { name: "Past sessions" });
    for (const path of paths)
      for (const id of path)
        await expect(history).toContainText(questions[id]!.title);
    await expect(history).not.toContainText(
      family === "chat"
        ? questions["chat-presence"]!.title
        : questions["short-queue-backlog"]!.title,
    );
    const leaf = questions[paths[1].at(-1)!]!;
    const saved = history.locator(".past-question").filter({
      has: page.getByRole("heading", { name: leaf.title, exact: true }),
    });
    await saved.getByText("Review reference answer", { exact: true }).click();
    await saved.getByRole("button", { name: "View reference diagram" }).click();
    const diagram = page.getByRole("dialog", {
      name: "Saved reference architecture",
    });
    const ids = await diagram
      .locator("[data-component]")
      .evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute("data-component")).sort(),
      );
    expect(ids).toEqual(
      leaf.answerFrame.components.map((component) => component.id).sort(),
    );
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    for (const control of await diagram.getByRole("button").all()) {
      expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    expect(
      await diagram.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath(`${family}-saved-diagram.png`),
      fullPage: true,
    });
    await page.keyboard.press("Escape");
    await expect(
      saved.getByRole("button", { name: "View reference diagram" }),
    ).toBeFocused();
    await expect(page.locator(".diagram-dialog [data-component]")).toHaveCount(
      0,
    );
  });
}

test("family switching and backups preserve three unfinished sessions without exposing their paths", async ({
  page,
}, info) => {
  await page.goto("/");
  await page.locator(".notes summary").click();
  await page
    .getByLabel("Your answer notes")
    .fill("My original food-delivery baseline.");
  await page.getByRole("button", { name: "Reveal answer" }).click();
  await page.evaluate(() => {
    Math.random = () => 0;
  });
  await page.getByLabel("Scenario family").selectOption("chat");
  await page.getByRole("button", { name: "Reveal answer" }).click();
  await continueWith(page);
  await expect(
    page.getByRole("heading", { name: "Messages should appear immediately." }),
  ).toBeVisible();
  await page.locator(".notes summary").click();
  await page
    .getByLabel("Your answer notes")
    .fill("Keep PostgreSQL as the durable log.");
  await page.getByRole("button", { name: "Reveal answer" }).click();
  await page.getByRole("button", { name: "Hard", exact: true }).click();
  await page.getByLabel("Scenario family").selectOption("shortener");
  await expect(
    page.getByRole("heading", { name: "A small service makes shorter links." }),
  ).toBeVisible();
  await expect(page.locator("body")).not.toContainText(
    "Messages should appear immediately.",
  );
  await expect(page.locator("body")).not.toContainText(
    "My original food-delivery baseline.",
  );
  await expect(page.locator(".diagram-pane [data-component]")).toHaveCount(2);
  await page.reload();
  await expect(page.getByLabel("Scenario family")).toHaveValue("shortener");
  await page.getByLabel("Scenario family").selectOption("delivery");
  await expect(page.getByLabel("Your answer notes")).toHaveValue(
    "My original food-delivery baseline.",
  );
  await expect(
    page.getByRole("button", { name: "Good", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Scenario family").selectOption("chat");
  await expect(page.getByLabel("Your answer notes")).toHaveValue(
    "Keep PostgreSQL as the durable log.",
  );
  await expect(
    page.getByRole("button", { name: "Continue", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Hard", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Good", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Good", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "More options" }).click();
  await page.getByRole("button", { name: "Backup", exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download backup" }).click();
  const file = await download;
  const raw = await readFile((await file.path())!, "utf8");
  const saved = JSON.parse(raw).study;
  expect(saved.practice.version).toBe(4);
  expect(saved.practice.paused).toHaveLength(2);
  expect(saved.practice.session.path.at(-1)).toBe("chat-live");
  expect(saved.practice.session.phase).toBe("rated");
  expect(
    saved.reviews.filter((r: { itemId: string }) => r.itemId === "chat-live"),
  ).toMatchObject([{ grade: "Good" }]);
  expect(Object.keys(saved.schedules).sort()).toEqual(
    ["chat-small-start", "chat-live"].sort(),
  );
  await page.getByLabel("Restore a backup").setInputFiles({
    name: "three-sessions.json",
    mimeType: "application/json",
    buffer: Buffer.from(raw),
  });
  await page.getByRole("button", { name: "Restore this backup" }).click();
  await page.keyboard.press("Escape");
  await page.getByLabel("Scenario family").selectOption("shortener");
  await expect(page.locator(".diagram-pane [data-component]")).toHaveCount(2);
  await page.getByLabel("Scenario family").selectOption("chat");
  await expect(
    page.getByRole("button", { name: "Continue", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath("resumed-chat.png"),
    fullPage: true,
  });
});
