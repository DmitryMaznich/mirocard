export const ADVANCE_GATE_IDLE = "idle";
export const ADVANCE_GATE_WAITING = "waiting";
export const ADVANCE_GATE_READY = "ready";

// Modes that always advance immediately on tap, bypassing the adult-confirm gate.
const GATE_EXEMPT_MODE_TYPES = new Set([
  "follow_instruction", "daily_sentences", "listen_write_letters",
  "magnetic_sentence", "magnetic_sentence_audio", "sort_letters",
  "story_sequence", "letter_demo", "letter_follow", "letter_trace", "safe_code",
]);

// A tap while WAITING promotes the gate to READY (mirroring the adult's
// Space/Enter keypress) instead of re-arming WAITING. Without this, a
// touch-only session has no way to ever reach READY and gets stuck forever
// on evaluation:"auto" modes once the adult-confirm lock is on.
export function resolveTapAdvanceGate(currentGate, { adultConfirmAdvance, modeType }) {
  if (!adultConfirmAdvance || currentGate === ADVANCE_GATE_READY || GATE_EXEMPT_MODE_TYPES.has(modeType)) {
    return { gate: null, shouldAdvance: true };
  }
  return { gate: ADVANCE_GATE_READY, shouldAdvance: false };
}
