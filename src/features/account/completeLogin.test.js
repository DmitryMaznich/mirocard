import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { useAppStore } from "@/core/store";
import * as apiModule from "@/core/api";
import { getDb, kv } from "@/core/db";
import { completeLogin } from "./completeLogin";
import { hasActiveEntitlement } from "@/features/billing/entitlement";

function mockServer({ students = [{ id: "s-server", name: "С сервера" }], subscription = null } = {}) {
  vi.spyOn(apiModule.api, "get").mockImplementation(async (path) => {
    if (path === "/account/bootstrap") {
      return { students, ownedTopics: [], studentTopicLinks: [], conceptProgress: [], settings: {}, subscription };
    }
    if (path.startsWith("/sessions")) return [];
    throw new Error(`unexpected GET ${path}`);
  });
  return vi.spyOn(apiModule.api, "post").mockResolvedValue({ accepted: true });
}

describe("completeLogin", () => {
  let db;
  beforeEach(async () => {
    useAppStore.getState().logout(); // fresh in-memory state, as after sign-out
    db = await getDb();
    await kv.del(db, "accountId");
    await kv.del(db, "students");
  });
  afterEach(() => vi.restoreAllMocks());

  it("lands on home with the server's students and tags IDB with the account", async () => {
    mockServer();
    await completeLogin({ account: { id: "a1", email: "x@example.test" }, token: "t1" });
    const state = useAppStore.getState();
    expect(state.screen).toBe("home");
    expect(state.students.map((s) => s.id)).toEqual(["s-server"]);
    expect(await kv.get(db, "accountId")).toBe("a1");
  });

  it("drops another account's local students instead of leaking them", async () => {
    await kv.set(db, "accountId", "someone-else");
    await kv.set(db, "students", [{ id: "s-foreign", name: "Чужой" }]);
    mockServer({ students: [] });
    await completeLogin({ account: { id: "a2", email: "y@example.test" }, token: "t2" });
    expect(useAppStore.getState().students.map((s) => s.id)).toEqual([]);
  });

  it("makes the trial available immediately after login without a page reload", async () => {
    const subscription = { plan: "trial", status: "active", currentPeriodEnd: "2099-01-01T00:00:00.000Z" };
    mockServer({ subscription });
    await completeLogin({ account: { id: "trial-account" }, token: "trial-token" });
    const state = useAppStore.getState();
    expect(state.subscription).toEqual(subscription);
    expect(hasActiveEntitlement(state.account, state.subscription)).toBe(true);
  });

  it("clears the previous account's access when the next account has no subscription", async () => {
    useAppStore.setState({ subscription: { plan: "annual", status: "active", currentPeriodEnd: "2099-01-01T00:00:00.000Z" } });
    mockServer({ subscription: null });
    await completeLogin({ account: { id: "no-access-account" }, token: "no-access-token" });
    const state = useAppStore.getState();
    expect(state.subscription).toBeNull();
    expect(hasActiveEntitlement(state.account, state.subscription)).toBe(false);
  });

  it("uploads the same account's offline students before loading the server copy", async () => {
    await kv.set(db, "accountId", "a3");
    await kv.set(db, "students", [{ id: "s-offline", name: "Офлайн" }]);
    const post = mockServer({ students: [] });
    await completeLogin({ account: { id: "a3", email: "z@example.test" }, token: "t3" });
    const sync = post.mock.calls.find(([p]) => p === "/sync");
    expect(sync[1].operations.some((op) => op.type === "student.upsert" && op.data.id === "s-offline")).toBe(true);
  });
});
