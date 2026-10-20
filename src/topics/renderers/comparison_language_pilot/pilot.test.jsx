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
import CompareSign from "./CompareSign.jsx";
import Pilot from "./index.jsx";
import { readModeParams, writeModeParams, getConceptCards } from "@/shared/utils/topicUtils";
import { resolveModeSelection } from "@/features/session/useSessionEngine";
import { createContentContext, initialContentLanguage, loadTopicLanguages, validateTopicLanguages } from "../../../../shared/topic-language-contract.mjs";

const mocks = vi.hoisted(() => ({ persist: vi.fn() }));
vi.mock("@/core/linkUtils", () => ({ persistStudentTopicLink: mocks.persist }));
vi.mock("@/features/timer/TimerContext", () => ({ useTimer: () => ({ markSessionStart: vi.fn() }) }));
const base = resolve("tools/comparison_language_pilot");
const raw = JSON.parse(await readFile(resolve(base, "topic.json"), "utf8"));
const topic = await loadTopicLanguages(raw, (path) => readFile(resolve(base, path), "utf8"));
const mode = topic.modes[0];
const signMode = topic.modes.find((m) => m.id === "compare_sign");
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
      expect(host.textContent).not.toContain(uiLanguage === "ru" ? "Язык занятия" : "Jezik učnega gradiva");
      expect(button("Русский")).toBeUndefined();
      expect(button("Slovenščina")).toBeUndefined();
      await act(async () => setUiLanguage(uiLanguage === "ru" ? "sl" : "ru"));
      expect(button("Slovenščina")).toBeUndefined();
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
    expect(host.querySelector('[role="alert"]').textContent).toContain("izberite");
    expect(button("Začni učno uro").disabled).toBe(true);
    await act(async () => useAppStore.setState({ studentTopicLinks: { kid_comparison_language_pilot: { params: { topicContentLanguage: "sl" }, videoRewardEnabled: false } } }));
    expect(button("Začni učno uro").disabled).toBe(false);
    await act(async () => button("Začni učno uro").click());
    expect(mocks.persist).toHaveBeenCalledWith("kid", topic.meta.id, expect.objectContaining({ params: expect.objectContaining({ topicContentLanguage: "sl" }) }));
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
  expect(restoreActiveSessionState(snapshot, { ...context, languageContext: { ...state.languageContext, contentVersion: "0.99.0" } })).toBeNull();
});

it("imports the actual ZIP without altering original topic, files or progress", async () => {
  const db = await openDb(`language-pilot-${Math.random()}`);
  const original = { id: "comparison", meta: { id: "comparison", renderer: "comparison", version: "2.37.0" }, modes: [], cards: [] };
  await kv.set(db, "topic:comparison", original);
  await topics.saveFile(db, "comparison", "renderer", new Blob(["original renderer"]));
  const links = { kid_comparison: { params: { level: 4 }, correct: 42 } };
  const progress = { kid_comparison_compare_easy: { correct: 17 } };
  const history = [{ id: "previous", topicId: "comparison", correctCount: 12 }];
  await kv.set(db, "studentTopicLinks", links);
  await kv.set(db, "conceptProgress", progress);
  await kv.set(db, "sessions", history);
  const bytes = await readFile(resolve("public/decks/comparison_language_pilot_v0.4.0.zip"));
  await importTopic(db, bytes, "1.0.2675");
  const installed = await getTopicRecord(db, topic.meta.id);
  expect(installed.modes).toHaveLength(2);
  expect(installed.languageResources.content.sl).toBeUndefined();
  expect(Object.keys(installed.languageContract.packages)).toEqual(["ru", "sl"]);
  expect(installed.meta.title.sl).toBe(topic.meta.title.sl);
  expect(await kv.get(db, "topic:comparison")).toEqual(original);
  expect(await (await topics.getFile(db, "comparison", "renderer")).text()).toBe("original renderer");
  expect(await kv.get(db, "studentTopicLinks")).toEqual(links);
  expect(await kv.get(db, "conceptProgress")).toEqual(progress);
  expect(await kv.get(db, "sessions")).toEqual(history);
  const invalidZip = await JSZip.loadAsync(bytes);
  invalidZip.remove("ui/sl.json");
  await expect(importTopic(db, await invalidZip.generateAsync({ type: "arraybuffer" }), "1.0.2675")).rejects.toThrow(/missing file/);
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
    (t) => { t.languageContract.packages.sl.modeIds = ["not_a_mode"]; },
    (t) => { t.languageContract.packages.sl.file = "/content/sl.json"; },
  ]) {
    const invalid = structuredClone(topic); change(invalid);
    expect(() => validateTopicLanguages(invalid)).toThrow(/Topic language contract/);
  }
});

describe("crocodile mode", () => {
  for (const uiLanguage of ["ru", "sl"]) for (const contentLanguage of ["ru", "sl"]) {
    it(`${uiLanguage} UI / ${contentLanguage} lesson in the second mode`, async () => {
      setUiLanguage(uiLanguage);
      useAppStore.setState({ activeStudentId: "kid", activeTopicId: topic.meta.id, activeModeId: signMode.id, activeTextId: null,
        students: [{ id: "kid", name: "Миша" }], topicRecords: [topic], sessions: [],
        settings: { ...originalStore.settings, cardLanguage: "ru" },
        studentTopicLinks: { kid_comparison_language_pilot: { params: { byMode: { compare_sign: { contentLanguage } } } } },
        screen: "params", sessionReturnScreen: null });
      await act(async () => root.render(<ParamsScreen />));
      expect(host.querySelector("h1").textContent).toBe(uiLanguage === "ru" ? "Крокодил · сравни числа" : "Krokodil · primerjaj števili");
      expect(host.textContent).toContain(uiLanguage === "ru" ? "Большее число" : "Večje število");
      const params = { contentLanguage, question: "more" };
      const context = createContentContext(topic, signMode, params);
      const task = generateTasks(signMode, topic.cards, 1, params, context, topic.languageResources.content[contentLanguage])[0];
      await act(async () => root.render(<CompareSign task={task} sessionStatus="task_active" onCorrect={() => {}} onIncorrect={() => {}} />));
      const instruction = host.querySelector(".pilot-compare-instruction").textContent;
      expect(instruction).toBe(contentLanguage === "ru" ? "Нажми на большее число" : "Pritisni na večje število.");
      expect(host.querySelector("[lang]").lang).toBe(contentLanguage);
      await act(async () => setUiLanguage(uiLanguage === "ru" ? "sl" : "ru"));
      expect(host.querySelector(".pilot-compare-instruction").textContent).toBe(instruction);
    });
  }

  for (const [left, right, question, picked] of [[9, 2, "more", 0], [9, 2, "less", 1], [2, 9, "more", 1], [2, 9, "less", 0], [5, 5, "equal", 2]]) {
    it(`scores ${left}/${right}/${question} and opens the mouth towards the larger number`, async () => {
      const context = createContentContext(topic, signMode, { contentLanguage: "sl" });
      const template = generateTasks(signMode, topic.cards, 1, {}, context, topic.languageResources.content.sl)[0];
      const task = { ...template, left, right, question };
      const correct = vi.fn(), incorrect = vi.fn();
      const render = (status, key = 0) => root.render(<CompareSign key={key} task={task} sessionStatus={status} onCorrect={correct} onIncorrect={incorrect} />);
      await act(async () => render("task_active"));
      const target = picked === 2 ? host.querySelector(".pilot-croc-tap-btn") : host.querySelectorAll(".pilot-compare-side")[picked];
      await act(async () => { target.click(); target.click(); });
      expect(correct).toHaveBeenCalledExactlyOnceWith("pilot_sign", null);
      expect(incorrect).not.toHaveBeenCalled();
      await act(async () => render("answer_correct"));
      const croc = host.querySelector(".pilot-compare-croc-area > div");
      if (left === right) expect(croc.querySelector("g").style.transform).toBe("translateY(-13px)");
      else expect(croc.style.transform).toBe(left > right ? "scaleX(-1)" : "none");
      expect(host.querySelector(".pilot-compare-verdict").textContent).toBe(task.verdictText);
    });
  }

  it("allows a correct retry after an incorrect choice without changing lesson language", async () => {
    const context = createContentContext(topic, signMode, { contentLanguage: "sl" });
    const template = generateTasks(signMode, topic.cards, 1, {}, context, topic.languageResources.content.sl)[0];
    const task = { ...template, left: 9, right: 2, question: "less" };
    const correct = vi.fn(), incorrect = vi.fn();
    const render = (key) => root.render(<CompareSign key={key} task={task} sessionStatus="task_active" onCorrect={correct} onIncorrect={incorrect} />);
    await act(async () => render(0));
    await act(async () => host.querySelectorAll(".pilot-compare-side")[0].click());
    expect(incorrect).toHaveBeenCalledOnce();
    expect(correct).not.toHaveBeenCalled();
    expect(host.querySelector(".pilot-compare-verdict")).toBeNull();
    await act(async () => render(1));
    await act(async () => host.querySelectorAll(".pilot-compare-side")[1].click());
    expect(correct).toHaveBeenCalledOnce();
    expect(host.querySelector("[lang]").lang).toBe("sl");
  });

  it("retains the original number/question generation in both language packs", () => {
    for (const language of ["ru", "sl"]) for (const level of [1, 2, 3, 4]) for (const question of ["more", "less", "mix"]) for (const showEqual of [false, true]) {
      const params = { contentLanguage: language, level, question, showEqual };
      const random = vi.spyOn(Math, "random").mockImplementation(seedRandom());
      const projection = (tasks) => tasks.map(({ left, right, question }) => ({ left, right, question }));
      const expected = projection(originalTasks(signMode, topic.cards, 40, params));
      random.mockImplementation(seedRandom());
      const context = createContentContext(topic, signMode, params);
      const tasks = generateTasks(signMode, topic.cards, 40, params, context, topic.languageResources.content[language]);
      expect(projection(tasks)).toEqual(expected);
      expect(tasks.every((t) => t.conceptId === "pilot_sign" && t.languageContext.contentLanguage === language)).toBe(true);
      random.mockRestore();
    }
  });

  it("reads only the crocodile mode's declared lesson messages", () => {
    for (const language of ["ru", "sl"]) {
      const params = { contentLanguage: language, question: "mix", showEqual: true };
      const context = createContentContext(topic, signMode, params);
      const fullPack = topic.languageResources.content[language];
      const pack = { ...fullPack, messages: Object.fromEntries(signMode.contentKeys.map((key) => [key, fullPack.messages[key]])) };
      const tasks = generateTasks(signMode, topic.cards, 40, params, context, pack);
      expect(tasks).toHaveLength(40);
      expect(tasks.filter((t) => t.question === "equal")).toHaveLength(12);
      expect(tasks.every((t) => t.crocTip && t.equalHint === null)).toBe(true);
    }
  });
});

it("upgrades the actual 0.1 ZIP without losing visual settings or sharing them with the new mode", async () => {
  const db = await openDb(`pilot-upgrade-${Math.random()}`);
  const oldBytes = await readFile(resolve("test-fixtures/decks/comparison_language_pilot_v0.1.0.zip"));
  await importTopic(db, oldBytes, "1.0.2675");
  const legacy = { contentLanguage: "sl", level: 4, question: "less", showEqual: true, visualMode: "numbers" };
  const links = { kid_comparison_language_pilot: { params: legacy } };
  const history = [{ id: "previous", topicId: topic.meta.id, modeId: "compare_visual", conceptIds: ["pilot_visual"] }];
  await kv.set(db, "studentTopicLinks", links);
  await kv.set(db, "sessions", history);
  await importTopic(db, await readFile(resolve("public/decks/comparison_language_pilot_v0.4.0.zip")), "1.0.2675");
  expect(await kv.get(db, "studentTopicLinks")).toEqual(links);
  expect(await kv.get(db, "sessions")).toEqual(history);
  const { contentLanguage: ignoredLanguage, ...visualSettings } = legacy;
  void ignoredLanguage;
  expect(readModeParams(legacy, mode)).toEqual(visualSettings);
  expect(readModeParams(legacy, signMode)).toEqual({ level: 2, question: "more", showEqual: false });
  const signParams = { contentLanguage: "ru", level: 2, question: "more", showEqual: false };
  const first = writeModeParams(legacy, signMode, signParams);
  expect(readModeParams(first, mode)).toEqual(visualSettings);
  const second = writeModeParams(first, mode, { ...legacy, level: 3 });
  expect(readModeParams(second, signMode)).toEqual(signParams);
  expect(readModeParams(second, mode)).toEqual({ ...legacy, level: 3 });
  expect(readModeParams(second, mode)).not.toHaveProperty("byMode");
  for (const m of topic.modes) {
    expect(getConceptCards(topic, m).map((c) => c.id)).toEqual([m.defaultCardId]);
    const selected = resolveModeSelection(topic, m, { params: second }, false, null);
    expect(selected.selectedConceptIds).toEqual([m.defaultCardId]);
  }
  db.close();
});


for (const contentLanguage of ["ru", "sl"]) for (const soundEnabled of [true, false]) {
  it(`${contentLanguage} recorded feedback follows the pinned material, sound=${soundEnabled}`, async () => {
    const context = createContentContext(topic, signMode, { contentLanguage });
    const task = generateTasks(signMode, topic.cards, 1, { question: "more" }, context, topic.languageResources.content[contentLanguage])[0];
    const playTopicFile = vi.fn(), onIncorrect = vi.fn();
    await act(async () => root.render(<Pilot mode={signMode} topicId={topic.meta.id} task={task} sessionStatus="task_active" soundEnabled={soundEnabled} playTopicFile={playTopicFile} onCorrect={vi.fn()} onIncorrect={onIncorrect} />));
    const wrong = task.left < task.right ? 0 : 1;
    await act(async () => host.querySelectorAll('.pilot-compare-side')[wrong].click());
    expect(onIncorrect).toHaveBeenCalledTimes(1);
    if (contentLanguage === "ru" && soundEnabled) expect(playTopicFile).toHaveBeenCalledWith(topic.meta.id, "content/ru/0.4.0/retry.mp3");
    else expect(playTopicFile).not.toHaveBeenCalled();
  });
}
