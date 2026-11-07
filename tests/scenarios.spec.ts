import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { newStudy } from "../src/study.ts";
import {
  scenarioQuestions as questions,
  scenarioVariants,
  scenarioFamilies,
} from "../src/scenario-content.ts";
import type { Session } from "../src/session.ts";

async function next(page: Page, draw = 0) {
  await page.getByRole("button", { name: "Good", exact: true }).click();
  await page.evaluate((value) => {
    Math.random = () => value;
  }, draw);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
}

async function diagram(page: Page) {
  return page
    .locator(".diagram-pane .architecture")
    .evaluate((el) => el.outerHTML);
}

function serviceIcon(page: Page, service: string) {
  const path = `/aws/${service}.svg`;
  return page.locator(
    `.diagram-pane :is(image[href="${path}"], img[src="${path}"])`,
  );
}

test("longer sessions hide future branches, preserve reveals, and alternate starting conditions", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: questions["delivery-small-start"]!.title,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reveal answer" }).click();
  await next(page);
  await expect(
    page.getByRole("heading", {
      name: questions["delivery-lunch-rush"]!.title,
    }),
  ).toBeVisible();
  for (const id of [
    "delivery-menu-cache",
    "delivery-receipt-queue",
    "delivery-preorder-start",
  ]) {
    await expect(page.locator("body")).not.toContainText(questions[id]!.title);
    expect(await page.locator("body").ariaSnapshot()).not.toContain(
      questions[id]!.title,
    );
  }
  await expect(serviceIcon(page, "alb")).toHaveCount(0);
  await page.getByRole("button", { name: "Reveal answer" }).click();
  await expect(serviceIcon(page, "alb")).toHaveCount(1);
  await next(page, 0.99);
  await expect(
    page.getByRole("heading", {
      name: questions["delivery-receipt-queue"]!.title,
    }),
  ).toBeVisible();
  await expect(serviceIcon(page, "sqs")).toHaveCount(0);
  const before = await diagram(page);
  await page.locator(".notes summary").click();
  await page
    .getByLabel("Your answer notes")
    .fill("Commit the order and its event together.");
  expect(await diagram(page)).toBe(before);
  await page.reload();
  await expect(page.getByLabel("Your answer notes")).toHaveValue(
    "Commit the order and its event together.",
  );
  await expect(serviceIcon(page, "sqs")).toHaveCount(0);
  await page.screenshot({
    path: testInfo.outputPath("receipt-question.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Reveal answer" }).click();
  await expect(serviceIcon(page, "sqs")).toHaveCount(1);
  await expect(
    page.locator(".diagram-pane [data-component='worker']"),
  ).toHaveCount(1);
  await page.screenshot({
    path: testInfo.outputPath("receipt-answer.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Expand architecture diagram" })
    .click();
  const expanded = page.getByRole("dialog", { name: "Reference architecture" });
  await expect(expanded.locator("[data-component]")).toHaveCount(8);
  await expect(expanded.locator(".component-list li")).toHaveCount(8);
  await expect(expanded).not.toContainText("Amazon CloudFront");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Hard", exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Finish session" }),
  ).toBeVisible();
  await expect(serviceIcon(page, "sqs")).toHaveCount(1);
  await page.getByRole("button", { name: "Finish session" }).click();
  await page.getByRole("button", { name: "Practice another path" }).click();
  await expect(
    page.getByRole("heading", {
      name: questions["delivery-preorder-start"]!.title,
    }),
  ).toBeVisible();
  await expect(page.locator("body")).not.toContainText(
    "Receipts are slowing checkout.",
  );
  for (const id of [
    "delivery-preorder-start",
    "delivery-inventory-race",
    "delivery-hold-expiry",
    "delivery-expiry-retry",
  ]) {
    await expect(
      page.getByRole("heading", { name: questions[id]!.title }),
    ).toBeVisible();
    for (const child of questions[id]!.children) {
      await expect(page.locator("body")).not.toContainText(
        questions[child]!.title,
      );
      expect(await page.locator("body").ariaSnapshot()).not.toContain(
        questions[child]!.title,
      );
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.getByRole("button", { name: "Reveal answer" }).click();
    if (id === "delivery-expiry-retry") break;
    await next(page);
  }
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  for (const button of await page.getByRole("button").all()) {
    if (await button.isVisible())
      expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  await page.screenshot({
    path: testInfo.outputPath("hold-answer.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Good", exact: true }).click();
  await page.getByRole("button", { name: "Finish session" }).click();
  await expect(
    page.getByRole("heading", { name: "Session complete." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "History (2)", exact: true }).click();
  const history = page.getByRole("dialog", { name: "Past sessions" });
  await expect(history).toContainText(
    "Commit the order and its event together.",
  );
  await expect(history).not.toContainText(
    questions["delivery-expiry-backlog"]!.title,
  );
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Practice another path" }).click();
  await page.getByRole("button", { name: "Reveal answer" }).click();
  await next(page);
  // The last neighborhood path took lunch rush; an alternative is guaranteed here.
  await expect(
    page.getByRole("heading", {
      name: questions["delivery-lunch-rush"]!.title,
    }),
  ).toHaveCount(0);
  const saved = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("interview-practice:study:v1:guest")!)
        .study,
  );
  expect(Object.keys(saved.schedules).sort()).toEqual(
    [
      "delivery-small-start",
      "delivery-lunch-rush",
      "delivery-receipt-queue",
      "delivery-preorder-start",
      "delivery-inventory-race",
      "delivery-hold-expiry",
      "delivery-expiry-retry",
    ].sort(),
  );
  expect(errors).toEqual([]);
});

// Seed a valid revealed path to inspect distinct leaf designs without repeating setup.
function pathTo(id: string): string[] {
  function visit(current: string, path: string[]): string[] | null {
    if (current === id) return [...path, current];
    for (const child of questions[current]!.children) {
      const found = visit(child, [...path, current]);
      if (found) return found;
    }
    return null;
  }
  return scenarioVariants.flatMap((v) => visit(v.root, []) ?? []);
}

for (const family of scenarioFamilies)
  test(`${family.name} diagram frames fit readable labels without collisions or page overflow`, async ({
    page,
  }) => {
    if (page.viewportSize()!.width > 1100)
      await page.setViewportSize({ width: 1920, height: 1080 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript(() => {
      const frame = localStorage.getItem("fixture-next-frame");
      if (frame)
        localStorage.setItem("interview-practice:study:v1:guest", frame);
    });
    await page.goto("/");
    for (const q of Object.values(questions).filter(
      (q) =>
        scenarioVariants.find((v) => v.root === pathTo(q.id)[0])!.family ===
        family.id,
    )) {
      const study = newStudy();
      study.practice.session.path = pathTo(q.id);
      study.practice.session.ratings = Object.fromEntries(
        study.practice.session.path.slice(0, -1).map((id) => [id, "Good"]),
      ) as Session["ratings"];
      await page.evaluate(
        (value) =>
          localStorage.setItem(
            "fixture-next-frame",
            JSON.stringify({
              study: value,
              baseVersion: 0,
              dirty: true,
              pending: null,
            }),
          ),
        study,
      );
      await page.reload();
      await expect(
        page.getByRole("heading", { name: q.title, exact: true }),
      ).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      const accessible = await page.locator("body").ariaSnapshot();
      for (const child of q.children) {
        expect(accessible).not.toContain(questions[child]!.title);
        await expect(page.locator("body")).not.toContainText(
          questions[child]!.title,
        );
      }
      for (const phase of ["question", "answer"] as const) {
        if (phase === "answer")
          await page.getByRole("button", { name: "Reveal answer" }).click();
        const frame = phase === "question" ? q.questionFrame : q.answerFrame;
        const rendered = await page
          .locator(".diagram-pane [data-component]")
          .evaluateAll((nodes) =>
            nodes.map((n) => n.getAttribute("data-component")),
          );
        expect(
          rendered.every((id) => frame.components.some((c) => c.id === id)),
        ).toBe(true);
        const flows = page.locator(".diagram-pane .component-flow");
        if (await flows.count()) {
          const connections = await flows
            .locator(".flow-connections li")
            .evaluateAll((rows) =>
              rows.map((row) => [
                row.closest("[data-component]")!.getAttribute("data-component"),
                row.querySelector("strong")!.textContent,
                row.querySelector("small")!.textContent,
              ]),
            );
          const expected = frame.connections
            .filter(
              (link) =>
                rendered.includes(link.from) && rendered.includes(link.to),
            )
            .map((link) => [
              link.from,
              frame.components.find((c) => c.id === link.to)!.name,
              link.label,
            ]);
          expect(connections.sort()).toEqual(expected.sort());
        }
        const issues = await page
          .locator(".diagram-pane .architecture")
          .evaluate((svg) => {
            const errors: string[] = [];
            for (const node of svg.querySelectorAll<HTMLElement>(
              ".flow-node",
            )) {
              if (node.scrollWidth > node.clientWidth + 1)
                errors.push(`Component overflows: ${node.dataset.component}`);
              for (const label of node.querySelectorAll("strong, small")) {
                if (parseFloat(getComputedStyle(label).fontSize) < 12)
                  errors.push(`Unreadable label: ${label.textContent}`);
              }
            }
            const nodes = [
              ...svg.querySelectorAll<SVGGElement>(".system-node"),
            ];
            for (const g of nodes)
              for (const t of g.querySelectorAll<SVGTextElement>("text")) {
                const b = t.getBBox();
                if (b.x + b.width > 208 || b.y + b.height > 86)
                  errors.push(`Text outside component: ${t.textContent}`);
                if (
                  t.classList.contains("node-name") &&
                  parseFloat(getComputedStyle(t).fontSize) *
                    t.getScreenCTM()!.a <
                    12
                )
                  errors.push(`Unreadable name: ${t.textContent}`);
              }
            const labels = [...svg.querySelectorAll(".connection-label")];
            const overlaps = (a: DOMRect, b: DOMRect) =>
              a.x < b.right - 1 &&
              a.right > b.x + 1 &&
              a.y < b.bottom - 1 &&
              a.bottom > b.y + 1;
            for (const [index, label] of labels.entries()) {
              const rect = label.getBoundingClientRect();
              if (
                nodes.some((g) =>
                  overlaps(
                    rect,
                    g.querySelector("rect")!.getBoundingClientRect(),
                  ),
                )
              )
                errors.push(`Label crosses node: ${label.textContent}`);
              if (
                labels
                  .slice(index + 1)
                  .some((other) =>
                    overlaps(rect, other.getBoundingClientRect()),
                  )
              )
                errors.push(`Overlapping label: ${label.textContent}`);
            }
            if (document.documentElement.scrollWidth > innerWidth)
              errors.push("Horizontal page overflow");
            return errors;
          });
        expect(issues, `${q.id} ${phase}`).toEqual([]);
      }
    }
  });

for (const [id, service] of [
  ["delivery-photo-cdn", "cloudfront"],
  ["delivery-photo-backlog", "sqs"],
  ["delivery-cache-outage", "elasticache"],
]) {
  test(`${id} reveals only its authored design and keeps the full architecture available`, async ({
    page,
  }, testInfo) => {
    const study = newStudy();
    const path = pathTo(id!);
    study.practice.session = {
      ...study.practice.session,
      path,
      ratings: Object.fromEntries(
        path.slice(0, -1).map((q) => [q, "Good"]),
      ) as Session["ratings"],
    };
    await page.addInitScript(
      (value) => {
        if (!localStorage.getItem("interview-practice:study:v1:guest"))
          localStorage.setItem(
            "interview-practice:study:v1:guest",
            JSON.stringify(value),
          );
      },
      { study, baseVersion: 0, dirty: true, pending: null },
    );
    await page.goto("/");
    const question = questions[id!]!;
    await expect(
      page.getByRole("heading", { name: question.title }),
    ).toBeVisible();
    const newIds = question.answerFrame.components
      .filter(
        (c) => !question.questionFrame.components.some((p) => p.id === c.id),
      )
      .map((c) => c.id);
    for (const component of newIds)
      await expect(
        page.locator(`.diagram-pane [data-component="${component}"]`),
      ).toHaveCount(0);
    const before = await diagram(page);
    await page.reload();
    expect(await diagram(page)).toBe(before);
    await page.getByRole("button", { name: "Reveal answer" }).click();
    await expect(serviceIcon(page, service!)).toHaveCount(1);
    if (id === "delivery-cache-outage")
      await expect(
        page.locator('.diagram-pane [data-component="cache"]'),
      ).toHaveClass(/unavailable/);
    await page.screenshot({
      path: testInfo.outputPath(`${id}-answer.png`),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Expand architecture diagram" })
      .click();
    const modal = page.getByRole("dialog", { name: "Reference architecture" });
    await expect(modal.locator("[data-component]")).toHaveCount(
      question.answerFrame.components.length,
    );
    await expect(modal.locator(".component-list li")).toHaveCount(
      question.answerFrame.components.length,
    );
    const descriptions = (await modal.locator(".component-flow").count())
      ? modal.locator(".component-flow")
      : modal.locator(".component-list");
    for (const c of question.answerFrame.components)
      await expect(descriptions).toContainText(c.purpose);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.keyboard.press("Escape");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.getByRole("button", { name: "Good", exact: true }).click();
    await page.getByRole("button", { name: "Finish session" }).click();
    await expect(
      page.getByRole("heading", { name: "Session complete." }),
    ).toBeVisible();
  });
}
