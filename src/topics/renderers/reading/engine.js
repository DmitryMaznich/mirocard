import { shuffle } from "@/shared/utils/shuffle";

export function getReadingText(topicRecord, textId) {
  const texts = topicRecord?.texts ?? [];
  return texts.find((text) => text.id === textId) ?? texts[0] ?? null;
}

export function tokenizeReadingLine(line) {
  return String(line?.text ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((text, index) => ({
      uid: `${line.id ?? "line"}_${index}_${text}`,
      text,
      targetIndex: index,
    }));
}

function buildReadTextTask(text) {
  return {
    type: "read_text",
    textId: text.id,
    text,
  };
}

function buildUnderstandTasks(text) {
  return (text.questions ?? []).map((question) => ({
    type: "understand_text",
    textId: text.id,
    text,
    question,
    supportLines: (question.supportLineIds ?? [])
      .map((lineId) => text.lines.find((line) => line.id === lineId))
      .filter(Boolean),
  }));
}

function buildAssembleTask(text) {
  return {
    type: "assemble_text",
    textId: text.id,
    text: {
      ...text,
      lines: (text.lines ?? []).map((line) => ({
        ...line,
        tokens: shuffle(tokenizeReadingLine(line)),
        expectedTokens: tokenizeReadingLine(line),
      })),
    },
  };
}

export function generateTasks(mode, topicRecord, textId) {
  const text = getReadingText(topicRecord, textId);
  if (!text) return [];

  switch (mode.type) {
    case "read_text":
      return [buildReadTextTask(text)];
    case "understand_text":
      return buildUnderstandTasks(text);
    case "assemble_text":
      return text.kind === "poem" ? [buildAssembleTask(text)] : [];
    default:
      return [];
  }
}
