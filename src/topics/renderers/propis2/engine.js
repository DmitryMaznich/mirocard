import { shuffle } from "@/shared/utils/shuffle";
import { syllableDictationKey, wordSyllables } from "./syllables.js";
import { generateLetterTasks } from "../propis/letters/lettersEngine.js";
import { letterDictationKey, wordDictationKey, textDictationKey, textSentenceDictationKey, splitIntoSentences, splitSentenceAtCommas, textChunkDictationKey, punctuationDictationKey } from "../propis/dictationAudio.js";
import { cardLetters, topicAlphabet } from "./alphabet.js";
import { buildGlyphMap } from "./pageTask.js";

// `propis2`. The constructor is the topic's home screen (src/features/propis2), its session only hands the renderer one "page" task.
// «Узнай букву», «Строчная и заглавная» and «Диктант» are copied from `propis` («Прописи старые») (2026-10-10): the same tasks, the same pairing data
// (LETTER_DATA, filtered to the deck alphabet) and the same recorded dictation; the renderer draws them with this topic's own letters.
export function generateTasks(mode, topicRecord, sessionSize, sessionParams) {
  const letters = ["letters_recognize", "letters_case", "dictation"].includes(mode?.type) ? deckLetters(topicRecord).letters : [];
  if (mode?.type === "letters_recognize") {
    const direction = sessionParams?.direction ?? "print_to_written";
    if (direction === "mix") {
      return shuffle([
        ...generateLetterTasks("match_print_to_written", letters),
        ...generateLetterTasks("match_written_to_print", letters),
      ]);
    }
    return generateLetterTasks(direction === "written_to_print" ? "match_written_to_print" : "match_print_to_written", letters);
  }
  if (mode?.type === "letters_case") {
    return (sessionParams?.variant ?? "sort") === "pair"
      ? generateLetterTasks("match_pair", letters, sessionSize, sessionParams ?? {})
      : generateLetterTasks("sort_case", letters);
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

// As `propis` builds it (propis/engine.js): a random set of items, letters / words / texts (a text dictated sentence by sentence),
// never the same letter twice in a row (А then а); the audio keys are the same recordings.
function dictationTask(topicRecord, sessionParams) {
  const level = sessionParams?.level ?? "letters";
  const repeatLimit = sessionParams?.unlimitedRepeats ? null : (sessionParams?.repeatLimit ?? 3);
  const videoRewardEnabled = Boolean(sessionParams?.videoRewardEnabled);
  const punctuation = Boolean(sessionParams?.punctuation);
  let pool;
  if (level === "words") {
    // «Повтор по слогам» (on by default): the word's syllables, each its own clip (syllables.js)
    const bySyllables = sessionParams?.syllables !== false;
    pool = (topicRecord?.words ?? []).map((w) => ({
      key: wordDictationKey(w), display: w.word,
      ...(bySyllables ? { syllables: wordSyllables(w).map((sy) => ({ key: syllableDictationKey(sy), display: sy })) } : {}),
    }));
  } else if (level === "texts") {
    pool = (topicRecord?.texts ?? []).map((t) => ({
      key: textDictationKey(t),
      display: t.text,
      sentences: splitIntoSentences(t.text).map((s, i) => ({ key: textSentenceDictationKey(t, i), display: s, chunks: splitSentenceAtCommas(s).map((c, j) => ({ key: textChunkDictationKey(t, i, j), display: c })) })),
    }));
  } else {
    pool = cardLetters(deckLetters(topicRecord)).map((label) => ({ key: letterDictationKey({ label }), display: label }));
  }
  const itemCount = Math.max(1, Math.min(sessionParams?.itemCount ?? 10, pool.length || 1));
  const items = noAdjacentRepeats(shuffle(pool).slice(0, itemCount), (item) => (item.display ?? "").toLowerCase());
  if (punctuation) voiceSigns(items, level);
  return { type: "dictation", level, items, repeatLimit, videoRewardEnabled, signsVoiced: punctuation }; // not `punctuation`: the shared review screen reads that as a list of glyphs
}

// Pauses of the dictation with the signs voiced (ms): the child writes the piece, then hears the sign.
const WRITE_PAUSE_MS = 2200;
const COMMA_PAUSE_MS = 600;
const SIGN_PAUSE_MS = 1500;

// «Диктовать знаки препинания» (2026-10-15). Letters and words are written in a row through commas, the last one ends with a period
// ("А, б, в."): each item gets `punct` (what stands after it on the answer sheet) and `audio` (its clip, then the sign's clip). A text keeps its
// own signs: a sentence is dictated piece by piece up to each comma (sign voiced between), then the sign that ends it. A text's clip
// carries `sentence` (its index), so the screen shows which sentence of the text sounds.
function voiceSigns(items, level) {
  if (level === "texts") {
    for (const item of items) {
      const audio = [];
      item.sentences.forEach((sentence, si) => {
        const end = sentence.display.slice(-1);
        const hasCommas = sentence.chunks.length > 1;
        if (hasCommas) {
          sentence.chunks.forEach((chunk, j) => {
            audio.push({ key: chunk.key, pauseAfterMs: WRITE_PAUSE_MS, sentence: si });
            if (j < sentence.chunks.length - 1) audio.push({ key: punctuationDictationKey(","), pauseAfterMs: COMMA_PAUSE_MS, sentence: si });
          });
        } else {
          audio.push({ key: sentence.key, pauseAfterMs: WRITE_PAUSE_MS, sentence: si });
        }
        audio.push({ key: punctuationDictationKey(punctuationDictationKey(end) ? end : "."), pauseAfterMs: SIGN_PAUSE_MS, sentence: si });
      });
      item.audio = audio;
    }
    return;
  }
  items.forEach((item, i) => {
    const sign = i < items.length - 1 ? "," : ".";
    item.punct = sign;
    item.audio = [{ key: item.key, pauseAfterMs: WRITE_PAUSE_MS }, { key: punctuationDictationKey(sign), pauseAfterMs: 0 }];
  });
}

// the alphabet with the capitals the deck really has ink for (no empty card)
const deckLetters = (topicRecord) => topicAlphabet(topicRecord, buildGlyphMap(topicRecord));

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
