import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { api } from "@/core/api";
import { getDb, kv } from "@/core/db";
import { pushOp } from "@/core/syncApi";
import { useAppStore } from "@/core/store";
import { SEEN_PREFIX } from "@/announcements/seenStore.js";
import AnnouncementHost from "./AnnouncementHost.jsx";

vi.mock("@/core/syncApi", async (orig) => ({ ...(await orig()), pushOp: vi.fn(() => Promise.resolve()) }));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const tick = (ms = 30) => new Promise((r) => setTimeout(r, ms));

const list = [
  { id: "t-one", date: "2026-11-20", title: { ru: "Первое", en: "First" }, body: { ru: ["Абзац один", "Абзац два"] }, until: "2999-01-01" },
  { id: "t-two", date: "2026-11-21", topics: ["propis2"], title: { ru: "Второе" }, body: { ru: ["Про прописи"] }, until: "2999-01-01" },
];

async function mount() {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => { root.render(<AnnouncementHost list={list} />); await tick(); });
  // the check reads IndexedDB and the account: let it settle
  for (let i = 0; i < 20; i++) await act(async () => { await tick(20); });
  return { host, root, shown: () => document.querySelector('[data-testid="announcement"]'), done: async () => { await act(async () => { root.unmount(); }); host.remove(); } };
}
const ok = async () => {
  const btn = [...document.querySelectorAll(".modal-actions button")].find((b) => b.textContent === "Понятно");
  await act(async () => { btn.click(); await tick(); });
  for (let i = 0; i < 20; i++) await act(async () => { await tick(20); });
};

describe("AnnouncementHost: a one-time announcement", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
    pushOp.mockClear();
    const db = await getDb();
    for (const a of list) await kv.del(db, SEEN_PREFIX + a.id);
    useAppStore.setState({ screen: "home", account: { id: "acc", createdAt: "2026-01-01T00:00:00Z" }, ownedTopics: [], topicRecords: [] });
  });

  it("shown on the home screen until «Понятно», then never again; the mark goes to the account; the next one waits for its audience", async () => {
    vi.spyOn(api, "get").mockResolvedValue({ kv: [] });
    let m = await mount();
    expect(m.shown()?.dataset.announcementId).toBe("t-one");
    expect(m.shown().querySelectorAll("p")).toHaveLength(2);
    expect(document.querySelector(".modal-close")).toBeNull(); // only «Понятно» closes it
    await ok();
    expect(m.shown()).toBeNull(); // «t-two» is for propis2 users only
    expect(pushOp).toHaveBeenCalledWith("kv.upsert", { key: SEEN_PREFIX + "t-one", value: { at: expect.any(Number) } });
    await m.done();
    m = await mount();
    expect(m.shown()).toBeNull();
    await m.done();
    useAppStore.setState({ ownedTopics: [{ topicId: "propis2", source: "paid" }] });
    m = await mount();
    expect(m.shown()?.dataset.announcementId).toBe("t-two");
    await m.done();
  });

  it("read on another device (the account's mark): not shown here, and kept on this device for offline", async () => {
    vi.spyOn(api, "get").mockResolvedValue({ kv: [{ key: SEEN_PREFIX + "t-one", value: { at: 1 } }] });
    const m = await mount();
    expect(m.shown()).toBeNull();
    expect(await kv.get(await getDb(), SEEN_PREFIX + "t-one")).toEqual({ at: expect.any(Number) });
    await m.done();
  });

  it("offline: shown from the device's own marks; never on another screen than home", async () => {
    vi.spyOn(api, "get").mockRejectedValue(new Error("offline"));
    useAppStore.setState({ screen: "session" });
    let m = await mount();
    expect(m.shown()).toBeNull();
    await m.done();
    useAppStore.setState({ screen: "home" });
    m = await mount();
    expect(m.shown()?.dataset.announcementId).toBe("t-one");
    await m.done();
  });

  it("signed out: the mark stays on the device, nothing is sent", async () => {
    useAppStore.setState({ account: null });
    const get = vi.spyOn(api, "get");
    const m = await mount();
    expect(m.shown()?.dataset.announcementId).toBe("t-one");
    await ok();
    expect(get).not.toHaveBeenCalled();
    expect(pushOp).not.toHaveBeenCalled();
    expect(await kv.get(await getDb(), SEEN_PREFIX + "t-one")).toEqual({ at: expect.any(Number) });
    await m.done();
  });
});

describe("«Что нового»: every announcement of the account, read or not", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
    pushOp.mockClear();
    const db = await getDb();
    for (const a of list) await kv.del(db, SEEN_PREFIX + a.id);
    useAppStore.setState({ screen: "whatsNew", account: { id: "acc", createdAt: "2026-01-01T00:00:00Z" }, ownedTopics: [{ topicId: "propis2", source: "paid" }], topicRecords: [] });
    vi.spyOn(api, "get").mockResolvedValue({ kv: [] });
  });

  it("newest first, unread ones marked «Новое»; opening it reads them, so the dialog will not show them", async () => {
    const { default: WhatsNewScreen } = await import("./WhatsNewScreen.jsx");
    await markSeenFor("t-one");
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => { root.render(<WhatsNewScreen list={list} />); await tick(); });
    for (let i = 0; i < 20; i++) await act(async () => { await tick(20); });
    const items = [...host.querySelectorAll('[data-testid="whats-new-item"]')];
    expect(items.map((el) => el.dataset.announcementId)).toEqual(["t-two", "t-one"]);
    expect(items.map((el) => Boolean(el.querySelector(".whats-new-badge")))).toEqual([true, false]);
    expect(await kv.get(await getDb(), SEEN_PREFIX + "t-two")).toEqual({ at: expect.any(Number) });
    expect(pushOp).toHaveBeenCalledWith("kv.upsert", { key: SEEN_PREFIX + "t-two", value: { at: expect.any(Number) } });
    await act(async () => { root.unmount(); });
  });

  it("nothing for this account: «Пока новостей нет»", async () => {
    const { default: WhatsNewScreen } = await import("./WhatsNewScreen.jsx");
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => { root.render(<WhatsNewScreen list={[]} />); await tick(); });
    for (let i = 0; i < 10; i++) await act(async () => { await tick(20); });
    expect(host.textContent).toContain("Пока новостей нет");
    await act(async () => { root.unmount(); });
  });
});

async function markSeenFor(id) {
  await kv.set(await getDb(), SEEN_PREFIX + id, { at: 1 });
}
