import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ensureObjectHasOwn, ensureBrowserCompatibility } from "@/browserCompatibility.js";
import { useAppStore } from "@/core/store";
import { getDb, kv } from "@/core/db";
import { api, setApiToken } from "@/core/api";
import { completeLogin } from "./completeLogin.js";
import { handleGoogleCode } from "./googleSignIn.js";
import { accountLanguages } from "@/core/languageSync.js";
import { setUiLanguage } from "@/shared/i18n/uiLanguage.js";

const originalHasOwn = Object.getOwnPropertyDescriptor(Object, "hasOwn");
const originalAt = Object.getOwnPropertyDescriptor(Array.prototype, "at");
const originalUuid = Object.getOwnPropertyDescriptor(crypto, "randomUUID");
const initialState = useAppStore.getState();
beforeEach(async () => {
  accountLanguages.disconnect();
  const db = await getDb();
  await kv.del(db, "accountId");
  vi.spyOn(api, "get").mockImplementation(async (path) => path.startsWith("/sessions") ? [] : {
    settings: { uiLanguage: "ru", cardLanguage: "ru", languageRevision: 1 },
    students: [{ id: "kid", name: "Миша" }], ownedTopics: [], studentTopicLinks: [], conceptProgress: [],
  });
  vi.spyOn(api, "post").mockResolvedValue({ account: { id: "compat-account" }, token: "test-token" });
});
afterEach(() => {
  Object.defineProperty(Object, "hasOwn", originalHasOwn);
  Object.defineProperty(Array.prototype, "at", originalAt);
  if (originalUuid) Object.defineProperty(crypto, "randomUUID", originalUuid);
  else delete crypto.randomUUID;
  accountLanguages.disconnect();
  setApiToken(null); setUiLanguage("ru");
  useAppStore.setState(initialState, true); vi.restoreAllMocks();
});

it("supports own keys on legacy browsers without changing prototype-key semantics", () => {
  delete Object.hasOwn;
  ensureObjectHasOwn();
  const values = Object.create(null);
  values.__proto__ = "own";
  expect(Object.hasOwn(values, "__proto__")).toBe(true);
  expect(Object.hasOwn({}, "constructor")).toBe(false);
  expect(Object.hasOwn({ field: undefined }, "field")).toBe(true);
  expect(Object.getOwnPropertyDescriptor(Object, "hasOwn").enumerable).toBe(false);
  expect(() => Object.hasOwn(null, "field")).toThrow(TypeError);
});

for (const method of ["password", "google"]) {
  it(`${method}: completes login and persists language/account data without native Object.hasOwn`, async () => {
    delete Object.hasOwn;
    delete Array.prototype.at;
    Object.defineProperty(crypto, "randomUUID", { value: undefined, writable: true, configurable: true });
    ensureBrowserCompatibility();
    if (method === "google") await handleGoogleCode("test-code");
    else await completeLogin({ account: { id: "compat-account" }, token: "test-token" });
    expect(useAppStore.getState().screen).toBe("home");
    expect(useAppStore.getState().students.some((s) => s.id === "kid")).toBe(true);
    expect(accountLanguages.getSnapshot().accountId).toBe("compat-account");
    expect(await kv.get(await getDb(), "accountId")).toBe("compat-account");
    // Re-login on the same device also exercises merging local/server students.
    await completeLogin({ account: { id: "compat-account" }, token: "test-token" });
    expect(useAppStore.getState().screen).toBe("home");
  });
}

it("supports negative indexing and creates UUID v4 values from secure randomness", () => {
  delete Array.prototype.at; Object.defineProperty(crypto, "randomUUID", { value: undefined, writable: true, configurable: true });
  ensureBrowserCompatibility();
  expect([1, 2, 3].at(-1)).toBe(3);
  expect([1, 2, 3].at(-4)).toBeUndefined();
  expect([1, 2, 3].at(1.9)).toBe(2);
  expect([1, 2, 3].at(Infinity)).toBeUndefined();
  const first = crypto.randomUUID(), second = crypto.randomUUID();
  expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  expect(first).not.toBe(second);
});
