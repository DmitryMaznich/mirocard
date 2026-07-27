import { describe, it, expect } from "vitest";
import { resolveTapAdvanceGate, ADVANCE_GATE_READY, ADVANCE_GATE_WAITING } from "./advanceGate";

describe("resolveTapAdvanceGate", () => {
  it("advances immediately when adult-confirm is off", () => {
    const result = resolveTapAdvanceGate(ADVANCE_GATE_WAITING, { adultConfirmAdvance: false, modeType: "math_houses_grow" });
    expect(result).toEqual({ gate: null, shouldAdvance: true });
  });

  it("advances immediately for gate-exempt mode types", () => {
    const result = resolveTapAdvanceGate(ADVANCE_GATE_WAITING, { adultConfirmAdvance: true, modeType: "follow_instruction" });
    expect(result).toEqual({ gate: null, shouldAdvance: true });
  });

  it("advances when the gate is already READY", () => {
    const result = resolveTapAdvanceGate(ADVANCE_GATE_READY, { adultConfirmAdvance: true, modeType: "math_houses_grow" });
    expect(result).toEqual({ gate: null, shouldAdvance: true });
  });

  it("promotes WAITING to READY on the first tap for a touch-only, non-exempt mode", () => {
    const result = resolveTapAdvanceGate(ADVANCE_GATE_WAITING, { adultConfirmAdvance: true, modeType: "math_houses_grow" });
    expect(result).toEqual({ gate: ADVANCE_GATE_READY, shouldAdvance: false });
  });

  it("a second tap (now READY) then advances — two taps total, never stuck", () => {
    const first = resolveTapAdvanceGate(ADVANCE_GATE_WAITING, { adultConfirmAdvance: true, modeType: "math_houses_grow" });
    expect(first.shouldAdvance).toBe(false);
    const second = resolveTapAdvanceGate(first.gate, { adultConfirmAdvance: true, modeType: "math_houses_grow" });
    expect(second).toEqual({ gate: null, shouldAdvance: true });
  });
});
