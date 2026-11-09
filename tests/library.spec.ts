import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("the library drills a filtered card and tracks coding practice across reloads", async ({
  page,
}, info) => {
  await page.goto("/?view=library");
  await expect(
    page.getByRole("heading", { name: "Prep library" }),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath("study-plan.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Recall cards", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Recall topic", exact: true })
    .selectOption("Graphs and connectivity");
  await page.getByRole("searchbox", { name: "Search cards" }).fill("wall");
  await expect(
    page.getByRole("status").filter({ hasText: /^1 card$/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Drill these cards" }).click();
  await expect(
    page.getByRole("heading", { name: /A grid path may break/ }),
  ).toBeFocused();
  await expect(page.locator("body")).not.toContainText(
    "Reaching the same cell with different remaining wall breaks",
  );
  await page.locator(".notes summary").click();
  await page
    .getByLabel("Your drill notes")
    .fill("Include remaining breaks in the visited key.");
  await page.getByRole("button", { name: "Reveal answer" }).click();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Check your reasoning" }),
  ).toBeVisible();
  await page.locator(".notes summary").click();
  await expect(page.getByLabel("Your drill notes")).toHaveValue(
    "Include remaining breaks in the visited key.",
  );
  await page.getByRole("button", { name: "Back to topics" }).click();
  await page.getByRole("button", { name: "Resume drill" }).click();
  await page.getByRole("button", { name: "Finish drill" }).click();
  await expect(page.getByText(/Drill complete/)).toBeVisible();
  await page
    .getByRole("button", { name: "Coding practice", exact: true })
    .click();
  await page
    .getByRole("searchbox", { name: "Search problems" })
    .fill("Two Sum");
  const problem = page.getByRole("link", { name: /Two Sum on LeetCode/ });
  await expect(problem).toHaveAttribute(
    "href",
    "https://leetcode.com/problems/two-sum/",
  );
  const practiced = page.getByRole("checkbox", {
    name: "Practiced Two Sum",
    exact: true,
  });
  await practiced.check();
  await expect(page.getByText(/1 of 42 practiced/)).toBeVisible();
  await page.getByRole("checkbox", { name: "Hide practiced" }).check();
  await expect(problem).toHaveCount(0);
  await page.reload();
  await page
    .getByRole("button", { name: "Coding practice", exact: true })
    .click();
  await expect(practiced).toBeChecked();
  await expect(page.getByText(/1 of 42 practiced/)).toBeVisible();
  await page.screenshot({
    path: info.outputPath("coding-checklist.png"),
    fullPage: true,
  });
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const saved = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("interview-practice:study:v1:guest")!)
        .study,
  );
  expect(saved.reviews).toHaveLength(0);
  expect(saved.codingDone).toEqual([1]);
});

test("the library opens a new design family and preserves timers and review settings", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-11-08T16:00:00Z") });
  await page.addInitScript(() => {
    Math.random = () => 0;
  });
  await page.goto("/?view=library");
  await page.getByRole("button", { name: /File sync/ }).click();
  await expect(
    page.getByRole("heading", { name: "Design a shared project folder" }),
  ).toBeVisible();
  await expect(page.locator("body")).not.toContainText("Resume large uploads");
  await expect(page.locator(".diagram-pane [data-component]")).toHaveCount(2);
  await page.getByRole("button", { name: "20 min timer" }).click();
  const timer = page.getByRole("timer", { name: "Scenario time remaining" });
  await expect(timer).toHaveText(/^(20:00|19:59)$/);
  await page.clock.fastForward(70_000);
  await page.reload();
  await expect(timer).toHaveText(/^18:[45]\d$/);
  await page.getByRole("link", { name: "Daily review", exact: true }).click();
  await page.getByText("Review settings", { exact: true }).click();
  await page.getByLabel("New cards per day").selectOption("0");
  await expect(page.getByRole("button", { name: "Start review" })).toHaveCount(
    0,
  );
  await page.reload();
  await page.getByText("Review settings", { exact: true }).click();
  await expect(page.getByLabel("New cards per day")).toHaveValue("0");
  await page.getByRole("link", { name: "Scenarios", exact: true }).click();
  await expect(timer).toBeVisible();
  await page.clock.fastForward(20 * 60 * 1000);
  await expect(timer).toHaveText("Time’s up");
  await expect(
    page.getByRole("button", { name: "Reveal answer", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "End timer" }).click();
  await expect(timer).toHaveCount(0);
  await page.getByRole("button", { name: "More options" }).click();
  await page.getByRole("link", { name: "Private cards", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Private cards", exact: true }),
  ).toBeFocused();
});
