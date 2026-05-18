import { useCallback, useEffect, useRef } from "react";
import { useAppStore } from "@/core/store";

// Extract TTS engine identifier from a voiceURI.
// Android Chrome: "com.google.android.tts:ru-RU" → "com.google.android.tts"
// Desktop/iOS: "Google UK English Female" or "com.apple.voice.compact.en-US.Nicky"
export function getVoiceEngineId(voice) {
  const uri = voice.voiceURI ?? "";
  if (uri.includes(":")) return uri.split(":")[0];
  // No colon: use brand prefix from voice name
  return voice.name.split(" ")[0].toLowerCase();
}

export function useSpeech() {
  const synthRef = useRef(typeof window !== "undefined" ? window.speechSynthesis : null);
  const ttsEngine = useAppStore((s) => s.settings?.ttsEngine ?? "");

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
    utterance.lang = "ru-RU";

    const voices = synth.getVoices();
    if (ttsEngine) {
      // Find Russian voice from the selected engine
      const engineVoices = voices.filter((v) => getVoiceEngineId(v) === ttsEngine);
      const ruVoice = engineVoices.find((v) => v.lang.startsWith("ru")) ?? engineVoices[0];
      if (ruVoice) {
        utterance.voice = ruVoice;
        utterance.lang = ruVoice.lang;
      }
    } else {
      // No engine selected — pick first Russian voice (device default behaviour)
      const ruVoice = voices.find((v) => v.lang.startsWith("ru"));
      if (ruVoice) utterance.voice = ruVoice;
    }

    synth.speak(utterance);
  }, [ttsEngine]);

  const cancel = useCallback(() => {
    synthRef.current?.cancel();
  }, []);

  return { speak, cancel };
}
