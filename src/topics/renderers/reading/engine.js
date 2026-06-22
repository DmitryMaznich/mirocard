
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

function buildShoppingListTask(text) {
  return {
    type: "shopping_list",
    textId: text.id,
    text,
  };
}

function seededShuffle(arr, seedStr) {
  let s = 0;
  for (let i = 0; i < seedStr.length; i++) {
    s = (Math.imul(31, s) + seedStr.charCodeAt(i)) | 0;
  }
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1664525) + 1013904223) | 0;
    const j = Math.abs(s) % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildDailySentencesTasks(text, today = null) {
  const dailySize = text.dailySize ?? 10;
  const date = today ?? new Date().toISOString().slice(0, 10);
  const seed = `${text.id}_${date}`;
  const shuffled = seededShuffle(text.lines ?? [], seed);
  return [{
    type: "read_text",
    textId: text.id,
    text: { ...text, lines: shuffled.slice(0, dailySize) },
  }];
}

export function generateTasks(mode, topicRecord, textId, sessionParams = null, textOverride = null) {
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
    case "shopping_list": {
      const shoppingText = (topicRecord.texts ?? []).find((t) => t.kind === "shopping_list");
      return shoppingText ? [buildShoppingListTask(shoppingText)] : [];
    }
    case "daily_sentences":
      return text.kind === "sentence_pool"
        ? buildDailySentencesTasks(text, sessionParams?.today ?? null)
        : [];
    default:
      return [];
  }
}
