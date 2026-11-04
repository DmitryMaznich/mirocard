import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { readFile } from "node:fs/promises";
import JSZip from "jszip";
import { describe, expect, it, vi } from "vitest";
import { generateTasks } from "./engine";
import { getSelectedReadingStories, mergeStoryQuizText, parseStoryQuizText, validateStoryQuizText } from "./storyQuiz";
import ReadingRenderer from "./index";
import { useAppStore } from "@/core/store";

vi.mock("@/shared/hooks/useTopicFile", () => ({ useTopicFile: (_topic, path) => path ? `/preview/${path}` : null }));
const zip = await JSZip.loadAsync(await readFile("public/decks/reading_short_stories_v2.0.5.zip"));
const topic = JSON.parse(await zip.file("topic.json").async("string"));
const micro = topic.texts.filter((story) => story.storyStage === "micro");
const findTasks = generateTasks({ type: "story_quiz" }, topic, micro[0].id, {});
const readTasks = generateTasks({ type: "read_text" }, topic, micro[0].id, {});
const source = JSON.parse(await readFile("content/reading_short_stories/micro/stories.json", "utf8"));
const stripSyllables = (value) => value.replace(/(\p{L})-(?=\p{L})/gu, "$1");
// Most interaction checks use «Мяч под стулом»; the collection opens on «Книга на полке».
const ballFind = findTasks.filter((task) => task.textId === "micro_ball");
const ballRead = readTasks.find((task) => task.textId === "micro_ball");
const totalQuestions = source.reduce((n, story) => n + story.questions.length + (story.discussion ? 1 : 0), 0);

describe("micro-story content and staircase", () => {
  it("publishes exactly the source sentences and questions: search, then comprehension, then the talking point", () => {
    expect(micro.map((story) => story.id)).toEqual(source.map((story) => story.id));
    for (const entry of source) {
      const story = micro.find(s => s.id === entry.id);
      expect(story.lines.map(line => line.text)).toEqual(entry.lines.map(stripSyllables));
      expect(story.microLevel).toBe(entry.level);
      const questions = findTasks.filter(task => task.textId === entry.id).map(task => task.question);
      const expected = [...entry.questions.filter(q => q.kind === "find"), ...entry.questions.filter(q => q.kind === "gist")];
      expect(questions.map(q => q.prompt)).toEqual([...expected.map(q => q.prompt), entry.discussion.prompt]);
      expect(questions.map(q => q.kind)).toEqual([...expected.map(q => q.kind), "discuss"]);
      expected.forEach((q, index) => expect(new Set(questions[index].targets ?? [questions[index].target])).toEqual(new Set(q.targets)));
      expect(findTasks.find(task => task.textId === entry.id && task.type === "story_quiz_discuss").expectedAnswer).toBe(entry.discussion.answer);
    }
  });

  it("offers a search-only set that drops just the comprehension questions", () => {
    const searchOnly = generateTasks({ type: "story_quiz" }, topic, micro[0].id, { questionSet: "find" });
    const gist = source.reduce((n, story) => n + story.questions.filter(q => q.kind === "gist").length, 0);
    expect(gist).toBeGreaterThanOrEqual(30);
    expect(searchOnly).toHaveLength(totalQuestions - gist);
    expect(searchOnly.some(task => task.question.kind === "gist")).toBe(false);
    expect(searchOnly.filter(task => task.type === "story_quiz_discuss")).toHaveLength(15);
  });

  it("parses ?? as a comprehension question that still needs a fragment in the text", () => {
    const parsed = parseStoryQuizText("# Вода для кота\n\n?? Что Петя увидел в начале?\n+ нет воды\n\n?? Без ответа?");
    expect(parsed.groups[0].questions[0]).toMatchObject({ kind: "gist", prompt: "Что Петя увидел в начале?", target: "нет воды" });
    expect(parsed.valid).toBe(false);
    const merged = mergeStoryQuizText(topic.storyQuiz.defaultText, "# Вода для кота\n\n? Как зовут мальчика?\n+ Петя\n\n?? Что Петя увидел?\n+ нет воды");
    expect(merged).toContain("?? Что Петя увидел?\n+ нет воды");
  });
  it("starts with exactly 15 short stories and keeps legacy selection separate", () => {
    expect(getSelectedReadingStories(topic)).toHaveLength(15);
    expect(getSelectedReadingStories(topic, { storyStage: "extended" })).toHaveLength(12);
    expect(getSelectedReadingStories(topic, { selectedStories: ["help_mommy"] })).toHaveLength(15);
    expect(getSelectedReadingStories(topic, { selectedMicroStories: ["micro_book", "micro_ball"] }).map((story) => story.id))
      .toEqual(["micro_book", "micro_ball"]);
    expect(new Set(topic.texts.map((story) => story.title.ru)).size).toBe(27);
  });

  it("ships every question, a name first, valid normal and syllable targets, and 30 real frames", () => {
    expect(findTasks).toHaveLength(totalQuestions);
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
      expect(tasks.filter(task => task.question.kind === "find").length).toBeGreaterThanOrEqual(5);
      expect(tasks.filter(task => task.question.kind === "gist").length).toBeGreaterThanOrEqual(2);
      expect(tasks.map(task => task.type)).toEqual([...tasks.slice(0, -1).map(() => "story_quiz"), "story_quiz_discuss"]);
      expect(tasks[0].question.prompt).toMatch(/^Как зовут (мальчика|девочку)\?$/);
      expect(tasks[0].question.target).toBe(story.character);
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
    expect(merged.groups.find((group) => group.title === "Мяч под стулом").questions).toHaveLength(8);
    expect(mergeStoryQuizText(topic.storyQuiz.defaultText, "invalid edit")).toBe("invalid edit");
  });

  it("refreshes unchanged questions from the previous edition while keeping a child's edits", () => {
    const saved = topic.storyQuiz.previousDefaultTexts[0].replace("Куда закатился мяч?", "Где лежал мяч?");
    const merged = mergeStoryQuizText(topic.storyQuiz.defaultText, saved, topic.storyQuiz.previousDefaultTexts);
    expect(merged).toContain("Где лежал мяч?");
    expect(merged).toContain("Куда Вова наступил?");
    expect(merged).not.toContain("По какой дорожке гулял Вова?");
    const stories = topic.texts.map((story) => ({ ...story, title: story.title.ru }));
    // An actual three-question custom edit stays visible for adult correction;
    // it cannot silently bypass the new five-question minimum.
    expect(validateStoryQuizText(merged, stories, micro.map((story) => story.id)).valid).toBe(false);
    const tasks = generateTasks({ type: "story_quiz" }, topic, micro[0].id, { storyQuizText: saved });
    // The edited three-question «Мяч под стулом» is below the minimum, so that
    // story is skipped; every other story gets the current questions.
    const ball = source.find((story) => story.id === "micro_ball");
    expect(tasks).toHaveLength(totalQuestions - ball.questions.length - 1);
    expect(tasks.find((task) => task.textId === "micro_boots" && task.question.id === "q3").question.target).toBe("в грязь");
    const customInvalid = saved.replace("по грязной дорожке", "по дорожке");
    const preserved = mergeStoryQuizText(topic.storyQuiz.defaultText, customInvalid, topic.storyQuiz.previousDefaultTexts);
    expect(preserved).toContain("+ по дорожке");
    expect(validateStoryQuizText(preserved, stories, ["micro_boots"]).valid).toBe(false);
  });

  it("refreshes the whole saved default including renamed stories without obsolete headings", () => {
    const saved = topic.storyQuiz.previousDefaultTexts.at(-1);
    const merged = mergeStoryQuizText(topic.storyQuiz.defaultText, saved, topic.storyQuiz.previousDefaultTexts);
    const stories = topic.texts.map(s => ({ ...s, title: s.title.ru }));
    expect(validateStoryQuizText(merged, stories, micro.map(s => s.id)).errors).toEqual([]);
    expect(parseStoryQuizText(merged).groups).toHaveLength(27);
    expect(merged).toContain("# Котёнок");
    expect(merged).not.toContain("# Красный карандаш");
    expect(merged).not.toContain("# Корм для кота");
    expect(generateTasks({ type: "story_quiz" }, topic, micro[0].id, { storyQuizText: saved })).toHaveLength(totalQuestions);
  });
});

function mount(task) {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const callbacks = { onCorrect: vi.fn(), onIncorrect: vi.fn(), onQualityAnswer: vi.fn(), onAdvance: vi.fn() };
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
    const h = mount(ballFind[0]);
    try {
      expect(h.container.textContent).toContain("Вова играл с мячом.");
      expect(h.container.querySelectorAll("img")).toHaveLength(0);
      click(h.container, "Вова");
      click(h.container, "Ответить");
      expect(h.onCorrect).toHaveBeenCalledWith("micro_ball", "q1", expect.objectContaining({ autoAdvance: true }));
      expect(h.onQualityAnswer).not.toHaveBeenCalled();
    } finally { h.close(); }
  });

  it("retains picture assistance after hiding pictures and after a wrong answer", () => {
    const h = mount(ballFind[0]);
    try {
      click(h.container, "Показать картинки");
      expect(h.container.querySelectorAll("img")).toHaveLength(2);
      expect(h.container.querySelectorAll("figcaption")).toHaveLength(0);
      click(h.container, "Скрыть картинки");
      click(h.container, "играл");
      click(h.container, "Ответить");
      expect(h.onIncorrect).toHaveBeenCalled();
      click(h.container, "Вова");
      click(h.container, "Ответить");
      expect(h.onQualityAnswer).toHaveBeenCalledWith("prompted", "micro_ball", "q1");
      expect(h.onCorrect).not.toHaveBeenCalled();
    } finally { h.close(); }
  });

  it("lets the adult record no oral answer without treating it as correct", () => {
    const h = mount({ ...ballFind[0], type: "story_quiz_discuss", question: { id: "oral", kind: "discuss", prompt: "Обсудим рассказ?" } });
    try {
      expect(h.container.querySelectorAll("img")).toHaveLength(0);
      expect(h.container.textContent).toContain("Вова играл с мячом.");
      click(h.container, "Пока нет ответа");
      expect(h.onQualityAnswer).toHaveBeenCalledWith("none", "micro_ball", "oral");
      expect(h.onCorrect).not.toHaveBeenCalled();
    } finally { h.close(); }
  });
});

describe("questions inside the micro-story reader", () => {
  it("treats every candidate equally and grades only the confirmed choice", () => {
    const h = mount(ballRead);
    try {
      click(h.container, "Вопросы");
      const submit = () => [...h.container.querySelectorAll("button")].find((b) => b.textContent === "Ответить");
      expect(submit().disabled).toBe(true);
      for (const label of ["Вова", "играл", "с", "мячом"]) {
        click(h.container, label);
        const selected = h.container.querySelectorAll(".story-quiz__word[aria-pressed=true]");
        expect(selected).toHaveLength(1);
        expect(selected[0].textContent).toBe(label);
        expect(selected[0].className).toBe("story-quiz__word story-quiz__word--selected");
        expect(h.container.querySelectorAll(".micro-answer-history li")).toHaveLength(0);
      }
      click(h.container, "Ответить");
      expect(submit().disabled).toBe(true);
      expect(h.container.querySelector("[role=status]").textContent).toContain("Мы ищем имя мальчика");
      click(h.container, "Ответить"); // A repeated confirmation cannot add an attempt.
      click(h.container, "Вова");
      expect(h.container.querySelectorAll(".micro-answer-history li")).toHaveLength(0);
      click(h.container, "Ответить");
      const answer = h.container.querySelector(".micro-answer-history li");
      expect(answer.dataset.attempts).toBe("2");
      expect(answer.dataset.firstAnswer).toBe("мячом");
      expect(answer.dataset.assisted).toBe("false");
      expect(answer.textContent).toContain("Первый ответ: «мячом»");
      expect(h.container.querySelectorAll(".story-quiz__word--found")).toHaveLength(1);
      click(h.container, "Следующий вопрос");
      expect(submit().disabled).toBe(true);
      click(h.container, "с мячом");
      click(h.container, "Ответить");
      expect(h.container.querySelector(".micro-answer-history li:last-child").dataset.attempts).toBe("1");
      expect(h.container.querySelector(".micro-answer-history li:last-child").dataset.firstAnswer).toBe("с мячом");
    } finally { h.close(); }
  });

  it("adds the questions to an already saved reading task from the previous app version", () => {
    const records = useAppStore.getState().topicRecords;
    useAppStore.setState({ topicRecords: [topic] });
    const cached = { ...ballRead, storyQuestions: undefined };
    const h = mount(cached);
    try {
      click(h.container, "Вопросы");
      expect(h.container.querySelector(".micro-exercise-question h2").textContent).toBe("Как зовут мальчика?");
      click(h.container, "Вова");
      click(h.container, "Ответить");
      expect(h.container.querySelectorAll(".micro-answer-history li")).toHaveLength(1);
    } finally { h.close(); useAppStore.setState({ topicRecords: records }); }
  });
  it("keeps every found question and actual answer through all fifteen agreed stories", () => {
    expect(readTasks).toHaveLength(15);
    for (const task of readTasks) {
      const h = mount(task);
      try {
        expect(h.container.querySelectorAll("img")).toHaveLength(2);
        click(h.container, "Вопросы");
        expect(h.container.querySelectorAll("img")).toHaveLength(0);
        const questions = task.storyQuestions.filter((q) => q.kind !== "discuss");
        expect(questions.length).toBeGreaterThanOrEqual(7);
        const found = [];
        for (const [index, question] of questions.entries()) {
          expect(h.container.querySelector(".micro-exercise-question h2").textContent).toBe(question.prompt);
          // Nested alternatives render as the shortest accepted fragment.
          const labels = new Set([...h.container.querySelectorAll(".story-quiz__word")].map((b) => b.textContent));
          const label = [...(question.targets ?? [question.target])].sort((a, b) => a.length - b.length).find((t) => labels.has(t));
          expect(label, question.prompt).toBeTruthy();
          click(h.container, label);
          click(h.container, "Ответить");
          found.push([question.prompt, label]);
          expect(h.container.querySelectorAll(".micro-answer-history li")).toHaveLength(index + 1);
          for (const [prompt, answer] of found) {
            expect(h.container.querySelector(".micro-answer-history").textContent).toContain(prompt);
            expect(h.container.querySelector(".micro-answer-history").textContent).toContain(answer);
          }
          expect(h.onAdvance).not.toHaveBeenCalled();
          click(h.container, "Следующий вопрос");
        }
        expect(h.container.querySelector(".micro-exercise-question .micro-reader-eyebrow").textContent).toBe("Обсудите вместе");
        click(h.container, "Обсудили");
        expect(h.container.querySelectorAll(".micro-answer-history li")).toHaveLength(questions.length + 1);
        expect(h.container.querySelectorAll(".story-quiz__word")).toHaveLength(0);
        expect(h.container.querySelector(".micro-exercise-question h2").textContent).toBe("Все ответы найдены");
      } finally { h.close(); }
    }
  });

  it("retains answers and the active question after an incorrect tap and a return to reading", () => {
    const h = mount(ballRead);
    try {
      click(h.container, "Вопросы");
      click(h.container, "играл");
      click(h.container, "Ответить");
      expect(h.container.querySelector("[role=status]").textContent).toContain("Мы ищем имя мальчика");
      expect(h.container.querySelectorAll(".micro-answer-history li")).toHaveLength(0);
      click(h.container, "Вова");
      click(h.container, "Ответить");
      click(h.container, "Следующий вопрос");
      click(h.container, "Рассказ");
      expect(h.container.querySelectorAll(".micro-answer-history li")).toHaveLength(1);
      click(h.container, "Вопросы");
      expect(h.container.querySelector(".micro-exercise-question h2").textContent).toBe("С чем играл Вова?");
      click(h.container, "с мячом");
      click(h.container, "Ответить");
      expect(h.container.querySelectorAll(".micro-answer-history li")).toHaveLength(2);
      expect(h.container.querySelector(".micro-answer-history li:last-child").dataset.assisted).toBe("true");
    } finally { h.close(); }
  });
});
