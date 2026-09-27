// Audio-key scheme for the "Диктант" mode. Recordings are static assets shipped with the
// app itself (like addition_subtraction's number words), not part of propis's own deck zip --
// propis's renderer is already code-bundled, and this mode's audio has nothing to do with the
// print PDFs build-propis-deck.mjs bundles, so there's no reason to route it through that zip.
// See scripts/generate-propis-dictation-audio.mjs (not written yet) for the recorder.
export function dictationAudioUrl(key) {
  return `/audio/propis-dictation/${key}.mp3`;
}

// Stable per-card id (still one per case, "up_а"/"lo_а") -- used as the pool item's own
// identity, NOT as an audio filename anymore (see letterSoundDictationKey below for that).
// Keying on an upper/lower PREFIX plus the letter's own lowercase form, rather than on
// the letter's actual case, is deliberate: Windows/macOS filesystems case-fold Cyrillic same as
// Latin, so bare "А"/"а" ids would collide on the build machine (CLAUDE.md: build runs on
// Windows). "up_а" and "lo_а" differ in their ASCII prefix regardless of what case-folding
// does to the Cyrillic part, so they can never collide.
export function letterDictationKey(letterCard) {
  const ch = letterCard.label ?? letterCard.id;
  const isUpper = ch === ch.toUpperCase() && ch !== ch.toLowerCase();
  return `${isUpper ? "up" : "lo"}_${ch.toLowerCase()}`;
}

export function isUpperCaseLetterCard(letterCard) {
  const ch = letterCard.label ?? letterCard.id;
  return ch === ch.toUpperCase() && ch !== ch.toLowerCase();
}

// Playing a letter item plays TWO clips back to back: this one ("заглавная"/"строчная"
// alone), then letterSoundDictationKey's (the letter itself). Only 2 recordings total, not
// one per letter -- the case word doesn't change per letter, so baking it into every one of
// 33 letters' own clips (the original approach, reported 2026-09-24: "слитные фразы... 66
// файлов вместо 35") wasted a re-synthesis of the identical word 33 times over.
export function caseWordDictationKey(isUpper) {
  return isUpper ? "case_upper" : "case_lower";
}

// A letter's SOUND doesn't depend on case -- "К" and "к" are the same phoneme, only the
// written shape differs -- so this is ONE clip per base letter (33 total), not per up/lo
// card (was 64). Case-folding isn't a collision risk here the way letterDictationKey's own
// comment describes: there's only ever one entry per base letter now, nothing to collide
// WITH.
export function letterSoundDictationKey(letterCard) {
  const ch = (letterCard.label ?? letterCard.id).toLowerCase();
  return `sound_${ch}`;
}

// Words/texts are keyed on their own topic.json id ("w001", "t01") -- already ASCII and
// unique, no case-collision risk, no need to touch the Cyrillic word/text itself for the key.
export function wordDictationKey(wordEntry) {
  return `word_${wordEntry.id}`;
}

export function textDictationKey(textEntry) {
  return `text_${textEntry.id}`;
}

// Texts are dictated sentence by sentence, with a pause between sentences (user's explicit
// call, 2026-09-17) -- a whole 5-sentence text read in one breath is unrealistic for a child
// writing it by hand. Splitting on "period then whitespace" is safe for this bank specifically:
// texts.py's own generation rule is "exactly 5 short declarative sentences, periods only (no
// commas, dashes, or quotes)" -- confirmed against all 24 real texts in topic.json (every one
// splits to exactly 5 sentences), not assumed from the docstring alone.
const SENTENCE_SPLIT_RE = /(?<=\.)\s+/;

export function splitIntoSentences(text) {
  return text.trim().split(SENTENCE_SPLIT_RE).filter(Boolean);
}

export function textSentenceDictationKey(textEntry, sentenceIndex) {
  return `text_${textEntry.id}_s${sentenceIndex + 1}`;
}
