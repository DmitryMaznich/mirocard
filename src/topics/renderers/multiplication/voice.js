// Spoken lesson phrases in the language of the pinned content package.
// The topic has no recorded speech yet (packages declare audio: "none"), so this uses the
// browser voice — but only a voice of the lesson language: if the device has no Slovenian
// voice, a Slovenian lesson stays silent rather than being read with a Russian voice.
const LOCALES = { ru: "ru-RU", sl: "sl-SI", en: "en-GB" };

export function speakLesson(text, language, { enabled = true } = {}) {
  const synth = typeof window !== "undefined" ? window.speechSynthesis : null;
  if (!enabled || !synth || !text) return;
  const voice = synth.getVoices().find((v) => v.lang?.toLowerCase().startsWith(language));
  if (!voice) return;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = LOCALES[language] ?? language;
  utterance.voice = voice;
  utterance.rate = 0.88;
  synth.speak(utterance);
}

export function stopLessonVoice() {
  if (typeof window !== "undefined") window.speechSynthesis?.cancel();
}
