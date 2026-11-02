import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { readFile } from "node:fs/promises";
import JSZip from "jszip";
import { describe, expect, it, vi } from "vitest";
import { generateTasks } from "./engine";
import { getSelectedReadingStories, mergeStoryQuizText, parseStoryQuizText, validateStoryQuizText } from "./storyQuiz";
import ReadingRenderer from "./index";

vi.mock("@/shared/hooks/useTopicFile", () => ({ useTopicFile: (_topic, path) => path ? `/preview/${path}` : null }));
const zip = await JSZip.loadAsync(await readFile("public/decks/reading_short_stories_v2.0.1.zip"));
const topic = JSON.parse(await zip.file("topic.json").async("string"));
const micro = topic.texts.filter((story) => story.storyStage === "micro");
const findTasks = generateTasks({ type: "story_quiz" }, topic, micro[0].id, {});

describe("micro-story content and staircase", () => {
  it("starts with exactly 15 short stories and keeps legacy selection separate", () => {
    expect(getSelectedReadingStories(topic)).toHaveLength(15);
    expect(getSelectedReadingStories(topic, { storyStage: "extended" })).toHaveLength(12);
    expect(getSelectedReadingStories(topic, { selectedStories: ["help_mommy"] })).toHaveLength(15);
    expect(getSelectedReadingStories(topic, { selectedMicroStories: ["micro_book", "micro_ball"] }).map((story) => story.id))
      .toEqual(["micro_ball", "micro_book"]);
    expect(new Set(topic.texts.map((story) => story.title.ru)).size).toBe(27);
  });

  it("ships 60 questions, a name first, valid normal and syllable targets, and 30 real frames", () => {
    expect(findTasks).toHaveLength(60);
    const stories = topic.texts.map((story) => ({ ...story, title: story.title.ru }));
    expect(validateStoryQuizText(topic.storyQuiz.defaultText, stories, micro.map((story) => story.id)).errors).toEqual([]);
    const syllableStories = stories.map((story) => ({ ...story, lines: story.lines.map((line) => ({ text: line.syllableText ?? line.text })) }));
    expect(validateStoryQuizText(topic.storyQuiz.defaultText, syllableStories, micro.map((story) => story.id)).valid).toBe(true);
    const files = [];
    for (const story of micro) {
      expect(story.lines.length).toBeGreaterThanOrEqual(4);
      expect(story.lines.length).toBeLessThanOrEqual(5);
      expect(story.lines[0].text.startsWith(`${story.character} `)).toBe(true);
      expect(story.images).toHaveLength(2);
      for (const frame of story.images) {
        expect(zip.file(frame.file), frame.file).not.toBeNull();
        expect(frame.crop.left).toBeGreaterThanOrEqual(0);
        expect(frame.crop.top).toBeGreaterThanOrEqual(0);
        expect(frame.crop.left + frame.crop.width).toBeLessThanOrEqual(1);
        expect(frame.crop.top + frame.crop.height).toBeLessThanOrEqual(1);
        files.push(frame.file);
      }
      const tasks = findTasks.filter((task) => task.textId === story.id);
      expect(tasks).toHaveLength(4);
      expect(tasks[0].question.prompt).toMatch(/^Как зовут (мальчика|девочку)\?$/);
      expect(tasks[0].question.target).toBe(story.character);
      expect(tasks[3]).toMatchObject({ type: "story_quiz_discuss", expectedAnswer: story.discussionAnswer });
    }
    expect(new Set(files).size).toBe(30);
  });

  it("rejects deleting or replacing the required first name question", () => {
    const changed = topic.storyQuiz.defaultText.replace("? Как зовут мальчика?\n+ Вова", "? Что Вова достал?\n+ мяч");
    const result = validateStoryQuizText(changed, topic.texts.map((story) => ({ ...story, title: story.title.ru })), ["micro_ball"]);
    expect(result.errors.some((error) => error.message.includes("Первым"))).toBe(true);
  });

  it("adds new default stories without discarding a child's old edited questions", () => {
    const old = "# Помощь маме\n\n? Мой вопрос?\n+ Вова";
    const merged = parseStoryQuizText(mergeStoryQuizText(topic.storyQuiz.defaultText, old));
    expect(merged.groups).toHaveLength(27);
    expect(merged.groups.find((group) => group.title === "Помощь маме").questions[0].prompt).toBe("Мой вопрос?");
    expect(merged.groups.find((group) => group.title === "Мяч под стулом").questions).toHaveLength(4);
    expect(mergeStoryQuizText(topic.storyQuiz.defaultText, "invalid edit")).toBe("invalid edit");
  });
});

function mount(task) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const callbacks = { onCorrect: vi.fn(), onIncorrect: vi.fn(), onQualityAnswer: vi.fn() };
  act(() => root.render(createElement(ReadingRenderer, { task, topicId: topic.meta.id, sessionParams: {}, ...callbacks })));
  return { container, ...callbacks, close() { act(() => root.unmount()); container.remove(); } };
}

function click(container, label) {
  const button = [...container.querySelectorAll("button")].find((item) => item.textContent === label);
  expect(button, label).toBeTruthy();
  act(() => button.click());
}

describe("micro-story reading support", () => {
  it("keeps the full text but renders no pictures until requested", () => {
    const h = mount(findTasks[0]);
    try {
      expect(h.container.textContent).toContain("Вова играл с мячом.");
      expect(h.container.querySelectorAll("img")).toHaveLength(0);
      click(h.container, "Вова");
      expect(h.onCorrect).toHaveBeenCalledWith("micro_ball", "q1", expect.objectContaining({ autoAdvance: true }));
      expect(h.onQualityAnswer).not.toHaveBeenCalled();
    } finally { h.close(); }
  });

  it("retains picture assistance after hiding pictures and after a wrong answer", () => {
    const h = mount(findTasks[0]);
    try {
      click(h.container, "Показать картинки");
      expect(h.container.querySelectorAll("img")).toHaveLength(2);
      expect(h.container.querySelectorAll("figcaption")).toHaveLength(0);
      click(h.container, "Скрыть картинки");
      click(h.container, "играл");
      expect(h.onIncorrect).toHaveBeenCalled();
      click(h.container, "Вова");
      expect(h.onQualityAnswer).toHaveBeenCalledWith("prompted", "micro_ball", "q1");
      expect(h.onCorrect).not.toHaveBeenCalled();
    } finally { h.close(); }
  });

  it("lets the adult record no oral answer without treating it as correct", () => {
    const h = mount(findTasks[3]);
    try {
      expect(h.container.querySelectorAll("img")).toHaveLength(0);
      expect(h.container.textContent).toContain("Вова играл с мячом.");
      click(h.container, "Пока нет ответа");
      expect(h.onQualityAnswer).toHaveBeenCalledWith("none", "micro_ball", "q4");
      expect(h.onCorrect).not.toHaveBeenCalled();
    } finally { h.close(); }
  });
});
