
import { getMinimumStoryFindQuestions, getSelectedReadingStories, mergeStoryQuizText, parseStoryQuizText, quizGroupsByStoryId } from "./storyQuiz";

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

// reading_short_stories is a single "Читаем рассказы" mode: entering it
// reads through the selected stories as one continuous sequence (the
// existing task-advance machinery already walks tasks[] and ends the
// session after the last one), rather than one session per picked story.
// `selectedStories` (an enum_multi param — see EnumMultiParam in
// ParamsScreen.jsx) empty/missing means "all", matching that component's own
// "[] = all" convention; deck order is preserved regardless of pick order.
// Scoped to this one deck for now, not the "reading" renderer generally.
function buildAllStoriesTasks(topicRecord, sessionParams) {
  const selected = getSelectedReadingStories(topicRecord, sessionParams);
  const questions = selected.some((story) => story.sentenceLayout)
    ? buildStoryQuizTasks(topicRecord, sessionParams)
    : [];
  return selected.map((text, storyIndex, stories) => ({
    ...buildReadTextTask(text), storyIndex, storyCount: stories.length,
    ...(text.sentenceLayout ? { storyQuestions: questions.filter((task) => task.textId === text.id)
      .map(({ question, expectedAnswer }) => ({ ...question, expectedAnswer })) } : {}),
  }));
}

function getStoryTitle(story) {
  return typeof story?.title === "string"
    ? story.title
    : story?.title?.ru ?? story?.title?.en ?? story?.id ?? "";
}

// The full text stays available through the story's questions. Text-search
// responses are graded; oral responses are assessed separately by the adult.
function buildStoryQuizTasks(topicRecord, sessionParams) {
  const rawText = mergeStoryQuizText(topicRecord?.storyQuiz?.defaultText, sessionParams?.storyQuizText);
  const parsed = parseStoryQuizText(rawText);
  if (!parsed.valid) return [];

  const stories = (topicRecord.texts ?? [])
    .filter((text) => text.kind === "story")
    .map((text) => ({ ...text, title: getStoryTitle(text) }));
  const questionsByStoryId = quizGroupsByStoryId(parsed, stories);
  const selectedStoryIds = new Set(getSelectedReadingStories(topicRecord, sessionParams).map((story) => story.id));
  const selectedStories = stories.filter((story) => selectedStoryIds.has(story.id));
  const readyStories = selectedStories.filter((story) => (questionsByStoryId[story.id] ?? [])
    .filter((question) => question.kind !== "discuss").length >= getMinimumStoryFindQuestions(story));

  return readyStories.flatMap((story, storyIndex) => {
    const allQuestions = questionsByStoryId[story.id] ?? [];
    // Discussion questions are unscored, so they're appended after the
    // graded find-questions rather than interleaved — the child finishes
    // the scored part of the story before the adult opens the talking point.
    const orderedQuestions = [
      ...allQuestions.filter((question) => question.kind !== "discuss"),
      ...allQuestions.filter((question) => question.kind === "discuss"),
    ];
    return orderedQuestions.map((question, questionIndex) => ({
      type: question.kind === "discuss" ? "story_quiz_discuss" : "story_quiz",
      textId: story.id,
      text: story,
      question,
      expectedAnswer: question.prompt === story.discussionPrompt ? story.discussionAnswer : undefined,
      storyIndex,
      storyCount: readyStories.length,
      questionIndex,
      questionCount: orderedQuestions.length,
    }));
  });
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

function buildSafeCodeTask(text) {
  return {
    type: "safe_code",
    textId: text.id,
    text,
  };
}

function buildPoemBookTask(text) {
  return {
    type: "read_poem_book",
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

function buildDailySentencesTasks(text, today = null, selectedLineIds = null, group = null) {
  const allLines = text.lines ?? [];
  const groupFiltered = group
    ? allLines.filter((l) => !l.group || l.group === group)
    : allLines;
  const pool = selectedLineIds?.length
    ? groupFiltered.filter((l) => selectedLineIds.includes(l.id))
    : groupFiltered;
  const dailySize = Math.min(text.dailySize ?? 10, pool.length);
  const date = today ?? new Date().toISOString().slice(0, 10);
  const seed = `${text.id}_${date}_${group ?? "all"}`;
  const shuffled = seededShuffle(pool, seed);
  const selected = shuffled.slice(0, dailySize);
  return selected.map((line) => ({
    type: "read_text",
    textId: text.id,
    text: { ...text, lines: [line] },
  }));
}

export function generateTasks(mode, topicRecord, textId, sessionParams = null, textOverride = null) {
  const text = getReadingText(topicRecord, textId, textOverride);
  if (!text) return [];

  switch (mode.type) {
    case "read_text":
      return topicRecord?.meta?.id === "reading_short_stories"
        ? buildAllStoriesTasks(topicRecord, sessionParams)
        : [buildReadTextTask(text)];
    case "story_quiz":
      return topicRecord?.meta?.id === "reading_short_stories"
        ? buildStoryQuizTasks(topicRecord, sessionParams)
        : [];
    case "understand_text":
      return buildUnderstandTasks(text);
    case "assemble_text":
      return (text.kind === "poem" || text.kind === "story") ? buildAssembleTasks(text) : [];
    case "follow_instruction":
      return text.kind === "instruction" ? [buildFollowInstructionTask(text)] : [];
    case "shopping_list": {
      const shoppingText = (topicRecord.texts ?? []).find((t) => t.kind === "shopping_list");
      return shoppingText ? [buildShoppingListTask(shoppingText)] : [];
    }
    case "safe_code":
      return text.kind === "safe_code" ? [buildSafeCodeTask(text)] : [];
    case "read_poem_book":
      return text.kind === "poem_book" ? [buildPoemBookTask(text)] : [];
    case "daily_sentences":
      return text.kind === "sentence_pool"
        ? buildDailySentencesTasks(text, sessionParams?.today ?? null, sessionParams?.selectedLineIds ?? null, sessionParams?.group ?? null)
        : [];
    default:
      return [];
  }
}
