import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, afterEach, vi } from "vitest";
import FlashcardsRenderer from "./index.jsx";
import { generateTasks } from "./engine.js";
import { deriveConcepts } from "@/shared/utils/topicUtils";

const CARDS = [
  { id: "eats_1", conceptId: "eats", primary: true, label: "ест", image: "media/eats_1.webp", audio: { ru: "audio/eats.mp3" }, promptAudio: { ru: "audio/eats.mp3" }, imperative: "Ешь!" },
  { id: "eats_2", conceptId: "eats", primary: false, label: "ест", image: "media/eats_2.webp", audio: { ru: "audio/eats.mp3" }, promptAudio: { ru: "audio/eats.mp3" }, imperative: "Ешь!" },
  { id: "sleeps_1", conceptId: "sleeps", primary: true, label: "спит", image: "media/sleeps_1.webp", audio: { ru: "audio/sleeps.mp3" }, promptAudio: { ru: "audio/sleeps.mp3" }, imperative: "Спи!" },
  { id: "runs_1", conceptId: "runs", primary: true, label: "бежит", image: "media/runs_1.webp", audio: { ru: "audio/runs.mp3" }, promptAudio: { ru: "audio/runs.mp3" }, imperative: "Беги!" },
];
const CONCEPTS = deriveConcepts(CARDS);
const FIND_MODE = { type: "find_n", ui: { promptTemplate: "Покажи: {label}" } };

describe("verbs_v2 ladder — mounted through the real renderer", () => {
  let container = null;
  let root = null;

  afterEach(() => {
    if (root) act(() => root.unmount());
    if (container) container.remove();
    root = null; container = null;
  });

  function mount(props) {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(<FlashcardsRenderer soundEnabled={false} playTopicFile={() => {}} onCorrect={() => {}} onIncorrect={() => {}} {...props} />);
    });
  }

  function options() {
    return [...container.querySelectorAll(".find-n-option")];
  }

  function findTask(optionCount) {
    const eats = CONCEPTS.filter((c) => c.conceptId === "eats");
    const tasks = generateTasks("find_n", CONCEPTS, CARDS, { optionCount, distractorLevel: "easy" })
      .filter((t) => t.targetConceptId === eats[0].conceptId);
    return tasks[0];
  }

  it("frames the target word with the mode's prompt template", () => {
    mount({ task: findTask(2), mode: FIND_MODE });
    expect(container.querySelector(".session-instruction").textContent).toBe("Покажи: ест");
  });

  it("errorless: a miss is recorded once, lights the right picture, and finishing counts as assisted", () => {
    const onCorrect = vi.fn();
    const onIncorrect = vi.fn();
    const onStreakReset = vi.fn();
    const task = findTask(2);
    mount({ task, mode: FIND_MODE, sessionParams: { errorless: true }, onCorrect, onIncorrect, onStreakReset });

    const wrongIndex = task.options.findIndex((o) => !o.isTarget);
    const rightIndex = task.options.findIndex((o) => o.isTarget);
    act(() => options()[wrongIndex].click());
    expect(onStreakReset).toHaveBeenCalledTimes(1);
    expect(onIncorrect).not.toHaveBeenCalled();
    expect(options()[rightIndex].className).toContain("find-n-option--hint");
    expect(options()[wrongIndex].className).toContain("find-n-option--faded");
    expect(options()[wrongIndex].disabled).toBe(true);

    act(() => options()[rightIndex].click());
    expect(onCorrect).toHaveBeenCalledWith("eats", task.options[rightIndex].card.id, { assisted: true });
  });

  it("errorless: a first-try hit is an ordinary correct answer", () => {
    const onCorrect = vi.fn();
    const task = findTask(2);
    mount({ task, mode: FIND_MODE, sessionParams: { errorless: true }, onCorrect });
    act(() => options()[task.options.findIndex((o) => o.isTarget)].click());
    expect(onCorrect).toHaveBeenCalledWith("eats", expect.any(String), undefined);
  });

  it("errorless with a single picture never scores it as a free correct answer", () => {
    const onCorrect = vi.fn();
    const task = findTask(1);
    expect(task.options).toHaveLength(1);
    mount({ task, mode: FIND_MODE, sessionParams: { errorless: true }, onCorrect });
    act(() => options()[0].click());
    expect(onCorrect).toHaveBeenCalledWith("eats", expect.any(String), { assisted: true });
  });

  it("without errorless a miss still goes through onIncorrect", () => {
    const onIncorrect = vi.fn();
    const task = findTask(2);
    mount({ task, mode: FIND_MODE, onIncorrect });
    act(() => options()[task.options.findIndex((o) => !o.isTarget)].click());
    expect(onIncorrect).toHaveBeenCalledTimes(1);
  });

  it("act_out: voice first, no picture until the adult asks for it", () => {
    vi.useFakeTimers();
    const onQualityAnswer = vi.fn();
    const playTopicFile = vi.fn();
    const cards = CARDS.map((c) => ({ ...c, imperativeAudio: { ru: `audio/imp_${c.conceptId}.mp3` } }));
    const [task] = generateTasks("act_out", deriveConcepts(cards).filter((c) => c.conceptId === "runs"), cards, {});
    mount({ task, mode: { type: "act_out" }, onQualityAnswer, soundEnabled: true, playTopicFile, topicId: "verbs_v2" });
    expect(playTopicFile).toHaveBeenCalledWith("verbs_v2", "audio/imp_runs.mp3");
    expect(container.querySelector(".card-img")).toBeNull();
    expect(container.querySelector(".diktor")).not.toBeNull();
    expect([...container.querySelectorAll(".rating-btn")].map((b) => b.textContent)).toEqual(["Не понимает", "С подсказкой", "Легко"]);
    act(() => container.querySelector(".act-out-hint").click());
    expect(container.querySelector(".act-out-hint")).toBeNull();
    act(() => [...container.querySelectorAll(".rating-btn")][1].click());
    act(() => vi.runAllTimers());
    expect(onQualityAnswer).toHaveBeenCalledWith("prompted", "runs", "runs_1");
    expect(playTopicFile).toHaveBeenCalledTimes(1); // no third-person word afterwards
    vi.useRealTimers();
  });

  it("question_answer with ui.rating three: labelled buttons, «Легко» rates easy", () => {
    vi.useFakeTimers();
    const onQualityAnswer = vi.fn();
    const [task] = generateTasks("question_answer", CONCEPTS.filter((c) => c.conceptId === "runs"), CARDS, {});
    mount({ task, mode: { type: "question_answer", ui: { instruction: "Что делает?", rating: "three" } }, onQualityAnswer });
    expect([...container.querySelectorAll(".rating-btn")].map((b) => b.textContent)).toEqual(["Не ответил", "С подсказкой", "Легко"]);
    expect(container.querySelector(".qa-legend")).toBeNull();
    act(() => [...container.querySelectorAll(".rating-btn")][2].click());
    act(() => vi.runAllTimers());
    expect(onQualityAnswer).toHaveBeenCalledWith("easy", "runs", "runs_1");
    vi.useRealTimers();
  });

  it("question_answer elsewhere keeps the four numbered buttons", () => {
    const [task] = generateTasks("question_answer", CONCEPTS.filter((c) => c.conceptId === "runs"), CARDS, {});
    mount({ task, mode: { type: "question_answer", ui: { instruction: "Что делает?" } } });
    expect(container.querySelectorAll(".qa-btn")).toHaveLength(4);
  });

  it("choose_all uses the template and says the word when the grid appears", () => {
    const playTopicFile = vi.fn();
    const [task] = generateTasks("choose_all", CONCEPTS.filter((c) => c.conceptId === "eats"), CARDS, { optionCount: 4 });
    mount({ task, mode: { type: "choose_all", ui: { promptTemplate: "Найди все: {label}", autoplayPrompt: true } }, soundEnabled: true, playTopicFile, topicId: "verbs_v2" });
    expect(container.querySelector(".choose-all-instruction strong").textContent).toBe("Найди все: ест");
    expect(playTopicFile).toHaveBeenCalledWith("verbs_v2", "audio/eats.mp3");
  });

  it("choose_all stays silent for topics that don't opt in", () => {
    const playTopicFile = vi.fn();
    const [task] = generateTasks("choose_all", CONCEPTS.filter((c) => c.conceptId === "eats"), CARDS, { optionCount: 4 });
    mount({ task, mode: { type: "choose_all" }, soundEnabled: true, playTopicFile, topicId: "x" });
    expect(container.querySelector(".choose-all-instruction").textContent).toContain("Найди все:");
    expect(playTopicFile).not.toHaveBeenCalled();
  });
});
