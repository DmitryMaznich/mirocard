// Audio-key scheme for the "Диктант" mode. Recordings are static assets shipped with the
// app itself (like addition_subtraction's number words), not part of propis's own deck zip --
// propis's renderer is already code-bundled, and this mode's audio has nothing to do with the
// print PDFs build-propis-deck.mjs bundles, so there's no reason to route it through that zip.
// See scripts/generate-propis-dictation-audio.mjs (not written yet) for the recorder.
export function dictationAudioUrl(key) {
  return `/audio/propis-dictation/${key}.mp3`;
}

// Letters: uppercase and lowercase are separate dictation items with separate recordings
// ("заглавная А" / "строчная а", not one clip with a spoken case prefix -- user's explicit
// call). Keying on an upper/lower PREFIX plus the letter's own lowercase form, rather than on
// the letter's actual case, is deliberate: Windows/macOS filesystems case-fold Cyrillic same as
// Latin, so bare "А.mp3"/"а.mp3" would collide on the build machine (CLAUDE.md: build runs on
// Windows). "up_а.mp3" and "lo_а.mp3" differ in their ASCII prefix regardless of what
// case-folding does to the Cyrillic part, so they can never collide.
export function letterDictationKey(letterCard) {
  const ch = letterCard.label ?? letterCard.id;
  const isUpper = ch === ch.toUpperCase() && ch !== ch.toLowerCase();
  return `${isUpper ? "up" : "lo"}_${ch.toLowerCase()}`;
}

export function isUpperCaseLetterCard(letterCard) {
  const ch = letterCard.label ?? letterCard.id;
  return ch === ch.toUpperCase() && ch !== ch.toLowerCase();
}

// Words/texts are keyed on their own topic.json id ("w001", "t01") -- already ASCII and
// unique, no case-collision risk, no need to touch the Cyrillic word/text itself for the key.
export function wordDictationKey(wordEntry) {
  return `word_${wordEntry.id}`;
}

export function textDictationKey(textEntry) {
  return `text_${textEntry.id}`;
}
