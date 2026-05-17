import { useCallback, useEffect, useRef } from "react";

export function useSpeech() {
  const synthRef = useRef(typeof window !== "undefined" ? window.speechSynthesis : null);

  useEffect(() => {
    return () => {
      synthRef.current?.cancel();
    };
  }, []);

  const speak = useCallback((text, { rate = 0.88, pitch = 1.0 } = {}) => {
    const synth = synthRef.current;
    if (!synth || !text) return;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ru-RU";
    utterance.rate = rate;
    utterance.pitch = pitch;
    // Prefer a Russian voice if available
    const voices = synth.getVoices();
    const ruVoice = voices.find((v) => v.lang.startsWith("ru"));
    if (ruVoice) utterance.voice = ruVoice;
    synth.speak(utterance);
  }, []);

  const cancel = useCallback(() => {
    synthRef.current?.cancel();
  }, []);

  return { speak, cancel };
}
