import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";

test("a complete daily review resumes, hides answers, and respects the new-item limit", async ({
  page,
}, info) => {
  await page.goto("/?view=review");
  await expect(
    page.getByRole("heading", { name: "Daily review", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".review-stats")).toContainText(
    "New available today5",
  );
  await page.getByRole("button", { name: "Start review" }).click();
  await expect(
    page.getByRole("heading", { name: "A cache is not the source of truth." }),
  ).toBeVisible();
  await expect(page.locator("body")).not.toContainText("stale-fill race");
  await expect(
    page.getByRole("button", { name: "Good", exact: true }),
  ).toHaveCount(0);
  await page.screenshot({
    path: info.outputPath("recall-question.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Reveal answer" }).click();
  await expect(
    page.getByRole("heading", { name: "Check your reasoning" }),
  ).toBeFocused();
  await expect(page.locator("body")).toContainText("stale-fill race");
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: info.outputPath("recall-answer.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Easy", exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Easy", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Next question" }).click();
  await expect(
    page.getByRole("heading", { name: "Find the first true position." }),
  ).toBeFocused();
  await expect(page.locator("body")).not.toContainText(
    "Everything before lo is false",
  );
  for (let i = 1; i < 5; i++) {
    await page.getByRole("button", { name: "Reveal answer" }).click();
    await page.getByRole("button", { name: "Easy", exact: true }).click();
    await page
      .getByRole("button", {
        name: i === 4 ? "Finish review" : "Next question",
      })
      .click();
  }
  await expect(
    page.getByRole("heading", { name: "You’re caught up for now." }),
  ).toBeVisible();
  await expect(page.locator(".review-stats")).toContainText("Reviews today5");
  await expect(page.getByRole("button", { name: "Start review" })).toHaveCount(
    0,
  );
  await page.reload();
  await expect(page.locator(".review-stats")).toContainText("Reviews today5");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("private drafts survive reload, editing keeps IDs, and backups restore the workspace", async ({
  page,
}, info) => {
  await page.goto("/?view=cards");
  await page.getByLabel("Title", { exact: true }).fill("Prove the invariant");
  await page
    .getByLabel("Question", { exact: true })
    .fill("Why can we discard the left half?");
  await page.reload();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue(
    "Prove the invariant",
  );
  await page
    .getByLabel("Reference answer")
    .fill(
      "The monotone predicate excludes every earlier candidate. <script>text only</script>",
    );
  await page.getByRole("button", { name: "Save private card" }).click();
  await expect(page.locator(".private-library")).toContainText(
    "Prove the invariant",
  );
  await page.getByRole("button", { name: "Edit Prove the invariant" }).click();
  await page.getByLabel("Title", { exact: true }).fill("Explain the boundary");
  await page.getByRole("button", { name: "Save private card" }).click();
  await expect(page.locator(".private-library li")).toHaveCount(1);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: info.outputPath("private-cards.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Backup", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Your practice, in a file" });
  const downloadEvent = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Download backup" }).click();
  const download = await downloadEvent;
  const payload = JSON.parse(await readFile((await download.path())!, "utf8"));
  expect(payload.study.privateCards).toHaveLength(1);
  payload.study.privateCards[0].title = "Restored card";
  await dialog
    .getByLabel("Restore a backup")
    .setInputFiles({
      name: "backup.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(payload)),
    });
  await dialog.getByRole("button", { name: "Restore this backup" }).click();
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.locator(".private-library")).toContainText("Restored card");
  await page.getByRole("button", { name: "Backup", exact: true }).click();
  await dialog.getByRole("button", { name: "Undo last restore" }).click();
  await dialog
    .getByLabel("Restore a backup")
    .setInputFiles({
      name: "broken.json",
      mimeType: "application/json",
      buffer: Buffer.from('{"version":999}'),
    });
  await expect(dialog).toContainText("Nothing was changed.");
  await expect(
    dialog.getByRole("button", { name: "Restore this backup" }),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Backup", exact: true }),
  ).toBeFocused();
  await expect(page.locator(".private-library")).toContainText(
    "Explain the boundary",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("rated scenarios enter daily review without scheduling or exposing their children", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Reveal answer" }).click();
  await page.getByRole("button", { name: "Again", exact: true }).click();
  await page.getByRole("link", { name: "Daily review", exact: true }).click();
  await page.evaluate(() => {
    const key = "interview-practice:study:v1:guest";
    const draft = JSON.parse(localStorage.getItem(key)!);
    draft.study.schedules["delivery-small-start"].dueAt = new Date(
      Date.now() - 60000,
    ).toISOString();
    localStorage.setItem(key, JSON.stringify(draft));
  });
  await page.reload();
  await page.getByRole("button", { name: "Start review" }).click();
  await expect(
    page.getByRole("heading", { name: "Start with ten customers." }),
  ).toBeVisible();
  await expect(page.locator("[data-component]")).toHaveCount(2);
  await expect(page.locator("body")).not.toContainText(
    "The lunch rush arrives.",
  );
  await expect(page.locator("body")).not.toContainText("Amazon EC2");
  await page.getByRole("button", { name: "Reveal answer" }).click();
  await expect(page.locator("[data-component]")).toHaveCount(4);
  await page.getByRole("button", { name: "Good", exact: true }).click();
  await page.reload();
  const schedules = await page.evaluate(() =>
    Object.keys(
      JSON.parse(localStorage.getItem("interview-practice:study:v1:guest")!)
        .study.schedules,
    ),
  );
  expect(schedules).toEqual(["delivery-small-start"]);
});
