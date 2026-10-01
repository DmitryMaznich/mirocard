import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { openDb, kv } from "@/core/db";
import { useAppStore } from "@/core/store";
import { mergeStudentRecords } from "@/core/bootstrap";
import { rewardVideoViewCount } from "@/shared/utils/rewardVideoViews";
import { recordRewardVideoView } from "./rewardVideoViews";
import StudentEditScreen from "@/features/students/StudentEditScreen";

const mocks = vi.hoisted(() => ({ db: null }));
vi.mock("@/core/db", async (importOriginal) => ({ ...await importOriginal(), getDb: async () => mocks.db }));
vi.mock("@/core/syncApi", () => ({ flushQueue: vi.fn(async () => {}), pushOp: vi.fn(async () => {}) }));

const videoId = "aaaaaaaaaaa";
beforeEach(async () => {
  mocks.db = await openDb(`views-${crypto.randomUUID()}`);
  const students = [{ id: "s1", name: "Ученик", rewardVideos: [`https://youtu.be/${videoId}`, "https://youtu.be/bbbbbbbbbbb"] }];
  await kv.set(mocks.db, "students", students);
  useAppStore.setState({ students, editingStudentId: "s1", studentTopicLinks: [] });
});

describe("reward video views", () => {
  it("persists concurrent increments and queues each count atomically", async () => {
    await Promise.all([recordRewardVideoView("s1", videoId), recordRewardVideoView("s1", videoId)]);
    const stored = (await kv.get(mocks.db, "students"))[0];
    expect(rewardVideoViewCount(stored.rewardVideoViews, videoId)).toBe(2);
    expect(rewardVideoViewCount(useAppStore.getState().students[0].rewardVideoViews, videoId)).toBe(2);
    const ops = await new Promise((resolve) => {
      const req = mocks.db.transaction("syncQueue").objectStore("syncQueue").getAll();
      req.onsuccess = () => resolve(req.result);
    });
    expect(ops.map((op) => rewardVideoViewCount(op.data.views, videoId))).toEqual([1, 2]);
    await recordRewardVideoView("missing", videoId);
    expect((await kv.get(mocks.db, "students"))).toEqual([stored]);
  });

  it("merges devices and stale snapshots without losing or doubling views", () => {
    const local = { id: "s1", updatedAt: "2026-01-01", rewardVideoViews: { [videoId]: { deviceA: 3 } } };
    const server = { id: "s1", updatedAt: "2026-02-01", rewardVideoViews: { [videoId]: { deviceA: 2, deviceB: 4 } } };
    const merged = mergeStudentRecords([local], [server]);
    expect(rewardVideoViewCount(merged[0].rewardVideoViews, videoId)).toBe(7);
    expect(rewardVideoViewCount(mergeStudentRecords(merged, [server])[0].rewardVideoViews, videoId)).toBe(7);
  });

  it("shows saved counts and zero for an unwatched link in the profile", async () => {
    await recordRewardVideoView("s1", videoId);
    const container = document.createElement("div");
    const root = createRoot(container);
    try {
      await act(async () => root.render(<StrictMode><StudentEditScreen /></StrictMode>));
      expect(Array.from(container.querySelectorAll(".reward-video-view-count"), (el) => el.textContent))
        .toEqual(["Показано: 1 раз", "Показано: 0 раз"]);
      await act(async () => container.querySelector(".se-save-btn").click());
      expect(rewardVideoViewCount((await kv.get(mocks.db, "students"))[0].rewardVideoViews, videoId)).toBe(1);
    } finally {
      await act(async () => root.unmount());
    }
  });
});
