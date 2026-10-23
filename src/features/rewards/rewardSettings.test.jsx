import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useAppStore } from "@/core/store";
import { setUiLanguage } from "@/shared/i18n/uiLanguage.js";
import RewardSettingsSection from "./RewardSettingsSection.jsx";
import StarBar from "@/shared/components/StarBar.jsx";
import StreakTracker from "@/topics/renderers/streak_tracker/index.jsx";
import { mergeStudents } from "@/core/bootstrap.js";

let root, host;
const original = useAppStore.getState();
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  setUiLanguage("ru");
  useAppStore.setState({ activeStudentId: "s", students: [{ id: "s", rewardSettings: { algorithm: "flexible", animation: "soft" } }] });
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); useAppStore.setState(original, true); vi.useRealTimers(); });
const button = name => [...host.querySelectorAll("button")].find(item => item.textContent === name);

it("rolls back with one profile choice and retains the new duration for a later opt-in", async () => {
  function Profile() { const [settings, setSettings] = useState({ algorithm: "legacy" }); return <RewardSettingsSection value={settings} onChange={setSettings} />; }
  await act(async () => root.render(<Profile />));
  expect(button("1 минута").matches(":disabled")).toBe(true);
  await act(async () => button("Новые правила").click());
  await act(async () => button("До конца ролика, не более 3 минут").click());
  expect(button("До конца ролика, не более 3 минут").getAttribute("aria-pressed")).toBe("true");
  await act(async () => button("Прежние правила").click());
  expect(button("1 минута").matches(":disabled")).toBe(true);
  await act(async () => button("Новые правила").click());
  expect(button("До конца ролика, не более 3 минут").getAttribute("aria-pressed")).toBe("true");
});

it("animates exactly the lost stars, and never burns stars exchanged for a prize", async () => {
  await act(async () => root.render(<StarBar available streakCount={3} />));
  await act(async () => root.render(<StarBar available streakCount={2} changeReason="loss" />));
  expect(host.querySelectorAll(".star-bar-star--burn")).toHaveLength(1);
  expect(host.querySelector(".star-bar-zone--soft")).toBeTruthy();
  await act(async () => vi.advanceTimersByTime(750));
  await act(async () => root.render(<StarBar available streakCount={0} changeReason="loss" />));
  expect(host.querySelectorAll(".star-bar-star--burn")).toHaveLength(2);
  await act(async () => root.render(<StarBar available streakCount={5} changeReason="gain" />));
  await act(async () => root.render(<StarBar available streakCount={0} changeReason="exchange" />));
  expect(host.querySelectorAll(".star-bar-star--burn")).toHaveLength(0);
});

it("keeps five visible stars in the new 5-of-5 tracker, even at 15 successes", async () => {
  const props = { task: { conceptId: "c" }, answersPerStar: 3, onCorrect: () => {}, onIncorrect: () => {} };
  await act(async () => root.render(<StreakTracker {...props} streakCount={9} />));
  expect(host.querySelectorAll(".operation-manual__star")).toHaveLength(5);
  expect(host.querySelectorAll(".operation-manual__star--lit")).toHaveLength(3);
  await act(async () => root.render(<StreakTracker {...props} streakCount={6} rewardChangeReason="loss" />));
  expect(host.querySelectorAll(".operation-manual__star--soft-burn")).toHaveLength(1);
});

it("merges an explicit rollback ahead of a newer unrelated edit on another device", () => {
  const local = { id: "s", name: "Миша", updatedAt: "2026-10-23T10:00:00Z", rewardSettings: { algorithm: "legacy", duration: "180" }, rewardSettingsUpdatedAt: "2026-10-23T12:00:00Z" };
  const remote = { id: "s", name: "Новое имя", updatedAt: "2026-10-23T13:00:00Z", rewardSettings: { algorithm: "flexible" }, rewardSettingsUpdatedAt: "2026-10-23T11:00:00Z" };
  const merged = mergeStudents([local], [remote])[0];
  expect(merged.name).toBe("Новое имя");
  expect(merged.rewardSettings.algorithm).toBe("legacy");
  expect(merged.rewardSettings.duration).toBe("180");
});
