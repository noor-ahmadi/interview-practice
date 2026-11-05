import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("questions and solutions appear only when revealed, including after reload", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Start with ten customers." }),
  ).toBeVisible();
  await expect(page.locator(".diagram-pane [data-component]")).toHaveCount(2);
  for (const text of [
    "Amazon EC2",
    "Amazon S3",
    "The lunch rush arrives.",
    "The menu needs photos.",
    "One tap. Two orders.",
  ])
    await expect(page.locator("body")).not.toContainText(text);
  await page.locator(".notes summary").click();
  await page
    .getByLabel("Your answer notes")
    .fill("One application and a durable database.");
  await page.reload();
  await expect(page.getByLabel("Your answer notes")).toHaveValue(
    "One application and a durable database.",
  );
  await expect(page.locator(".diagram-pane [data-component]")).toHaveCount(2);
  await page.screenshot({
    path: testInfo.outputPath("question.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Reveal answer" }).click();
  await expect(page.locator(".diagram-pane [data-component]")).toHaveCount(4);
  await expect(page.locator(".diagram-pane")).toContainText("Amazon EC2");
  await expect(
    page.getByRole("button", { name: "Continue", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText(
    "The menu needs photos.",
  );
  await expect(page.locator("body")).not.toContainText("Amazon S3");
  await page.screenshot({
    path: testInfo.outputPath("answer.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Good", exact: true }).click();
  await page.evaluate(() => {
    Math.random = () => 0.5;
  });
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "The menu needs photos." }),
  ).toBeVisible();
  await expect(page.locator(".diagram-pane")).not.toContainText("Amazon S3");
  await expect(page.locator(".diagram-pane [data-component]")).toHaveCount(4);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "The menu needs photos." }),
  ).toBeVisible();
  await expect(page.locator(".diagram-pane [data-component]")).toHaveCount(4);
  await page.getByRole("button", { name: "Reveal answer" }).click();
  await expect(page.locator(".diagram-pane [data-component]")).toHaveCount(5);
  await expect(page.locator(".diagram-pane")).toContainText("Amazon S3");
  await page.screenshot({
    path: testInfo.outputPath("followup-answer.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Hard", exact: true }).click();
  await page.getByRole("button", { name: "Finish session" }).click();
  await expect(
    page.getByRole("heading", { name: "Session complete." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Practice another path" }).click();
  await expect(page.locator("body")).not.toContainText("Amazon S3");
  await page.getByRole("button", { name: "Reveal answer" }).click();
  await page.getByRole("button", { name: "Good", exact: true }).click();
  await page.evaluate(() => {
    Math.random = () => 0;
  });
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "The lunch rush arrives." }),
  ).toBeVisible();
  await expect(page.locator("body")).not.toContainText("AWS ALB");
  await page.getByRole("button", { name: "Reveal answer" }).click();
  await expect(page.locator(".diagram-pane")).toContainText("AWS ALB");
  expect(errors).toEqual([]);
});

test("diagram controls, keyboard focus, and layouts remain accessible", async ({
  page,
  browserName,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Food delivery", exact: true }),
  ).toBeVisible();
  // The Windows WebKit port tabs to form controls by default, skipping links.
  // Check skip-link activation explicitly there; Chromium also checks Tab entry.
  if (browserName === "webkit")
    await page.getByRole("link", { name: "Skip to the question" }).focus();
  else await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to the question" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Start with ten customers." }),
  ).toBeFocused();
  await page
    .getByRole("button", { name: "Expand architecture diagram" })
    .click();
  await expect(
    page.getByRole("dialog", { name: "The system so far" }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).not.toContainText("Amazon EC2");
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect(page.getByText("125%", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Expand architecture diagram" }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Reveal answer" }).click();
  await expect(
    page.getByRole("heading", { name: "Reference architecture", exact: true }),
  ).toBeFocused();
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
  for (const button of await page.getByRole("button").all()) {
    if (!(await button.isVisible())) continue;
    const box = (await button.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
});

test("blocked browser storage is reported without breaking study", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Storage unavailable", "QuotaExceededError");
    };
  });
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText(
    "Browser storage is unavailable",
  );
  await page.getByRole("button", { name: "Reveal answer" }).click();
  await expect(page.locator(".diagram-pane")).toContainText("Amazon EC2");
});
