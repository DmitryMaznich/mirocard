import { createContext, useContext } from "react";
import { useSpeech } from "@/shared/hooks/useSpeech";

const SpeechContext = createContext({ available: false, say: () => {} });

export function WordSpeechProvider({ enabled = true, children }) {
  const { speak } = useSpeech();
  const available = enabled && typeof window !== "undefined" && !!window.speechSynthesis;
  const say = text => {
    if (available) speak(text.replace(/[()]/g, ""));
  };
  return <SpeechContext.Provider value={{ available, say }}>{children}</SpeechContext.Provider>;
}

export function ListenButton({ text, label = "Послушать", className = "" }) {
  const { available, say } = useContext(SpeechContext);
  if (!available) return null;
  return <button type="button" className={`wf-listen ${className}`} disabled={!available}
    title={available ? label : "Озвучивание выключено или недоступно на устройстве"}
    aria-label={label} onClick={e => { e.stopPropagation(); say(text); }}>🔊</button>;
}
