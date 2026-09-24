import { audioKeyUrl, numberToAudioKeys } from "./audioNumbers";

function phraseItem(key) {
  return { url: audioKeyUrl(`phrases/${key}`), tight: false };
}

function numberItems(number) {
  return numberToAudioKeys(number).map((key, index) => ({
    url: audioKeyUrl(key),
    tight: index > 0,
  }));
}

// The number recordings are deliberately kept separate from these phrase
// clips: all modes share the same Kore voice, without needing a recording for
// every possible "было N" or "стало N" combination.
export function observeStartAudioItems(start) {
  return [phraseItem("was"), ...numberItems(start)];
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
  return [phraseItem("was"), ...numberItems(start)];
}

export function nameActionVerbQuestionAudioItems({ isVoice }) {
  return [phraseItem(isVoice ? "what_was_done_say" : "what_was_done")];
}

export function nameActionCountQuestionAudioItems(operation) {
  return [phraseItem(operation === "add" ? "how_many_added" : "how_many_removed")];
}

export function nameActionCorrectAudioItems(task) {
  const operation = task.operation === "add" ? "added" : "removed";
  const items = [phraseItem(task.countStep ? `correct_${operation}_count` : `correct_${operation}`)];
  if (task.countStep) items.push(...numberItems(task.delta));
  return [
    ...items,
    phraseItem("was"),
    ...numberItems(task.start),
    phraseItem("became"),
    ...numberItems(task.result),
  ];
}

export function nameActionRetryAudioItems(step) {
  return [phraseItem(step === "count" ? "count_again" : "look_again")];
}
