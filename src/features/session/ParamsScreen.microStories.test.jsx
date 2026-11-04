import { act } from "react";
import { createRoot } from "react-dom/client";
import { readFile } from "node:fs/promises";
import JSZip from "jszip";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import ParamsScreen from "./ParamsScreen";
import { useAppStore } from "@/core/store";
import { setUiLanguage } from "@/shared/i18n/uiLanguage.js";

const mocks = vi.hoisted(() => ({ persist: vi.fn(), start: vi.fn() }));
vi.mock("@/core/linkUtils", () => ({ persistStudentTopicLink: mocks.persist }));
vi.mock("@/features/timer/TimerContext", () => ({ useTimer: () => ({ markSessionStart: mocks.start }) }));
const zip = await JSZip.loadAsync(await readFile("public/decks/reading_short_stories_v2.0.5.zip"));
const topic = JSON.parse(await zip.file("topic.json").async("string"));
const initial = useAppStore.getState();
let root, host;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks(); setUiLanguage("ru");
  useAppStore.setState({ activeStudentId: "kid", activeTopicId: topic.meta.id, activeModeId: "story_quiz", activeTextId: topic.texts[0].id,
    students: [{ id: "kid", name: "Миша" }], topicRecords: [structuredClone(topic)], sessions: [],
    studentTopicLinks: { [`kid_${topic.meta.id}`]: { params: {}, videoRewardEnabled: false } }, screen: "params", sessionReturnScreen: null });
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); useAppStore.setState(initial, true); });

it("opens the real micro-story settings and starts the default fifteen stories with valid name-first questions", async () => {
  await act(async () => root.render(<ParamsScreen />));
  expect(host.querySelectorAll('.story-selection-options input')).toHaveLength(16);
  expect(host.textContent).toContain("Мяч под стулом");
  expect(host.textContent).not.toContain("Понятия");
  expect(host.querySelector('.story-quiz-param__invalid')).toBeNull();
  const start = [...host.querySelectorAll('button')].find(button => button.textContent.trim() === "Начать занятие");
  expect(start).toBeTruthy(); expect(start.disabled).toBe(false);
  await act(async () => start.click());
  expect(mocks.persist).toHaveBeenCalledWith("kid", topic.meta.id, expect.objectContaining({
    params: expect.objectContaining({ storyStage: "micro", selectedMicroStories: [] }),
  }));
  expect(useAppStore.getState().screen).toBe("session");
});

it("switches to the twelve previous stories without the three-question rule breaking them", async () => {
  await act(async () => root.render(<ParamsScreen />));
  const extended = [...host.querySelectorAll('button')].find(button => button.textContent.trim() === "Прежние рассказы: подлиннее");
  expect(extended).toBeTruthy();
  await act(async () => extended.click());
  expect(host.querySelectorAll('.story-selection-options input')).toHaveLength(13);
  expect(host.querySelector('.story-quiz-param__invalid')).toBeNull();
});
