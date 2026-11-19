import { readFileSync } from "node:fs";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { getDb } from "@/core/db";
import { recordTaskAssessment, handleAnswer } from "@/features/session/sessionEngine";
import { buildGeneratedSessionState, resolveModeSelection } from "@/features/session/useSessionEngine";
import { deriveConcepts } from "@/shared/utils/topicUtils";
import { EMOTIONS_TOPIC_ID, emotionCardGender } from "@/topics/emotionsContent";
import { importTopic, getTopicRecord } from "@/topics/topicLoader";
import { generateTasks } from "./engine";
import FlashcardsRenderer from "./index";

const catalog = JSON.parse(readFileSync("public/decks/catalog.json", "utf8"));
const entry = catalog.decks.find(({ id }) => id === EMOTIONS_TOPIC_ID);
let record;
let root;
let container;

beforeAll(async () => {
  const db = await getDb();
  await importTopic(db, readFileSync(`public/${entry.url.slice(2)}`), "1.1.154");
  record = await getTopicRecord(db, EMOTIONS_TOPIC_ID);
});

afterEach(() => {
  if (root) act(() => root.unmount());
  container?.remove();
  root = null;
});

function tasks(type, params = {}, conceptId) {
  const concepts = deriveConcepts(record.cards).filter((concept) => !conceptId || concept.conceptId === conceptId);
  return generateTasks(type, concepts, record.cards, params, null, EMOTIONS_TOPIC_ID);
}

function startMode(modeId, selectedConceptIds = []) {
  const mode = record.modes.find(({ id }) => id === modeId);
  const link = { selectedConceptIds };
  const selection = resolveModeSelection(record, mode, link, false);
  return buildGeneratedSessionState({
    topicRecord: record, mode, activeTopicId: EMOTIONS_TOPIC_ID, activeStudentId: "child",
    activeStudent: { id: "child" }, link, ...selection,
  });
}

function render(task, callbacks = {}) {
  if (!root) {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  }
  act(() => root.render(<FlashcardsRenderer key={task.card?.id ?? task.sceneId ?? task.type} task={task} topicId={EMOTIONS_TOPIC_ID} {...callbacks} />));
}

const question = () => container.querySelector("h1").textContent;
const choices = () => [...container.querySelectorAll(".emotion-lesson__option")];
function control(text) {
  return [...container.querySelectorAll(".emotion-lesson__controls button")].find((button) => button.textContent === text);
}

describe("published tablet emotion lesson", () => {
  it("re-imports all nine modes with their own settings and gender on all sixty cards", () => {
    expect(record.cards).toHaveLength(60);
    expect(record.modes).toHaveLength(9);
    for (const card of record.cards) {
      expect(["male", "female"]).toContain(card.gender);
      expect(emotionCardGender({ image: card.image, sceneImage: card.sceneImage })).toBe(card.gender);
    }
    expect(startMode("find_n").tasks.every((task) => task.options.length === 2)).toBe(true);
    const facets = startMode("choose_all", ["joy"]).tasks;
    expect(facets.every((task) => task.allCards.length === 4 && task.targetCardIds.length === 2)).toBe(true);
    expect(new Set(facets.flatMap((task) => task.targetCardIds)).size).toBe(3);
    expect(startMode("choose_word_by_picture", ["joy"]).tasks.every((task) => task.options.length === 4)).toBe(true);
    expect(startMode("question_answer").tasks.every((task) => task.options.length === 3)).toBe(true);
    expect(startMode("situation_emotion", ["shame"]).tasks.length).toBeGreaterThan(0);
  });

  it("agrees with the exact girl or boy portrait in oral and yes/no tasks", () => {
    const variants = tasks("emotion_control", {}, "joy");
    const girl = variants.find(({ card }) => card.id === "joy_2");
    const boy = variants.find(({ card }) => card.id === "joy_1");
    const onRecordAssessment = vi.fn();
    const onCorrect = vi.fn();
    render(girl, { onRecordAssessment, onCorrect });
    expect(question()).toBe("Что она чувствует?");
    expect(choices()).toHaveLength(0);
    const selector = container.querySelector("select");
    act(() => {
      selector.value = "independent";
      selector.dispatchEvent(new Event("change", { bubbles: true }));
    });
    act(() => control("Показать варианты").click());
    expect(choices()).toHaveLength(3);
    expect(onRecordAssessment).toHaveBeenCalledExactlyOnceWith("independent", "joy", "joy_2");
    expect(onCorrect).not.toHaveBeenCalled();
    act(() => choices().find((button) => button.textContent === "радость").click());
    expect(onCorrect).toHaveBeenCalledExactlyOnceWith("joy", "joy_2");
    render(boy);
    expect(question()).toBe("Что он чувствует?");
    expect(choices()).toHaveLength(0);

    render({ ...girl, type: "yes_no", displayConceptId: "joy", isLabelCorrect: true });
    expect(question()).toBe("Она радуется?");
    render({ ...boy, type: "yes_no", displayLabel: "скуку", isLabelCorrect: false });
    expect(question()).toBe("Он скучает?");
  });

  it("uses the scene child for the prompt, reveals two matching-gender portraits on request and keeps the stage after a miss", () => {
    const variants = tasks("situation_emotion", { taskCount: 12 }, "sadness");
    const girl = variants.find(({ sceneId }) => sceneId === "situation_sadness_1");
    const boy = variants.find(({ sceneId }) => sceneId === "situation_sadness_2");
    const onStreakReset = vi.fn();
    render(girl, { onStreakReset });
    expect(question()).toBe("Что она чувствует?");
    expect(choices()).toHaveLength(0);
    expect(container.querySelector("details").open).toBe(false);
    act(() => control("Показать варианты").click());
    expect(choices()).toHaveLength(2);
    expect(girl.options.every(({ card }) => emotionCardGender(card) === "female")).toBe(true);
    act(() => choices()[girl.options.findIndex(({ isTarget }) => !isTarget)].click());
    expect(onStreakReset).toHaveBeenCalledOnce();
    expect(choices()).toHaveLength(2);
    expect(question()).toBe("Что она чувствует?");
    render(boy);
    expect(question()).toBe("Что он чувствует?");
    expect(choices()).toHaveLength(0);
  });

  it("uses just the question and two scenes in reverse and keeps deferred material out of lessons", () => {
    const reverse = tasks("emotion_situation", { taskCount: 20 }, "sadness")[0];
    render(reverse);
    expect(question()).toBe("Где ребёнку грустно?");
    expect(container.querySelector(".emotion-lesson__stimulus")).toBeNull();
    expect(choices()).toHaveLength(2);
    expect(tasks("situation_emotion", { taskCount: 30 })).toHaveLength(12);
    expect(tasks("situation_intro", { taskCount: 30 })).toHaveLength(21);
    expect(tasks("situation_intro", { taskCount: 30 }).find(({ sceneId }) => sceneId === "situation_shame_3").discussion).toBe(true);
  });

  it("keeps the separate oral assessment on the current trial without awarding a choice result", () => {
    const state = startMode("question_answer", ["joy"]);
    const { card } = state.tasks[0];
    const oral = recordTaskAssessment(state, "prompted", card.conceptId, card.id);
    expect(oral.taskIndex).toBe(state.taskIndex);
    expect(oral.correctCount).toBe(0);
    expect(oral.assessments).toEqual([{ quality: "prompted", conceptId: card.conceptId, cardId: card.id, taskIndex: 0 }]);
    const selected = handleAnswer(oral, true, card.conceptId, card.id);
    expect(selected.correctCount).toBe(1);
    expect(selected.assessments).toEqual(oral.assessments);
  });
});
