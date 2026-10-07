import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
const dataDir = mkdtempSync(path.join(tmpdir(), "mirocard-admin-test-"));
const frontend = mkdtempSync(path.join(tmpdir(), "mirocard-admin-frontend-"));
mkdirSync(path.join(frontend, "decks"));
writeFileSync(
  path.join(frontend, "decks/catalog.json"),
  JSON.stringify({
    decks: [
      { id: "beta", title: { ru: "Бета" }, status: "beta" },
      { id: "private", title: { ru: "Личная" }, status: "individual" },
      { id: "release", title: { ru: "Релиз" }, status: "release" },
    ],
  }),
);
process.env.MIROCARD_DATA_DIR = dataDir;
process.env.MIROCARD_DEPLOY_FRONTEND_DIR = frontend;
process.env.MIROCARD_ADMIN_TOKEN = "test-admin-token";
process.env.SERVE_STATIC = "1";
for (const file of ["admin.html", "admin.js", "admin.css", "admin-model.js"]) {
  writeFileSync(
    path.join(frontend, file),
    readFileSync(new URL(`../../public/${file}`, import.meta.url)),
  );
}
const { router, db } = await import("../server.mjs");
const { createAccount, activateAccount, deleteAccount } =
  await import("../lib/account-repository.mjs");
const { grantTrialSubscription } =
  await import("../lib/billing-repository.mjs");
const a = createAccount(db, {
  email: "admin-test@example.test",
  passwordHash: "not-a-real-hash",
  firstName: "Тест",
});
activateAccount(db, a.id);
grantTrialSubscription(db, a.id);
const deleted = createAccount(db, {
  email: "deleted@example.test",
  passwordHash: "not-a-real-hash",
});
deleteAccount(db, deleted.id);
const server = createServer(router);
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
test.after(() => {
  server.close();
});
const base = `http://127.0.0.1:${server.address().port}/api/admin`;
const request = (route, body) =>
  fetch(base + route, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: "Bearer test-admin-token",
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
test("admin reads reject unauthenticated requests", async () => {
  for (const route of ["/accounts", "/catalog"])
    assert.equal((await fetch(base + route)).status, 403);
});
test("admin static page applies security headers and assets cannot be cached", async () => {
  const page = await fetch(base.replace("/api/admin", "/admin.html"));
  assert.equal(page.status, 200);
  assert.ok(
    page.headers
      .get("content-security-policy")
      .includes("frame-ancestors 'none'"),
  );
  assert.equal(page.headers.get("x-frame-options"), "DENY");
  assert.equal(page.headers.get("referrer-policy"), "no-referrer");
  assert.ok(page.headers.get("x-robots-tag").includes("noindex"));
  for (const file of [
    "admin.html",
    "admin.js",
    "admin.css",
    "admin-model.js",
  ]) {
    const response = await fetch(base.replace("/api/admin", `/${file}`));
    assert.equal(response.status, 200);
    assert.ok(response.headers.get("cache-control").includes("no-store"));
  }
});
test("wrong admin credentials are throttled without blocking the correct token", async () => {
  for (let i = 0; i < 21; i++) {
    const response = await fetch(base + "/accounts", {
      headers: {
        Authorization: "Bearer wrong-token",
        "X-Forwarded-For": "192.0.2.15",
      },
    });
    assert.equal(response.status, i < 20 ? 403 : 429);
  }
  const response = await fetch(base + "/accounts", {
    headers: {
      Authorization: "Bearer test-admin-token",
      "X-Forwarded-For": "192.0.2.15",
    },
  });
  assert.equal(response.status, 200);
});
test("account listing includes subscription and never exposes password hashes", async () => {
  const data = await (await request("/accounts")).json();
  const row = data.find((row) => row.id === a.id);
  assert.ok(row.subscription);
  assert.equal(row.status, "active");
  assert.ok(!JSON.stringify(data).includes("not-a-real-hash"));
});
test("admin catalog includes individual and beta topics", async () => {
  const { decks } = await (await request("/catalog")).json();
  assert.equal(decks.length, 3);
  assert.equal(decks[1].publication, "individual");
});
test("topic grant creates actual assignment, release topics cannot be assigned, revoke removes assignment", async () => {
  assert.equal(
    (await request("/grant", { email: a.email, topicId: "beta" })).status,
    200,
  );
  let rows = await (await request("/accounts")).json();
  assert.ok(
    rows
      .find((row) => row.id === a.id)
      .topicAssignments.some((t) => t.topicId === "beta"),
  );
  assert.equal(
    (await request("/grant", { email: a.email, topicId: "release" })).status,
    409,
  );
  assert.equal(
    (await request("/revoke", { email: a.email, topicId: "beta" })).status,
    200,
  );
  rows = await (await request("/accounts")).json();
  assert.equal(rows.find((row) => row.id === a.id).topicAssignments.length, 0);
});
test("invalid and duplicate promo codes are rejected; currency uses minor units", async () => {
  assert.equal(
    (
      await request("/promo-codes", {
        code: "BAD",
        kind: "percent_off",
        value: 101,
      })
    ).status,
    400,
  );
  assert.equal(
    (await request("/promo-codes", { code: "FREE", kind: "free_grant" }))
      .status,
    400,
  );
  const promo = {
    code: "EURO",
    kind: "fixed_off",
    value: 250,
    currency: "EUR",
    appliesToPlan: "annual",
  };
  assert.equal((await request("/promo-codes", promo)).status, 200);
  assert.equal(
    (await request("/promo-codes", { ...promo, code: " euro " })).status,
    409,
  );
  const codes = await (await request("/promo-codes")).json();
  assert.equal(codes[0].value, 250);
});

test("deleted accounts cannot be changed through administrative writes", async () => {
  for (const [route, body] of [
    ["/account/flags", { email: deleted.email, flags: ["planner"] }],
    ["/grant", { email: deleted.email, topicId: "beta" }],
    ["/revoke", { email: deleted.email, topicId: "beta" }],
    ["/verify-account", { email: deleted.email }],
  ]) {
    assert.equal((await request(route, body)).status, 409);
  }
});

test("administrative lifecycle routes require admin credentials and enforce confirmations on the server", async () => {
  const victim = createAccount(db, {
    email: "lifecycle-http@example.test",
    passwordHash: "hash",
  });
  activateAccount(db, victim.id);
  const route = `/accounts/${victim.id}`;
  assert.equal(
    (
      await fetch(base + route + "/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request(route + "/lifecycle", {
        action: "block",
        reason: "Проверка",
      })
    ).status,
    200,
  );
  assert.equal(
    (await request("/verify-account", { email: victim.email })).status,
    409,
  );
  assert.equal(
    (
      await request("/account/flags", {
        email: victim.email,
        flags: ["all_access"],
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await request(route + "/lifecycle", {
        action: "unblock",
        reason: "Проверено",
      })
    ).status,
    200,
  );
  const preview = await (
    await request(route + "/deletion-preview", { mode: "immediate" })
  ).json();
  const input = {
    mode: "immediate",
    confirmationToken: preview.confirmationToken,
    reason: "Тестовый аккаунт",
    confirmEmail: victim.email,
    confirmWord: "УДАЛИТЬ",
    acknowledgeData: true,
    acknowledgeRetention: true,
  };
  assert.equal(
    (
      await request(route + "/delete", {
        ...input,
        acknowledgeRetention: false,
      })
    ).status,
    400,
  );
  assert.equal((await request(route + "/delete", input)).status, 200);
  assert.equal((await request(route + "/delete", input)).status, 409);
  assert.equal(
    db.prepare("SELECT status FROM accounts WHERE id = ?").get(victim.id)
      .status,
    "purged",
  );
  const replacement = createAccount(db, {
    email: victim.email,
    passwordHash: "new",
  });
  assert.notEqual(replacement.id, victim.id);
});

test('new Google signup cannot bypass a blocked account', async () => {
  const { createOneTimeCode } = await import('../lib/one-time-codes.mjs');
  const victim = createAccount(db, { email: 'google-blocked@example.test', passwordHash: 'hash' }); activateAccount(db, victim.id);
  await request(`/accounts/${victim.id}/lifecycle`, { action: 'block', reason: 'Проверка' });
  const signupCode = createOneTimeCode(db, { kind: 'google_signup_confirm', payload: { email: victim.email, subject: 'google-blocked-subject', givenName: 'Name', familyName: 'Last' } });
  const response = await fetch(base.replace('/admin', '/auth/google/complete-signup'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ signupCode, role: 'parent', referralSource: 'other', consentPersonalData: true }) });
  assert.equal(response.status, 409);
  assert.equal(db.prepare('SELECT status FROM accounts WHERE id = ?').get(victim.id).status, 'blocked');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM account_identities WHERE account_id = ?').get(victim.id).n, 0);
});
