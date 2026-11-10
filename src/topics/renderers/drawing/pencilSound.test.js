import { describe, it, expect, vi } from "vitest";
import { createPencilSound } from "./pencilSound.js";

function setup() {
  const gains = [];
  const node = () => ({ connect: vi.fn(), frequency: { value: 0 }, Q: { value: 0 } });
  const gain = { ...node(), gain: { value: 0, cancelAndHoldAtTime: vi.fn(), setTargetAtTime: vi.fn(value => gains.push(value)) } };
  const context = {
    state: "running", currentTime: 0, sampleRate: 8000, destination: {},
    createGain: () => gain,
    createBuffer: (_channels, length) => ({ getChannelData: () => new Float32Array(length) }),
    createBiquadFilter: node,
    createBufferSource: () => ({ ...node(), start: vi.fn(), stop: vi.fn() }),
    close: vi.fn(() => Promise.resolve()),
  };
  const visibility = new EventTarget(); visibility.hidden = false;
  const factory = vi.fn(() => context);
  return { sound: createPencilSound({ contextFactory: factory, visibilityTarget: visibility }), factory, context, visibility, gains };
}

describe("pencil sound lifecycle", () => {
  it("does not create audio before a gesture or when disabled, and does not sound without movement", () => {
    const { sound, factory, gains } = setup();
    sound.move(0, 0); expect(factory).not.toHaveBeenCalled();
    sound.setEnabled(false); sound.unlock(); expect(factory).not.toHaveBeenCalled();
    sound.setEnabled(true); sound.unlock(); expect(factory).toHaveBeenCalledTimes(1);
    expect(gains).toEqual([]);
    sound.move(0, 0); sound.move(0, 0);
    expect(gains.every(value => value === 0)).toBe(true);
    sound.dispose();
  });
  it("follows movement, mutes on stop/disable/hidden page, and closes resources", () => {
    const { sound, gains, context, visibility } = setup();
    sound.unlock(); sound.move(0, 0); context.currentTime = .016; sound.move(20, 0);
    expect(gains.at(-1)).toBeGreaterThan(0); expect(gains.at(-1)).toBeLessThanOrEqual(.085);
    sound.stop(); expect(gains.at(-1)).toBe(0);
    sound.setEnabled(false); sound.move(40, 0); expect(gains.at(-1)).toBe(0);
    sound.setEnabled(true); sound.move(0, 0); context.currentTime += .016; sound.move(10, 0);
    expect(gains.at(-1)).toBeGreaterThan(0);
    visibility.hidden = true; visibility.dispatchEvent(new Event("visibilitychange"));
    expect(gains.at(-1)).toBe(0); sound.move(40, 0); expect(gains.at(-1)).toBe(0);
    sound.dispose(); expect(context.close).toHaveBeenCalledTimes(1);
    sound.unlock(); expect(context.close).toHaveBeenCalledTimes(1);
  });
  it("lifts the pencil between disconnected shading strokes without a loud movement jump", () => {
    const { sound, gains, context } = setup();
    sound.unlock(); sound.move(0, 0, 1); context.currentTime = .016; sound.move(20, 0, 1);
    expect(gains.at(-1)).toBeGreaterThan(0);
    sound.move(200, 0, 2); expect(gains.at(-1)).toBe(0);
    sound.beginStroke(); expect(gains.at(-1)).toBe(0);
    sound.dispose();
  });
});
