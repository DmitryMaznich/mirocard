import { describe, expect, it } from "vitest";
import { parseStoryQuizText, quizGroupsByStoryId, validateStoryQuizText } from "./storyQuiz";

const COMPLETE_QUESTION = `? Сколько мячей было у Вани и Миши?
+ Один мяч
- Два мяча
- Три мяча
- Ни одного мяча`;

describe("short-story quiz text", () => {
  it("parses four marked answer choices", () => {
    const parsed = parseStoryQuizText(`# Мяч по очереди

${COMPLETE_QUESTION}`);

    expect(parsed.valid).toBe(true);
    expect(parsed.groups[0].questions[0].prompt).toBe("Сколько мячей было у Вани и Миши?");
    expect(parsed.groups[0].questions[0].answers.map(({ text, isCorrect }) => ({ text, isCorrect }))).toEqual([
      { text: "Один мяч", isCorrect: true },
      { text: "Два мяча", isCorrect: false },
      { text: "Три мяча", isCorrect: false },
      { text: "Ни одного мяча", isCorrect: false },
    ]);
  });

  it("reports an incomplete question without discarding it", () => {
    const parsed = parseStoryQuizText(`# Мяч по очереди

? Сколько мячей было?
+ Один
- Два`);

    expect(parsed.valid).toBe(false);
    expect(parsed.errors[0].message).toContain("4 ответа");
    expect(parsed.groups[0].questions).toHaveLength(1);
  });

  it("requires five questions for every story selected in the trainer", () => {
    const source = `# Мяч по очереди

${Array.from({ length: 5 }, (_, index) => `${COMPLETE_QUESTION.replace("Сколько мячей было у Вани и Миши?", `Вопрос ${index + 1}?`)}`).join("\n\n")}`;
    const stories = [
      { id: "ball", title: "Мяч по очереди" },
      { id: "help", title: "Помощь маме" },
    ];

    const checked = validateStoryQuizText(source, stories, ["ball"]);
    expect(checked.valid).toBe(true);

    const missing = validateStoryQuizText(source, stories, ["help"]);
    expect(missing.valid).toBe(false);
    expect(missing.errors.at(-1).message).toContain("Помощь маме");
  });

  it("resolves friendly text-file headings to stable story ids", () => {
    const parsed = parseStoryQuizText(`# Мяч по очереди

${COMPLETE_QUESTION}`);
    expect(quizGroupsByStoryId(parsed, [{ id: "whose_ball", title: "Мяч по очереди" }])).toMatchObject({
      whose_ball: [{ prompt: "Сколько мячей было у Вани и Миши?" }],
    });
  });
});
