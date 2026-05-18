import { useCallback, useEffect, useRef } from "react";
import { useAppStore } from "@/core/store";

// Known TTS engine patterns — tested against voiceURI + voice name (case-insensitive)
const ENGINE_PATTERNS = [
  { pattern: /google/i,           id: "google",    label: "Google TTS" },
  { pattern: /samsung|smt/i,      id: "samsung",   label: "Samsung TTS" },
  { pattern: /apple/i,            id: "apple",     label: "Apple TTS" },
  { pattern: /microsoft/i,        id: "microsoft", label: "Microsoft TTS" },
  { pattern: /amazon|polly/i,     id: "amazon",    label: "Amazon TTS" },
  { pattern: /nuance/i,           id: "nuance",    label: "Nuance TTS" },
];

// Returns a stable engine ID for a voice by scanning both voiceURI and name.
export function getVoiceEngineId(voice) {
  const hay = `${voice.voiceURI ?? ""} ${voice.name ?? ""}`;
  for (const { pattern, id } of ENGINE_PATTERNS) {
    if (pattern.test(hay)) return id;
  }
  // Fallback: first non-empty token from voiceURI or name
  return (voice.voiceURI || voice.name || "unknown").split(/[\s:/?#]+/)[0].toLowerCase();
}

// Human-readable label for a known engine ID.
export function getEngineLabel(engineId) {
  return ENGINE_PATTERNS.find((e) => e.id === engineId)?.label ?? engineId;
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
      const engineVoices = voices.filter((v) => getVoiceEngineId(v) === ttsEngine);
      const ruVoice = engineVoices.find((v) => v.lang.startsWith("ru")) ?? engineVoices[0];
      if (ruVoice) { utterance.voice = ruVoice; utterance.lang = ruVoice.lang; }
    } else {
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
