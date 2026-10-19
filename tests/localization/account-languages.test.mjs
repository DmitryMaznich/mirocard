import assert from "node:assert/strict";
import { test } from "node:test";
import { createAccountLanguages, ACCOUNT_LANGUAGES_KEY } from "../../src/shared/i18n/accountLanguages.js";

function storage() {
  const map = new Map();
  return { getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value), removeItem: key => map.delete(key) };
}
function fixture({ saved = storage(), request = async () => { throw new Error("offline"); } } = {}) {
  let ui = "ru", sequence = 0;
  const controller = createAccountLanguages({
    storage: saved, request, applyLanguage: value => { ui = value; }, makeId: () => "op_" + ++sequence,
  });
  const login = (id = "A", settings = { uiLanguage: "ru", cardLanguage: "ru", languageRevision: 0 }) =>
    controller.reconcile({ accountId: id, token: "token_" + id, settings });
  return { controller, login, saved, ui: () => ui };
}
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

test("offline choice survives reload, late bootstrap and a retry", async () => {
  const first = fixture();
  first.login();
  first.controller.chooseUiLanguage("sl");
  await first.controller.flush();
  first.login("A", { uiLanguage: "ru", cardLanguage: "en", languageRevision: 1 });
  assert.equal(first.ui(), "sl");
  assert.equal(first.controller.getSnapshot().cardLanguage, "en");
  let sent;
  const next = fixture({ saved: first.saved, request: async (_token, body) => {
    sent = body;
    return { uiLanguage: body.patch.uiLanguage, cardLanguage: "en", languageRevision: 2, conflict: false };
  } });
  next.login("A", { uiLanguage: "ru", cardLanguage: "en", languageRevision: 1 });
  await next.controller.flush();
  assert.deepEqual(sent.patch, { uiLanguage: "sl" });
  assert.equal(next.ui(), "sl");
  assert.equal(next.controller.getSnapshot().status, "synced");
  assert.equal(JSON.parse(first.saved.getItem(ACCOUNT_LANGUAGES_KEY)).A.pending, undefined);
});

test("a confirmed remote choice applies even when the boot language was explicit", async () => {
  const f = fixture();
  f.login("A", { uiLanguage: "sl", cardLanguage: "ru", languageRevision: 4 });
  assert.equal(f.ui(), "sl");
  f.login("A", { uiLanguage: "ru", cardLanguage: "sl", languageRevision: 5 });
  assert.equal(f.ui(), "ru");
  assert.equal(f.controller.getSnapshot().cardLanguage, "sl");
  f.login("A", { uiLanguage: "sl", cardLanguage: "en", languageRevision: 4 });
  assert.equal(f.ui(), "ru");
});

test("guest selection initializes only an unset account, never an explicit preference", async () => {
  const calls = [];
  const f = fixture({ request: async (_token, body) => {
    calls.push(body);
    return { uiLanguage: "sl", cardLanguage: "ru", languageRevision: 1, conflict: false };
  } });
  f.controller.chooseUiLanguage("sl");
  const reloaded = fixture({ saved: f.saved, request: async (_token, body) => {
    calls.push(body);
    return { uiLanguage: "sl", cardLanguage: "ru", languageRevision: 1, conflict: false };
  } });
  reloaded.login();
  await reloaded.controller.flush();
  assert.equal(calls[0].initializeOnly, true);
  reloaded.controller.disconnect();
  reloaded.controller.chooseUiLanguage("sl");
  reloaded.login("B", { uiLanguage: "ru", cardLanguage: "en", languageRevision: 3 });
  await reloaded.controller.flush();
  assert.equal(reloaded.ui(), "ru");
  assert.equal(calls.length, 1);
});

test("a conflict rebases only the pending language patch against server revision", async () => {
  const calls = [];
  const f = fixture({ request: async (_token, body) => {
    calls.push(structuredClone(body));
    return calls.length === 1
      ? { uiLanguage: "ru", cardLanguage: "en", languageRevision: 7, conflict: true }
      : { uiLanguage: "sl", cardLanguage: "en", languageRevision: 8, conflict: false };
  } });
  f.login();
  f.controller.chooseUiLanguage("sl");
  await f.controller.flush();
  assert.equal(calls[1].expectedRevision, 7);
  assert.deepEqual(calls[1].patch, { uiLanguage: "sl" });
  assert.equal(f.ui(), "sl");
  assert.equal(f.controller.getSnapshot().cardLanguage, "en");
});

test("an old response cannot clear a newer in-flight choice", async () => {
  let resolveFirst;
  const calls = [];
  const f = fixture({ request: async (_token, body) => {
    calls.push(structuredClone(body));
    if (calls.length === 1) return new Promise(resolve => { resolveFirst = resolve; });
    return { uiLanguage: "ru", cardLanguage: "sl", languageRevision: 2, conflict: false };
  } });
  f.login();
  f.controller.chooseUiLanguage("sl");
  f.controller.chooseUiLanguage("ru");
  f.controller.chooseCardLanguage("sl");
  resolveFirst({ uiLanguage: "sl", cardLanguage: "ru", languageRevision: 1, conflict: false });
  await f.controller.flush();
  assert.deepEqual(calls[1].patch, { uiLanguage: "ru", cardLanguage: "sl" });
  assert.equal(f.ui(), "ru");
  assert.equal(f.controller.getSnapshot().status, "synced");
});

test("logout and another account ignore the old response and isolate the pending operation", async () => {
  let resolveA;
  const f = fixture({ request: async () => new Promise(resolve => { resolveA = resolve; }) });
  f.login();
  f.controller.chooseUiLanguage("sl");
  f.controller.disconnect();
  f.login("B", { uiLanguage: "ru", cardLanguage: "en", languageRevision: 2 });
  resolveA({ uiLanguage: "sl", cardLanguage: "ru", languageRevision: 1, conflict: false });
  await tick();
  assert.equal(f.ui(), "ru");
  assert.equal(f.controller.getSnapshot().accountId, "B");
  assert.equal(f.controller.getSnapshot().cardLanguage, "en");
  assert.equal(JSON.parse(f.saved.getItem(ACCOUNT_LANGUAGES_KEY)).A.pending.patch.uiLanguage, "sl");
});

test("blocked storage is visible while switching remains functional", async () => {
  const blocked = { getItem() { throw Error("blocked"); }, setItem() { throw Error("quota"); } };
  const f = fixture({ saved: blocked });
  f.login();
  f.controller.chooseUiLanguage("sl");
  await f.controller.flush();
  assert.equal(f.ui(), "sl");
  assert.equal(f.controller.getSnapshot().durable, false);
  assert.equal(f.controller.getSnapshot().status, "pending");
});

test("unsupported choices do not enter the account queue", async () => {
  const f = fixture();
  f.login();
  f.controller.chooseUiLanguage("en");
  f.controller.chooseCardLanguage("sl-SI");
  await f.controller.flush();
  assert.equal(f.ui(), "ru");
  assert.equal(f.controller.getSnapshot().status, "synced");
});

test("an implicit legacy ru boot copy does not become an explicit account preference", async () => {
  const saved = storage();
  saved.setItem("mironium.uiLanguage", "ru");
  let calls = 0;
  const f = fixture({ saved, request: async () => { calls++; throw Error("should not send"); } });
  f.login();
  await f.controller.flush();
  assert.equal(calls, 0);
  assert.equal(JSON.parse(saved.getItem(ACCOUNT_LANGUAGES_KEY)).A.revision, 0);
});

test("an unchanged default response cannot acknowledge or revert a manual language choice", async () => {
  let stored = false;
  const f = fixture({ request: async () => stored
    ? { uiLanguage: "sl", cardLanguage: "ru", languageRevision: 1, conflict: false }
    : { uiLanguage: "ru", cardLanguage: "ru", languageRevision: 0, conflict: false },
  });
  f.login();
  f.controller.chooseUiLanguage("sl");
  await f.controller.flush();
  assert.equal(f.ui(), "sl");
  assert.equal(f.controller.getSnapshot().status, "pending");
  assert.equal(JSON.parse(f.saved.getItem(ACCOUNT_LANGUAGES_KEY)).A.pending.patch.uiLanguage, "sl");
  stored = true;
  await f.controller.flush();
  assert.equal(f.ui(), "sl");
  assert.equal(f.controller.getSnapshot().status, "synced");
});
