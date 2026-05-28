
export function getReadingText(topicRecord, textId, textOverride = null) {
  if (textOverride?.id === textId) return textOverride;
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

function buildAssembleTasks(text) {
  const lines = text.lines ?? [];
  return lines.map((line, index) => ({
    type: "assemble_line",
    textId: text.id,
    lineIndex: index,
    totalLines: lines.length,
    tokenCount: tokenizeReadingLine(line).length,
    text,
    line,
  }));
}

function buildFollowInstructionTask(text) {
  return {
    type: "follow_instruction",
    textId: text.id,
    text,
  };
}

export function generateTasks(mode, topicRecord, textId, _sessionParams = null, textOverride = null) {
  const text = getReadingText(topicRecord, textId, textOverride);
  if (!text) return [];

  switch (mode.type) {
    case "read_text":
      return [buildReadTextTask(text)];
    case "understand_text":
      return buildUnderstandTasks(text);
    case "assemble_text":
      return text.kind === "poem" ? buildAssembleTasks(text) : [];
    case "follow_instruction":
      return text.kind === "instruction" ? [buildFollowInstructionTask(text)] : [];
    default:
      return [];
  }
}
