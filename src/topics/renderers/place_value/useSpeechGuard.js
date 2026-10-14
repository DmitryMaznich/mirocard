import { useSyncExternalStore } from "react";
import { isSpeaking, subscribeSpeaking } from "./numberAudio.js";

// Spread `guard` on a task's root: while the recorded voice speaks
// (numberAudio.js), taps and presses inside the task are swallowed — not
// queued, not replayed after. Children with autism often tap fast and
// repeatedly; without this every tap starts another clip on top of the last.
// Session controls (exit, back) live outside the task root and stay live.
export function useSpeechGuard() {
  const speaking = useSyncExternalStore(subscribeSpeaking, isSpeaking, isSpeaking);
  const block = (e) => {
    if (!isSpeaking()) return;
    e.preventDefault();
    e.stopPropagation();
  };
  return { speaking, guard: { onClickCapture: block, onPointerDownCapture: block } };
}
