import { shuffle } from "@/shared/utils/shuffle";
import { generateLetterTasks } from "../propis/letters/lettersEngine.js";
import { LETTER_DATA } from "../propis/letters/letterData.js";
import { letterDictationKey, wordDictationKey, textDictationKey, textSentenceDictationKey, splitIntoSentences } from "../propis/dictationAudio.js";
import { CARD_LETTERS } from "./letterCards.js";

// «Прописи 2». The constructor is the topic's home screen (src/features/propis2), its session only hands the renderer one "page" task.
// «Узнай букву», «Строчная и заглавная» and «Диктант» are copied from «Прописи» (2026-10-10): the same tasks, the same pairing data
// (LETTER_DATA) and the same recorded dictation; the renderer draws them with this topic's own letters.
export function generateTasks(mode, topicRecord, sessionSize, sessionParams) {
  if (mode?.type === "letters_recognize") {
    const direction = sessionParams?.direction ?? "print_to_written";
    if (direction === "mix") {
      return shuffle([
        ...generateLetterTasks("match_print_to_written", LETTER_DATA),
        ...generateLetterTasks("match_written_to_print", LETTER_DATA),
      ]);
    }
    return generateLetterTasks(direction === "written_to_print" ? "match_written_to_print" : "match_print_to_written", LETTER_DATA);
  }
  if (mode?.type === "letters_case") {
    return (sessionParams?.variant ?? "sort") === "pair"
      ? generateLetterTasks("match_pair", LETTER_DATA, sessionSize, sessionParams ?? {})
      : generateLetterTasks("sort_case", LETTER_DATA);
  }
  if (mode?.type === "dictation") return [dictationTask(topicRecord, sessionParams)];
  return [{
    id: "propis2_page",
    type: "page",
    cardId: "propis2_page",
    conceptId: "propis2_page",
    lines: sessionParams?.lines ?? [],
  }];
}

// As «Прописи» builds it (propis/engine.js): a random set of items, letters / words / texts (a text dictated sentence by sentence),
// never the same letter twice in a row (А then а); the audio keys are the same recordings.
function dictationTask(topicRecord, sessionParams) {
  const level = sessionParams?.level ?? "letters";
  const repeatLimit = sessionParams?.unlimitedRepeats ? null : (sessionParams?.repeatLimit ?? 3);
  const videoRewardEnabled = Boolean(sessionParams?.videoRewardEnabled);
  let pool;
  if (level === "words") {
    pool = (topicRecord?.words ?? []).map((w) => ({ key: wordDictationKey(w), display: w.word }));
  } else if (level === "texts") {
    pool = (topicRecord?.texts ?? []).map((t) => ({
      key: textDictationKey(t),
      display: t.text,
      sentences: splitIntoSentences(t.text).map((s, i) => ({ key: textSentenceDictationKey(t, i), display: s })),
    }));
  } else {
    pool = CARD_LETTERS.map((label) => ({ key: letterDictationKey({ label }), display: label }));
  }
  const itemCount = Math.max(1, Math.min(sessionParams?.itemCount ?? 10, pool.length || 1));
  const items = noAdjacentRepeats(shuffle(pool).slice(0, itemCount), (item) => (item.display ?? "").toLowerCase());
  return { type: "dictation", level, items, repeatLimit, videoRewardEnabled };
}

function noAdjacentRepeats(picked, keyFn) {
  const buckets = new Map();
  for (const item of picked) {
    const k = keyFn(item);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(item);
  }
  const list = shuffle([...buckets.values()]).sort((a, b) => b.length - a.length);
  const out = [];
  while (out.length < picked.length) for (const b of list) if (b.length) out.push(b.shift());
  return out;
}
