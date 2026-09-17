import { describe, expect, it } from "vitest";
import {
  getStoryQuizTargetMatches,
  parseStoryQuizText,
  quizGroupsByStoryId,
  validateStoryQuizText,
} from "./storyQuiz";

const COMPLETE_QUESTION = `? Найди, сколько мячей было у Вани и Миши.
+ один мяч`;

const BALL_STORY = {
  id: "ball",
  title: "Мяч по очереди",
  lines: [{ id: "l1", text: "У Вани и Миши был один мяч." }],
};

describe("short-story text locator source", () => {
  it("parses one tappable text fragment for a question", () => {
    const parsed = parseStoryQuizText(`# Мяч по очереди

${COMPLETE_QUESTION}`);

    expect(parsed.valid).toBe(true);
    expect(parsed.groups[0].questions[0]).toMatchObject({
      prompt: "Найди, сколько мячей было у Вани и Миши.",
      target: "один мяч",
    });
  });

  it("rejects obsolete distractors with a useful authoring error", () => {
    const parsed = parseStoryQuizText(`# Мяч по очереди

${COMPLETE_QUESTION}
- Два мяча`);

    expect(parsed.valid).toBe(false);
    expect(parsed.errors[0].message).toContain("дистракторы не нужны");
  });

  it("matches a phrase in normal and syllable text", () => {
    expect(getStoryQuizTargetMatches("У Вани и Миши был один мяч.", "один мяч")).toEqual([
      { start: 18, end: 26 },
    ]);
    expect(getStoryQuizTargetMatches("У Ва-ни и Ми-ши был о-дин мяч.", "один мяч")).toEqual([
      { start: 20, end: 29 },
    ]);
  });

  it("requires five questions and verifies every target is in its story", () => {
    const source = `# Мяч по очереди

${Array.from({ length: 5 }, (_, index) => `${COMPLETE_QUESTION.replace("Найди, сколько мячей было у Вани и Миши.", `Вопрос ${index + 1}?`)}`).join("\n\n")}`;

    expect(validateStoryQuizText(source, [BALL_STORY], ["ball"]).valid).toBe(true);

    const missingTarget = source.replace(/один мяч/g, "два мяча");
    const checked = validateStoryQuizText(missingTarget, [BALL_STORY], ["ball"]);
    expect(checked.valid).toBe(false);
    expect(checked.errors.some((error) => error.message.includes("не найден"))).toBe(true);
  });

  it("resolves friendly text-file headings to stable story ids", () => {
    const parsed = parseStoryQuizText(`# Мяч по очереди

${COMPLETE_QUESTION}`);
    expect(quizGroupsByStoryId(parsed, [BALL_STORY])).toMatchObject({
      ball: [{ target: "один мяч" }],
    });
  });
});

describe("discussion question (*)", () => {
  const FIVE_QUESTIONS = Array.from({ length: 5 }, (_, index) => `? Вопрос ${index + 1}?
+ один мяч`).join("\n\n");

  it("parses a discussion line with no target requirement", () => {
    const parsed = parseStoryQuizText(`# Мяч по очереди

${FIVE_QUESTIONS}

* Как ты думаешь, почему они помирились?`);

    expect(parsed.valid).toBe(true);
    const discussQuestion = parsed.groups[0].questions.at(-1);
    expect(discussQuestion).toMatchObject({
      kind: "discuss",
      prompt: "Как ты думаешь, почему они помирились?",
    });
    expect(discussQuestion.target).toBeUndefined();
  });

  it("rejects an empty discussion prompt", () => {
    const parsed = parseStoryQuizText(`# Мяч по очереди

${FIVE_QUESTIONS}

*`);
    expect(parsed.valid).toBe(false);
    expect(parsed.errors.some((error) => error.message.includes("вопрос для обсуждения"))).toBe(true);
  });

  it("does not count toward the 5 required find-questions", () => {
    const FOUR_QUESTIONS = Array.from({ length: 4 }, (_, index) => `? Вопрос ${index + 1}?
+ один мяч`).join("\n\n");
    const source = `# Мяч по очереди

${FOUR_QUESTIONS}

* Обсудим?`;
    const validated = validateStoryQuizText(source, [BALL_STORY], ["ball"]);
    expect(validated.valid).toBe(false);
    expect(validated.errors.some((error) => error.message.includes("не меньше 5 вопросов"))).toBe(true);
  });

  it("is not checked against the story text (it has no located phrase)", () => {
    const source = `# Мяч по очереди

${FIVE_QUESTIONS}

* Вопрос про то, чего в рассказе вообще нет`;
    expect(validateStoryQuizText(source, [BALL_STORY], ["ball"]).valid).toBe(true);
  });
});
