import { useCallback, useEffect, useRef } from "react";
import { useAppStore } from "@/core/store";

export function useSpeech() {
  const synthRef = useRef(typeof window !== "undefined" ? window.speechSynthesis : null);
  const ttsVoiceUri = useAppStore((s) => s.settings?.ttsVoiceUri ?? "");

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
    utterance.rate = rate;
    utterance.pitch = pitch;

    const voices = synth.getVoices();
    if (ttsVoiceUri) {
      const selected = voices.find((v) => v.voiceURI === ttsVoiceUri);
      if (selected) {
        utterance.voice = selected;
        utterance.lang = selected.lang;
      } else {
        utterance.lang = "ru-RU";
      }
    } else {
      // No explicit selection — let browser use its default for ru-RU
      utterance.lang = "ru-RU";
      const ruVoice = voices.find((v) => v.lang.startsWith("ru"));
      if (ruVoice) utterance.voice = ruVoice;
    }

    synth.speak(utterance);
  }, [ttsVoiceUri]);

  const cancel = useCallback(() => {
    synthRef.current?.cancel();
  }, []);

  return { speak, cancel };
}
