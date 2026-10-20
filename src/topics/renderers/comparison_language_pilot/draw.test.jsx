import { act } from "react";
import { createRoot } from "react-dom/client";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { loadTopicLanguages, createContentContext } from "../../../../shared/topic-language-contract.mjs";
import { generateTasks as originalTasks } from "../comparison/engine.js";
import { recognizeSign as originalRecognize } from "../comparison/signRecognition.js";
import { recognizeSign } from "./signRecognition.js";
import { generateTasks } from "./engine.js";
import Pilot from "./index.jsx";
import { readModeParams, writeModeParams, getConceptCards } from "@/shared/utils/topicUtils";
import { setUiLanguage } from "@/shared/i18n/uiLanguage.js";

const base = resolve("tools/comparison_language_pilot");
const raw = JSON.parse(await readFile(resolve(base, "topic.json"), "utf8"));
const topic = await loadTopicLanguages(raw, (path) => readFile(resolve(base, path), "utf8"));
const mode = topic.modes.find((m) => m.id === "compare_draw_sign");
const shapes = { "<": [[[240, 45], [60, 150], [240, 255]]], ">": [[[60, 45], [240, 150], [60, 255]]], "=": [[[60, 100], [150, 100], [240, 100]], [[60, 200], [150, 200], [240, 200]]], "?": [[[80, 50], [100, 100], [120, 150]]] };
let root, host;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(Object.fromEntries(["setTransform", "save", "restore", "clearRect", "beginPath", "moveTo", "lineTo", "stroke"].map((key) => [key, vi.fn()])));
  vi.spyOn(HTMLCanvasElement.prototype, "getBoundingClientRect").mockReturnValue({ left: 0, top: 0, width: 300, height: 300 });
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); vi.restoreAllMocks(); setUiLanguage("ru"); });

function seeded() { let seed = 42; return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; }
function makeTask(language, left, right) {
  const context = createContentContext(topic, mode, { contentLanguage: language });
  const pack = topic.languageResources.content[language];
  const task = generateTasks(mode, topic.cards, 1, {}, context, pack)[0];
  return { ...task, left, right };
}
async function draw(sign, finish = true) {
  const canvas = host.querySelector("canvas");
  for (const points of shapes[sign]) {
    const send = (type, p) => canvas.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: p[0], clientY: p[1] }));
    await act(async () => send("pointerdown", points[0]));
    for (const p of points.slice(1)) await act(async () => send("pointermove", p));
    await act(async () => send("pointerup", points.at(-1)));
    if (sign === "=") await act(async () => vi.advanceTimersByTime(150));
  }
  if (finish) await act(async () => vi.advanceTimersByTime(701));
}

it("keeps the original pair generation and isolated mode settings/cards", () => {
  for (const level of [1, 2, 3, 4]) for (const showEqual of [false, true]) {
    const random = vi.spyOn(Math, "random").mockImplementation(seeded());
    const expected = originalTasks(mode, topic.cards, 40, { level, showEqual }).map(({ left, right }) => [left, right]);
    random.mockImplementation(seeded());
    const context = createContentContext(topic, mode, { contentLanguage: "sl" });
    const actual = generateTasks(mode, topic.cards, 40, { level, showEqual }, context, topic.languageResources.content.sl);
    expect(actual.map(({ left, right }) => [left, right])).toEqual(expected);
    if (showEqual) expect(actual.filter((t) => t.left === t.right)).toHaveLength(12);
    random.mockRestore();
  }
  const old = { topicContentLanguage: "sl", byMode: { compare_visual: { level: 4 }, compare_sign: { level: 3 } } };
  expect(readModeParams(old, mode)).toEqual({ level: 2, showEqual: false });
  const next = writeModeParams(old, mode, { level: 1, showEqual: true });
  expect(next.byMode.compare_visual).toEqual(old.byMode.compare_visual);
  expect(next.byMode.compare_sign).toEqual(old.byMode.compare_sign);
  expect(getConceptCards(topic, mode).map((c) => c.id)).toEqual(["pilot_draw"]);
  expect(mode.params).not.toHaveProperty("question");
  expect(mode.params).not.toHaveProperty("contentLanguage");
});

it("keeps original recognition, including shaky and ambiguous gestures", () => {
  for (const lines of Object.values(shapes)) {
    const strokes = lines.map((line) => line.map(([x, y]) => ({ x, y })));
    expect(recognizeSign(strokes)).toBe(originalRecognize(strokes));
  }
  const random = seeded();
  for (let n = 0; n < 100; n++) {
    const strokes = [Array.from({ length: 8 }, () => ({ x: random() * 300, y: random() * 300 }))];
    expect(recognizeSign(strokes)).toBe(originalRecognize(strokes));
  }
});

for (const language of ["ru", "sl"]) for (const [sign, left, right] of [["<", 3, 7], [">", 9, 2], ["=", 5, 5]]) {
  it(`${language}: accepts drawn ${sign} once, with the material's canvas label`, async () => {
    const task = makeTask(language, left, right), correct = vi.fn(), incorrect = vi.fn();
    await act(async () => root.render(<Pilot topicId={topic.meta.id} mode={mode} task={task} sessionStatus="task_active" onCorrect={correct} onIncorrect={incorrect} />));
    expect(host.querySelector("[lang]").lang).toBe(language);
    expect(host.querySelector("canvas").getAttribute("aria-label")).toBe(topic.languageResources.content[language].messages["draw.canvasLabel"]);
    await draw(sign); await draw(sign);
    expect(correct).toHaveBeenCalledTimes(1); expect(incorrect).not.toHaveBeenCalled();
  });
}

it("wrong/ambiguous signs count once, and retry remount unlocks the canvas", async () => {
  const task = makeTask("ru", 3, 7), correct = vi.fn(), incorrect = vi.fn(), playTopicFile = vi.fn();
  const render = (key) => root.render(<Pilot key={key} topicId={topic.meta.id} mode={mode} task={task} sessionStatus="task_active" soundEnabled playTopicFile={playTopicFile} onCorrect={correct} onIncorrect={incorrect} />);
  await act(async () => render(0)); await draw("?"); await draw(">");
  expect(incorrect).toHaveBeenCalledTimes(1);
  expect(playTopicFile).toHaveBeenCalledWith(topic.meta.id, "content/ru/0.5.0/retry.mp3");
  await act(async () => render(1)); await draw("<"); expect(correct).toHaveBeenCalledTimes(1);
});

it("cancels pending recognition on pause/unmount and discards cancelled pointer strokes", async () => {
  const task = makeTask("sl", 3, 7), correct = vi.fn(), incorrect = vi.fn();
  const render = (status) => root.render(<Pilot topicId={topic.meta.id} mode={mode} task={task} sessionStatus={status} onCorrect={correct} onIncorrect={incorrect} />);
  await act(async () => render("task_active")); await draw("<", false);
  await act(async () => render("paused")); await act(async () => vi.advanceTimersByTime(1000));
  expect(correct).not.toHaveBeenCalled();
  await act(async () => render("task_active")); await draw("<", false);
  await act(async () => host.querySelector("canvas").dispatchEvent(new MouseEvent("pointercancel", { bubbles: true })));
  await act(async () => vi.advanceTimersByTime(1000)); expect(correct).not.toHaveBeenCalled(); expect(incorrect).not.toHaveBeenCalled();
  await draw("<", false); await act(async () => root.render(null)); await act(async () => vi.advanceTimersByTime(1000));
  expect(correct).not.toHaveBeenCalled(); expect(incorrect).not.toHaveBeenCalled();
});

it("drawing instruction and ordered verdict depend only on the selected pack", () => {
  for (const language of ["ru", "sl"]) {
    const pack = topic.languageResources.content[language], context = createContentContext(topic, mode, { contentLanguage: language });
    const a = generateTasks(mode, topic.cards, 100, { showEqual: true }, context, pack);
    for (const task of a) {
      expect(task.instruction).toBe(pack.messages["prompt.draw"]);
      expect(task.equalHint).toBeNull();
      const relation = task.left === task.right ? "equal" : task.left > task.right ? "more" : "less";
      expect(task.verdictText).toBe(pack.messages[`verdict.draw.${relation}`].replace("{{left}}", task.left).replace("{{right}}", task.right));
      expect(task.retryAudio).toBe(language === "ru" ? "content/ru/0.5.0/retry.mp3" : null);
    }
  }
});
