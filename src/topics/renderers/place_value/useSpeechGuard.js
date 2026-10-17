import { stopSpeech } from "./numberAudio.js";

// Spread `guard` on a task's root: a tap on any button there silences the
// recorded voice (numberAudio.js) before the button acts. The child never has
// to wait for the voice to answer — waiting made a child think the answer was
// wrong and tap the others — and sounds never stack: a new sound starts only
// after the old one is cut. Session controls live outside the task root.
export function useSpeechGuard() {
  const cut = (e) => { if (e.target.closest?.("button")) stopSpeech(); };
  return { guard: { onPointerDownCapture: cut, onClickCapture: cut } };
}
