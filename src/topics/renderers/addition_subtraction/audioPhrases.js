import { audioKeyUrl, numberToAudioKeys } from "./audioNumbers";
import {
  RECORDED_PHRASE_KEYS,
  correctCountKey,
  voiceAudioUrl,
  wasBecameKey,
  wasKey,
} from "./audioPhraseBank";

function phraseItem(key) {
  return { url: voiceAudioUrl(key), tight: false };
}

// Only for a value outside the recorded 1..5 range (no current mode makes
// one): the number words in the same voice, after a short pause.
function numberItems(number) {
  return numberToAudioKeys(number).map((key, index) => ({ url: audioKeyUrl(key), tight: index > 0 }));
}

function wasItems(start) {
  return RECORDED_PHRASE_KEYS.has(wasKey(start)) ? [phraseItem(wasKey(start))] : numberItems(start);
}

export function observeStartAudioItems(start) {
  return wasItems(start);
}

export function observeQuestionAudioItems() {
  return [phraseItem("more_or_less")];
}

export function observeCorrectAudioItems(answer) {
  return [phraseItem(answer === "more" ? "correct_more" : "correct_less")];
}

export function observeRetryAudioItems() {
  return [phraseItem("wrong_look_again")];
}

export function nameActionStartAudioItems(start) {
  return wasItems(start);
}

export function nameActionVerbQuestionAudioItems({ isVoice }) {
  return [phraseItem(isVoice ? "what_was_done_say" : "what_was_done")];
}

export function nameActionCountQuestionAudioItems(operation) {
  return [phraseItem(operation === "add" ? "how_many_added" : "how_many_removed")];
}

export function nameActionCorrectAudioItems(task) {
  const operation = task.operation === "add" ? "add" : "subtract";
  const countKey = correctCountKey(operation, task.delta);
  const confirm = task.countStep && RECORDED_PHRASE_KEYS.has(countKey)
    ? countKey
    : (operation === "add" ? "correct_added" : "correct_removed");
  const changeKey = wasBecameKey(task.start, task.result);
  return [
    phraseItem(confirm),
    ...(RECORDED_PHRASE_KEYS.has(changeKey) ? [phraseItem(changeKey)] : []),
  ];
}

export function nameActionRetryAudioItems(step) {
  return [phraseItem(step === "count" ? "count_again" : "look_again")];
}
