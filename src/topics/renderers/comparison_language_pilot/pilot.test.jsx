import { act } from "react";
import { createRoot } from "react-dom/client";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import JSZip from "jszip";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openDb, kv, topics } from "@/core/db";
import { importTopic, getTopicRecord } from "@/topics/topicLoader";
import { useAppStore } from "@/core/store";
import { setUiLanguage } from "@/shared/i18n/uiLanguage.js";
import ParamsScreen from "@/features/session/ParamsScreen";
import { buildGeneratedSessionState } from "@/features/session/useSessionEngine";
import { createActiveSessionSnapshot, restoreActiveSessionState } from "@/features/session/activeSession";
import { computeSessionRecord, handleAnswer } from "@/features/session/sessionEngine";
import { generateTasks as originalTasks } from "../comparison/engine";
import { generateTasks } from "./engine";
import CompareVisual from "./CompareVisual";
import { createContentContext, initialContentLanguage, loadTopicLanguages, validateTopicLanguages } from "../../../../shared/topic-language-contract.mjs";

const mocks = vi.hoisted(() => ({ persist: vi.fn() }));
vi.mock("@/core/linkUtils", () => ({ persistStudentTopicLink: mocks.persist }));
vi.mock("@/features/timer/TimerContext", () => ({ useTimer: () => ({ markSessionStart: vi.fn() }) }));
const base = resolve("tools/comparison_language_pilot");
const raw = JSON.parse(await readFile(resolve(base, "topic.json"), "utf8"));
const topic = await loadTopicLanguages(raw, (path) => readFile(resolve(base, path), "utf8"));
const mode = topic.modes[0];
const originalStore = useAppStore.getState();
let root, host;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount()); host.remove(); setUiLanguage("ru");
  useAppStore.setState(originalStore, true); vi.restoreAllMocks();
});

const button = (label) => [...host.querySelectorAll("button")].find((b) => b.textContent.trim() === label);
function seedRandom(seed = 1234) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}
function stateFor(contentLanguage) {
  return buildGeneratedSessionState({ topicRecord: topic, mode, activeStudentId: "kid", activeTopicId: topic.meta.id, link: {}, selectedConceptIds: ["pilot_visual"], sessionParams: { contentLanguage, level: 1, question: "mix", showEqual: true } });
}

describe("independent interface and lesson languages", () => {
  for (const uiLanguage of ["ru", "sl"]) for (const contentLanguage of ["ru", "sl"]) {
    it(`${uiLanguage} UI / ${contentLanguage} content keeps selection on a UI switch`, async () => {
      setUiLanguage(uiLanguage);
      const originalLink = { params: { level: 4 }, bestStreak: 17 };
      useAppStore.setState({ activeStudentId: "kid", activeTopicId: topic.meta.id, activeModeId: mode.id, activeTextId: null,
        students: [{ id: "kid", name: "Миша", preferredLessonLanguage: "ru" }], topicRecords: [topic], sessions: [],
        settings: { ...originalStore.settings, cardLanguage: "ru" },
        studentTopicLinks: { kid_comparison: originalLink, kid_comparison_language_pilot: { params: { contentLanguage } } },
        screen: "params", sessionReturnScreen: null });
      await act(async () => root.render(<ParamsScreen />));
      expect(host.textContent).toContain(uiLanguage === "ru" ? "Язык занятия" : "Jezik učnega gradiva");
      expect(button(contentLanguage === "ru" ? "Русский" : "Slovenščina").className).toContain("enum-btn--active");
      await act(async () => setUiLanguage(uiLanguage === "ru" ? "sl" : "ru"));
      expect(button(contentLanguage === "ru" ? "Русский" : "Slovenščina").className).toContain("enum-btn--active");
      expect(mocks.persist).not.toHaveBeenCalled();
      expect(useAppStore.getState().studentTopicLinks.kid_comparison).toBe(originalLink);
      const state = stateFor(contentLanguage);
      const task = state.tasks.find((t) => t.question !== "equal");
      await act(async () => root.render(<CompareVisual task={task} sessionStatus="task_active" onCorrect={() => {}} onIncorrect={() => {}} />));
      expect(host.querySelector('[lang]').lang).toBe(contentLanguage);
      expect(host.querySelector('.pilot-compare-instruction').textContent).toMatch(contentLanguage === "ru" ? /точек/ : /pik/);
      const before = state.tasks;
      setUiLanguage(uiLanguage);
      expect(state.tasks).toBe(before);
      expect(state.statistics.conditions.languageContext).toEqual(state.languageContext);
    });
  }
  it("requires explicit available material instead of falling back to Russian", () => {
    expect(initialContentLanguage(topic, mode.id, "en", "ru", "ru")).toBeNull();
    expect(initialContentLanguage(topic, mode.id, null, "sl", "ru")).toBe("sl");
    expect(stateFor("en")).toBeNull();
    expect(stateFor(undefined)).toBeNull();
    expect(() => generateTasks(mode, topic.cards, 1, {})).toThrow(/Explicit/);
  });
  it("blocks launch until the unavailable preference is explicitly replaced", async () => {
    setUiLanguage("sl");
    useAppStore.setState({ activeStudentId: "kid", activeTopicId: topic.meta.id, activeModeId: mode.id, activeTextId: null,
      students: [{ id: "kid", name: "Миша", preferredLessonLanguage: "en" }], topicRecords: [topic], sessions: [],
      studentTopicLinks: { kid_comparison_language_pilot: { videoRewardEnabled: false } }, settings: { ...originalStore.settings, cardLanguage: "ru" }, screen: "params" });
    await act(async () => root.render(<ParamsScreen />));
    expect(host.querySelector('[role="alert"]').textContent).toContain("Izberite");
    expect(button("Začni učno uro").disabled).toBe(true);
    await act(async () => button("Slovenščina").click());
    expect(button("Začni učno uro").disabled).toBe(false);
    await act(async () => button("Začni učno uro").click());
    expect(mocks.persist).toHaveBeenCalledWith("kid", topic.meta.id, expect.objectContaining({ params: expect.objectContaining({ contentLanguage: "sl" }) }));
  });
});

it("keeps original numerical mechanics for all pilot parameter combinations", () => {
  for (const level of [1, 2, 3, 4]) for (const question of ["more", "less", "mix"]) for (const showEqual of [false, true]) for (const visualMode of ["dots", "dots_numbers", "numbers", "pairing"]) {
    const params = { level, question, showEqual, visualMode, contentLanguage: "sl" };
    const random = vi.spyOn(Math, "random").mockImplementation(seedRandom());
    const projection = (tasks) => tasks.map(({ left, right, question, visualMode, showEqual }) => ({ left, right, question, visualMode, showEqual }));
    const expected = projection(originalTasks(mode, topic.cards, 40, params));
    random.mockImplementation(seedRandom());
    const context = createContentContext(topic, mode, params);
    expect(projection(generateTasks(mode, topic.cards, 40, params, context, topic.languageResources.content.sl))).toEqual(expected);
    random.mockRestore();
  }
});

it("persists pinned package identity in checkpoints/history and rejects incompatible resumes", () => {
  const state = stateFor("sl");
  const answered = handleAnswer(state, true, "pilot_visual", null);
  const record = JSON.parse(JSON.stringify(computeSessionRecord(answered)));
  expect(record.statistics.conditions.languageContext).toEqual(state.languageContext);
  const snapshot = JSON.parse(JSON.stringify(createActiveSessionSnapshot({ studentId: "kid", topicId: topic.meta.id, modeId: mode.id }, answered)));
  const context = { studentId: "kid", topicId: topic.meta.id, modeId: mode.id, topicVersion: topic.meta.version, conceptIds: ["pilot_visual"], languageContext: state.languageContext };
  expect(restoreActiveSessionState(snapshot, context)?.languageContext).toEqual(state.languageContext);
  expect(restoreActiveSessionState(snapshot, { ...context, languageContext: { ...state.languageContext, contentLanguage: "ru" } })).toBeNull();
  expect(restoreActiveSessionState(snapshot, { ...context, languageContext: { ...state.languageContext, contentVersion: "0.2.0" } })).toBeNull();
});

it("imports the actual ZIP without altering original topic, files or progress", async () => {
  const db = await openDb(`language-pilot-${Math.random()}`);
  const original = { id: "comparison", meta: { id: "comparison", renderer: "comparison", version: "2.37.0" }, modes: [], cards: [] };
  await kv.set(db, "topic:comparison", original);
  await topics.saveFile(db, "comparison", "renderer", new Blob(["original renderer"]));
  await kv.set(db, "studentTopicLink:kid_comparison", { correct: 42 });
  const bytes = await readFile(resolve("public/decks/comparison_language_pilot_v0.1.0.zip"));
  await importTopic(db, bytes, "1.0.2672");
  const installed = await getTopicRecord(db, topic.meta.id);
  expect(installed.modes).toHaveLength(1);
  expect(installed.languageResources.content.sl.language).toBe("sl");
  expect(installed.meta.title.sl).toBe(topic.meta.title.sl);
  expect(await kv.get(db, "topic:comparison")).toEqual(original);
  expect(await (await topics.getFile(db, "comparison", "renderer")).text()).toBe("original renderer");
  expect(await kv.get(db, "studentTopicLink:kid_comparison")).toEqual({ correct: 42 });
  const invalidZip = await JSZip.loadAsync(bytes);
  invalidZip.remove("content/sl.json");
  await expect(importTopic(db, await invalidZip.generateAsync({ type: "arraybuffer" }), "1.0.2672")).rejects.toThrow(/missing file/);
  expect(await getTopicRecord(db, topic.meta.id)).toEqual(installed);
  db.close();
});

it("rejects incomplete UI, missing lesson messages, mismatched packages and unsupported audio", () => {
  for (const change of [
    (t) => { delete t.languageResources.ui.sl["topic.title"]; },
    (t) => { delete t.languageResources.content.sl.messages["prompt.dots.more"]; },
    (t) => { t.languageResources.content.sl.language = "ru"; },
    (t) => { t.languageResources.content.sl.messages["verdict.more"] = "{{wrong}}"; },
    (t) => { t.languageContract.packages.sl.audio = "recorded"; },
    (t) => { t.languageContract.packages.sl.modeIds = ["compare_sign"]; },
  ]) {
    const invalid = structuredClone(topic); change(invalid);
    expect(() => validateTopicLanguages(invalid)).toThrow(/Topic language contract/);
  }
});
