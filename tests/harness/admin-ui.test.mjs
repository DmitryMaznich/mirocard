import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFileSync, mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";
const mime = {
  html: "text/html",
  css: "text/css",
  js: "application/javascript",
};
const server = createServer((req, res) => {
  const file = req.url.slice(1);
  if (
    !["admin.html", "admin.css", "admin.js", "admin-model.js"].includes(file)
  ) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.setHeader("Content-Type", mime[file.split(".").at(-1)]);
  res.end(readFileSync(new URL("../../public/" + file, import.meta.url)));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const browser = await chromium.launch({ headless: true });
test.after(async () => {
  await browser.close();
  server.close();
});
const base = `http://127.0.0.1:${server.address().port}`;
mkdirSync("output/admin-qa", { recursive: true });
async function fixture(viewport) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  let accounts = Array.from({ length: 62 }, (_, i) => ({
    id: `user-${i}`,
    firstName: ["Анна", "Мария", "Дмитрий", "Елена"][i % 4],
    lastName: `Пользователь ${i + 1}`,
    email: `user${i}@example.test`,
    role: "parent",
    status: i % 5 === 0 ? "pending" : "active",
    createdAt: "2026-09-20T12:00:00Z",
    lastSeenAt: i % 5 ? new Date().toISOString() : null,
    sessions7d: i % 12,
    sessionsTotal: i * 3,
    openCount: i * 5,
    featureFlags: ["all_access", "internal_unknown"],
    subscription:
      i % 3
        ? { plan: "monthly", currentPeriodEnd: "2026-11-20T12:00:00Z" }
        : null,
    topicAssignments: [{ topicId: "beta", assignedAt: "2026-10-01T12:00:00Z" }],
    ownedTopics: [],
    activeSessions: i === 1 ? [{ device: "iPhone", topicId: "beta" }] : [],
  }));
  accounts[2].firstName = "<img src=x onerror=alert(1)>";
  const writes = [];
  await page.route("**/api/admin/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().headers().authorization !== "Bearer demo-token") {
      await route.fulfill({ status: 403, json: {} });
      return;
    }
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON();
      writes.push({ path, body });
      const id = path.split("/")[4];
      const a = accounts.find((a) => a.email === body.email || a.id === id);
      if (path.endsWith("/deletion-preview")) {
        await route.fulfill({
          json: {
            accountId: a.id,
            email: a.email,
            mode: body.mode,
            students: 2,
            sessions: a.sessionsTotal,
            audio: 3,
            materials: 4,
            orders: 1,
            paidOrders: 1,
            activeAccess: 1,
            confirmationToken: "test-confirmation",
            deleteAfter: "2026-10-14T12:00:00Z",
          },
        });
        return;
      }
      if (path.endsWith("/delete")) {
        if (body.mode === "immediate") {
          a.status = "purged";
          a.email = "removed@deleted.invalid";
          a.firstName = "";
          a.lastName = "";
          a.activeSessions = [];
          a.featureFlags = [];
          a.subscription = null;
          a.topicAssignments = [];
        } else {
          a.status = "deletion_pending";
          a.lifecycle = { delete_after: "2026-10-14T12:00:00Z" };
        }
      }
      if (path.endsWith("/lifecycle")) {
        a.status = body.action === "block" ? "blocked" : "active";
        if (body.action === "block") a.activeSessions = [];
      }
      if (path.endsWith("/flags")) a.featureFlags = body.flags;
      if (path.endsWith("/revoke"))
        a.topicAssignments = a.topicAssignments.filter(
          (t) => t.topicId !== body.topicId,
        );
      if (path.endsWith("/grant"))
        a.topicAssignments.push({ topicId: body.topicId });
      if (path.endsWith("/verify-account")) a.status = "active";
      await route.fulfill({ json: { ok: true } });
      return;
    }
    await route.fulfill({
      json: path.endsWith("/accounts")
        ? accounts
        : path.endsWith("/catalog")
          ? {
              decks: [
                {
                  id: "beta",
                  title: { ru: "Чтение: Стихи" },
                  publication: "beta",
                },
                {
                  id: "private",
                  title: { ru: "Индивидуальная тема" },
                  publication: "individual",
                },
                {
                  id: "release",
                  title: { ru: "Опубликованная тема" },
                  publication: "release",
                },
              ],
            }
          : path.endsWith("/sessions")
            ? [
                {
                  topicId: "beta",
                  mode: "reading",
                  completedAt: "2026-10-07T12:00:00Z",
                  percentCorrect: 90,
                },
              ]
            : [],
    });
  });
  await page.goto(base + "/admin.html");
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "Login form fits the viewport",
  );
  await page.locator("#token-input").fill("demo-token");
  await page.locator("#login-button").click();
  await page.locator("#accounts-body tr").first().waitFor();
  return { page, errors, writes };
}
test("admin directory: pagination, filters, sorting, CSV, escaped names and visual review", async () => {
  const { page, errors } = await fixture({ width: 1440, height: 1000 });
  assert.equal(await page.locator("#accounts-body tr").count(), 25);
  await page.screenshot({
    path: "output/admin-qa/users-desktop.png",
    fullPage: true,
  });
  await page.locator("#next-page").click();
  assert.equal(await page.locator("#page-label").textContent(), "2 / 3");
  await page.locator("#search").fill("user2@example.test");
  assert.equal(await page.locator("#accounts-body tr").count(), 1);
  assert.equal(await page.locator("#accounts-body img").count(), 0);
  const download = page.waitForEvent("download");
  await page.locator("#export").click();
  assert.ok((await download).suggestedFilename().endsWith(".csv"));
  await page.locator("#search").fill("missing");
  assert.equal(await page.locator("#list-state").isVisible(), true);
  await page.locator("#search").fill("");
  await page.locator("#activity-filter").selectOption("online");
  assert.equal(await page.locator("#accounts-body tr").count(), 1);
  await page.locator("#activity-filter").selectOption("all");
  await page.locator('[data-sort="sessions7d"]').click();
  await page.locator('[data-sort="sessions7d"]').click();
  assert.equal(
    await page
      .locator('[data-sort="sessions7d"]')
      .evaluate((el) => el.parentElement.getAttribute("aria-sort")),
    "descending",
  );
  assert.deepEqual(errors, []);
  await page.close();
});
test("account actions use actual assignments, preserve unknown flags, and require revoke confirmation", async () => {
  const { page, writes, errors } = await fixture({ width: 1440, height: 1000 });
  await page.locator("#search").fill("user1@example.test");
  await page.locator("#accounts-body .name-button").click();
  await page.screenshot({
    path: "output/admin-qa/user-details.png",
    fullPage: true,
  });
  assert.ok(
    (await page.locator("#account-content").textContent()).includes(
      "Чтение: Стихи",
    ),
  );
  assert.equal(
    await page.locator('#grant-topic option[value="release"]').count(),
    0,
  );
  await page.locator('[data-action="sessions"]').click();
  await page.locator(".session-table").waitFor();
  await page.locator('[data-flag="planner"]').check();
  await page.locator('[data-action="flags"]').click();
  await page.waitForFunction(() =>
    document.querySelector("#toast").textContent.includes("сохранены"),
  );
  assert.ok(writes[0].body.flags.includes("internal_unknown"));
  assert.ok(writes[0].body.flags.includes("all_access"));
  await page.locator('[data-action="revoke"]').click();
  await page.locator('#confirm-dialog button[value="cancel"]').click();
  assert.equal(writes.length, 1);
  await page.locator('[data-action="revoke"]').click();
  await page.locator("#confirm-submit").click();
  await page.waitForFunction(() =>
    document.querySelector("#toast").textContent.includes("отозван"),
  );
  assert.equal(writes.length, 2);
  await page.locator('[data-action="close"]').click();
  await page.locator('[data-view="promos"]').click();
  await page
    .locator('#promo-form select[name="kind"]')
    .selectOption("free_grant");
  assert.equal(
    await page.locator('[name="grantDurationDays"]').isVisible(),
    true,
  );
  await page.screenshot({
    path: "output/admin-qa/promos-desktop.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  await page.close();
});
test("mobile layout contains page width; logout stops refresh and clears sensitive data", async () => {
  const { page, errors } = await fixture({ width: 390, height: 844 });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    JSON.stringify(
      await page.evaluate(() =>
        [...document.querySelectorAll("body *")]
          .filter(
            (e) =>
              e.getBoundingClientRect().right > innerWidth &&
              getComputedStyle(e).position !== "absolute",
          )
          .map((e) => [
            e.tagName,
            e.className,
            Math.round(e.getBoundingClientRect().width),
          ])
          .slice(0, 20),
      ),
    ),
  );
  await page.screenshot({
    path: "output/admin-qa/users-mobile.png",
    fullPage: true,
  });
  await page.locator("#search").fill("user1@example.test");
  await page.locator("#accounts-body .name-button").click();
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    JSON.stringify(
      await page.evaluate(() =>
        [...document.querySelectorAll("body *")]
          .filter(
            (e) =>
              e.getBoundingClientRect().right > innerWidth &&
              getComputedStyle(e).position !== "absolute",
          )
          .map((e) => [
            e.tagName,
            e.className,
            Math.round(e.getBoundingClientRect().width),
          ])
          .slice(0, 20),
      ),
    ),
  );
  await page.screenshot({
    path: "output/admin-qa/details-mobile.png",
    fullPage: true,
  });
  await page.locator('[data-action="close"]').click();
  await page.locator("#logout").click();
  assert.equal(await page.locator("#auth-screen").isVisible(), true);
  assert.equal(await page.locator("#accounts-body tr").count(), 0);
  assert.equal(
    await page.evaluate(() => sessionStorage.getItem("mrc_admin_token")),
    null,
  );
  assert.deepEqual(errors, []);
  await page.close();
});

test("immediate deletion requires three stages and cancellation never sends a delete operation", async () => {
  const { page, writes, errors } = await fixture({ width: 390, height: 844 });
  await page.locator("#search").fill("user1@example.test");
  await page.locator("#accounts-body .name-button").click();
  await page.locator('[data-action="delete-immediate"]').click();
  await page.locator("#deletion-dialog").waitFor();
  assert.equal(await page.locator("#deletion-fields").isVisible(), false);
  await page.screenshot({
    path: "output/admin-qa/deletion-preview-mobile.png",
    fullPage: true,
  });
  await page.locator("#deletion-next").click();
  assert.equal(await page.locator("#deletion-submit").isDisabled(), true);
  await page.locator("#deletion-reason").fill("Тестовый аккаунт");
  await page.locator("#deletion-email").fill("wrong@example.test");
  await page.locator("#deletion-word").fill("УДАЛИТЬ");
  await page.locator("#deletion-ack-data").check();
  await page.locator("#deletion-ack-retention").check();
  assert.equal(await page.locator("#deletion-submit").isDisabled(), true);
  await page.locator("#deletion-email").fill("user1@example.test");
  assert.equal(await page.locator("#deletion-submit").isEnabled(), true);
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.screenshot({
    path: "output/admin-qa/deletion-confirm-mobile.png",
    fullPage: true,
  });
  await page.locator("#deletion-submit").click();
  await page.locator('#confirm-dialog button[value="cancel"]').click();
  assert.equal(writes.filter((w) => w.path.endsWith("/delete")).length, 0);
  await page.locator("#deletion-submit").click();
  await page.locator("#confirm-submit").click();
  await page.waitForFunction(() =>
    document.querySelector("#toast").textContent.includes("удалены"),
  );
  assert.equal(writes.filter((w) => w.path.endsWith("/delete")).length, 1);
  const operation = writes.find((w) => w.path.endsWith("/delete"));
  assert.equal(operation.body.confirmEmail, "user1@example.test");
  assert.equal(operation.body.confirmWord, "УДАЛИТЬ");
  await page.waitForFunction(() =>
    document
      .querySelector("#account-title")
      .textContent.includes("Удалённый аккаунт"),
  );
  assert.equal(
    await page.locator('[data-action="delete-immediate"]').count(),
    0,
  );
  assert.ok(
    (await page.locator("#account-title").textContent()).includes(
      "Удалённый аккаунт",
    ),
  );
  assert.deepEqual(errors, []);
  await page.close();
});
test("blocked accounts cannot change functions; scheduling and cancelling deletion updates status", async () => {
  const { page, errors } = await fixture({ width: 1440, height: 1000 });
  await page.locator("#search").fill("user1@example.test");
  await page.locator("#accounts-body .name-button").click();
  await page.locator("#lifecycle-reason").fill("Временная блокировка");
  await page.locator('[data-action="block"]').click();
  await page.locator("#confirm-submit").click();
  await page.locator('[data-action="unblock"]').waitFor();
  assert.equal(await page.locator('[data-flag="planner"]').isDisabled(), true);
  assert.equal(await page.locator('[data-action="grant"]').count(), 0);
  await page.locator('[data-action="delete-scheduled"]').click();
  await page.locator("#deletion-next").click();
  await page.locator("#deletion-reason").fill("По просьбе пользователя");
  await page.locator("#deletion-email").fill("user1@example.test");
  await page.locator("#deletion-word").fill("УДАЛИТЬ");
  await page.locator("#deletion-ack-data").check();
  await page.locator("#deletion-ack-retention").check();
  await page.locator("#deletion-submit").click();
  await page.locator("#confirm-submit").click();
  await page.locator('[data-action="cancel-deletion"]').waitFor();
  await page.locator("#lifecycle-reason").fill("Отмена по просьбе");
  await page.locator('[data-action="cancel-deletion"]').click();
  await page.locator("#confirm-submit").click();
  await page.locator('[data-action="block"]').waitFor();
  assert.deepEqual(errors, []);
  await page.close();
});
