import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { newStudy } from "../src/study.ts";
import type { Study } from "../src/study.ts";

const userId = "00000000-0000-4000-8000-000000000001";
const accountKey = `interview-practice:study:v1:${userId}`;
const user = {
  id: userId,
  aud: "authenticated",
  role: "authenticated",
  email: "learner@example.test",
  app_metadata: { provider: "google", providers: ["google"] },
  user_metadata: {},
  identities: [],
  created_at: "2026-01-01T00:00:00Z",
};
const token = `${Buffer.from('{"alg":"HS256","typ":"JWT"}').toString("base64url")}.${Buffer.from(JSON.stringify({ sub: userId, role: "authenticated", exp: 5000000000 })).toString("base64url")}.fixture-signature`;

async function accountFixture(page: Page) {
  const server = {
    version: 1,
    study: newStudy(),
    writes: 0,
    loseResponse: false,
  };
  const receipts = new Map<string, number>();
  await page.context().addInitScript(
    ({ user, token }) => {
      if (!localStorage.getItem("fixture-seeded")) {
        localStorage.setItem("fixture-seeded", "true");
        localStorage.setItem(
          "sb-practice-test-auth-token",
          JSON.stringify({
            access_token: token,
            refresh_token: "fixture-refresh",
            token_type: "bearer",
            expires_in: 3600,
            expires_at: 5000000000,
            user,
          }),
        );
      }
    },
    { user, token },
  );
  await page.route("https://practice-test.supabase.co/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const headers = {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "*",
    };
    if (request.method() === "OPTIONS")
      return route.fulfill({ status: 204, headers });
    if (path === "/auth/v1/logout")
      return route.fulfill({ status: 204, headers });
    if (path === "/auth/v1/user") return route.fulfill({ json: user, headers });
    if (path === "/rest/v1/study_state")
      return route.fulfill({
        json: [{ version: server.version, payload: server.study }],
        headers,
      });
    if (path === "/rest/v1/rpc/commit_study") {
      const write = request.postDataJSON();
      const previous = receipts.get(write.p_request_id);
      if (previous)
        return route.fulfill({
          json: { status: "duplicate", version: previous },
          headers,
        });
      if (write.p_expected_version !== server.version)
        return route.fulfill({
          json: {
            status: "conflict",
            version: server.version,
            payload: server.study,
          },
          headers,
        });
      server.study = write.p_payload;
      server.version++;
      server.writes++;
      receipts.set(write.p_request_id, server.version);
      if (server.loseResponse) {
        server.loseResponse = false;
        return route.abort("failed");
      }
      return route.fulfill({
        json: { status: "saved", version: server.version },
        headers,
      });
    }
    throw new Error(`Unexpected fixture request: ${request.method()} ${path}`);
  });
  return server;
}

test("an existing account loads its own work and sign-out returns to a separate guest workspace", async ({
  page,
}) => {
  const server = await accountFixture(page);
  server.study.practice.session.notes["delivery-small-start"] =
    "Account-only reasoning";
  await page.goto("/");
  await expect(page.getByLabel("Your answer notes")).toHaveValue(
    "Account-only reasoning",
  );
  await page.getByRole("button", { name: "Account", exact: true }).click();
  const account = page.getByRole("dialog", { name: "Your account" });
  await expect(account).toContainText("learner@example.test");
  server.version++;
  server.study.practice.session.notes["delivery-small-start"] =
    "Updated on another device";
  await account.getByRole("button", { name: "Sync now", exact: true }).click();
  await expect(page.getByLabel("Your answer notes")).toHaveValue(
    "Updated on another device",
  );
  await account
    .getByRole("button", { name: "Sign out of this device" })
    .click();
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Your answer notes")).toHaveValue("");
  await expect(page.locator("body")).not.toContainText(
    "Account-only reasoning",
  );
  expect(
    await page.evaluate(
      (key) =>
        JSON.parse(localStorage.getItem(key)!).study.practice.session.notes[
          "delivery-small-start"
        ],
      accountKey,
    ),
  ).toBe("Updated on another device");
});

test("a stale device keeps its draft and offers an explicit conflict decision", async ({
  page,
}) => {
  const server = await accountFixture(page);
  await page.goto("/");
  await page.locator(".notes summary").click();
  await page.getByLabel("Your answer notes").fill("This device’s new answer");
  server.version = 2;
  server.study.practice.session.notes["delivery-small-start"] =
    "The other device’s answer";
  await expect(
    page.getByRole("heading", {
      name: "Another device saved different changes.",
    }),
  ).toBeVisible();
  await expect(page.getByLabel("Your answer notes")).toHaveValue(
    "This device’s new answer",
  );
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "Another device saved different changes.",
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Use account copy", exact: true })
    .click();
  await expect(page.getByLabel("Your answer notes")).toHaveValue(
    "The other device’s answer",
  );
  expect(server.writes).toBe(0);
});

test("a lost response and reload do not double-count the review or lose the reveal phase", async ({
  page,
}) => {
  const server = await accountFixture(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Reveal answer" }).click();
  server.loseResponse = true;
  await page.getByRole("button", { name: "Good", exact: true }).click();
  await expect.poll(() => server.writes).toBe(1);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Continue", exact: true }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key) ?? "null")?.baseVersion,
        accountKey,
      ),
    )
    .toBe(2);
  expect(server.study.reviews).toHaveLength(1);
  expect(server.study.schedules["delivery-small-start"]!.reps).toBe(1);
  expect(server.writes).toBe(1);
  const restored = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!).study as Study,
    accountKey,
  );
  expect(restored.practice.session.phase).toBe("rated");
  expect(restored.reviews).toHaveLength(1);
});
