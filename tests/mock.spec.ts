import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const axe = async (page: import("@playwright/test").Page) =>
  (
    await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze()
  ).violations;

test("a timed mock hides the reference until the debrief and resumes after reload", async ({
  page,
}) => {
  await page.goto("/?view=library");
  await page.getByRole("link", { name: /Start mock/ }).click();
  await expect(page).toHaveURL(/view=mock/);
  await expect(page.getByRole("heading", { name: "Mock interview" })).toBeVisible();
  await page.getByRole("button", { name: /Start the mock/ }).click();
  await expect(page.getByRole("heading", { name: "The brief" })).toBeFocused();
  await expect(page.getByRole("timer", { name: "Mock time remaining" })).toBeVisible();

  // Nothing from the change or the reference is in the page before it is revealed.
  for (const hidden of ["lunch promotion", "A strong answer covers", "Often missed"])
    await expect(page.locator("body")).not.toContainText(hidden);
  await expect(page.locator("body")).not.toContainText("50,000 orders");

  await page.getByRole("button", { name: "How many orders, and when?" }).click();
  await expect(page.getByText(/About 50,000 orders on a normal day/)).toBeVisible();
  await page
    .getByLabel("Requirements and assumptions")
    .fill("Browse, order, pay, and track. Never charge twice.");
  await page.getByLabel("Request flow").fill("Commit the order, then call the provider.");
  expect(await axe(page)).toEqual([]);

  await page.reload();
  await expect(page.getByLabel("Requirements and assumptions")).toHaveValue(
    "Browse, order, pay, and track. Never charge twice.",
  );
  await expect(page.getByText(/About 50,000 orders on a normal day/)).toBeVisible();
  await expect(page.getByRole("timer", { name: "Mock time remaining" })).toBeVisible();

  await page.getByRole("button", { name: /Reveal the follow-up/ }).click();
  await expect(page.getByRole("heading", { name: "A lunch promotion" })).toBeFocused();
  await expect(page.locator("body")).not.toContainText("A strong answer covers");
  await page
    .getByLabel(/Which parts of your design change/)
    .fill("Reserve a kitchen slot before charging.");
  await page.getByRole("button", { name: /Finish and open the debrief/ }).click();

  await expect(page.getByRole("heading", { name: "Debrief" })).toBeFocused();
  await expect(page.getByRole("timer")).toHaveCount(0);
  const requirements = page.locator("section", {
    has: page.getByRole("heading", { name: "Requirements and assumptions", level: 3 }),
  });
  await expect(requirements).toContainText("Never charge twice.");
  await expect(requirements).toContainText("Questions you didn’t ask");
  await expect(requirements).not.toContainText("How many orders, and when?");
  await expect(
    page.locator("section", {
      has: page.getByRole("heading", { name: "Trade-offs", level: 3 }),
    }),
  ).toContainText("Reserve a kitchen slot before charging.");
  expect(await axe(page)).toEqual([]);

  await page
    .getByRole("group", { name: "How well did your answer cover this?" })
    .first()
    .getByRole("radio", { name: "Covered" })
    .check();
  await page.getByLabel("One thing to practise next").fill("State when the order is acknowledged.");
  await page.reload();
  await expect(
    page
      .getByRole("group", { name: "How well did your answer cover this?" })
      .first()
      .getByRole("radio", { name: "Covered" }),
  ).toBeChecked();
  await page.getByRole("button", { name: /Save to history/ }).click();

  await expect(page.getByRole("heading", { name: "Mock interview" })).toBeFocused();
  await expect(page.getByText("Attempt saved to your history.")).toBeVisible();
  await page.reload();
  const past = page.locator(".mock-past");
  await expect(past).toHaveCount(1);
  await expect(past.locator("summary")).toContainText("1 covered");
  await past.locator("summary").click();
  await expect(past).toContainText("State when the order is acknowledged.");
  await expect(past).toContainText("Reserve a kitchen slot before charging.");
  await page.goto("/?view=library");
  await expect(page.getByRole("link", { name: /Start mock/ })).toBeVisible();
});

test("a mock can be discarded after confirmation", async ({ page }) => {
  await page.goto("/?view=mock");
  await page.getByRole("checkbox", { name: /40-minute timer/ }).uncheck();
  await page.getByRole("button", { name: /Start the mock/ }).click();
  await expect(page.getByRole("timer")).toHaveCount(0);
  await page.getByLabel("Estimates").fill("3 orders per second at peak");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "Discard this attempt" }).click();
  await expect(page.getByLabel("Estimates")).toHaveValue("3 orders per second at peak");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Discard this attempt" }).click();
  await expect(page.getByRole("button", { name: /Start the mock/ })).toBeVisible();
  await expect(page.locator(".mock-past")).toHaveCount(0);
});
