import { describe, expect, it, vi } from 'vitest';
import { createCarHorn } from './hornSound.js';

function fixture() {
  const parameter = () => ({ value: 0, cancelScheduledValues: vi.fn(), setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() });
  const voices = [], gains = [];
  const context = { currentTime: 2, state: 'running', destination: {}, close: vi.fn(),
    createGain() { const node = { gain: parameter(), connect: vi.fn(), disconnect: vi.fn() }; gains.push(node); return node; },
    createBiquadFilter: () => ({ frequency: parameter(), Q: parameter(), connect: vi.fn(), disconnect: vi.fn() }),
    createOscillator() { const node = { frequency: parameter(), connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn() }; voices.push(node); return node; } };
  const factory = vi.fn(() => context), visibility = { hidden: false };
  return { horn: createCarHorn({ contextFactory: factory, visibilityTarget: visibility }), factory, context, voices, gains, visibility };
}
describe('completion car horn', () => {
  it('creates audio on demand and schedules two short, separated two-tone pulses', () => {
    const { horn, factory, voices, gains } = fixture();
    expect(factory).not.toHaveBeenCalled(); expect(horn.play()).toBe(true);
    expect(voices.map(voice => voice.frequency.value)).toEqual([349, 440]);
    for (const voice of voices) { expect(voice.start).toHaveBeenCalledWith(2); expect(voice.stop).toHaveBeenCalledWith(2.52); }
    expect(gains[0].gain.linearRampToValueAtTime.mock.calls).toEqual([[.055, 2.018], [0, 2.2], [.055, 2.288], [0, 2.47]]);
    horn.dispose();
  });
  it('honours mute and visibility; replay and disposal disconnect old voices', () => {
    const { horn, factory, voices, visibility, context } = fixture();
    horn.setEnabled(false); expect(horn.play()).toBe(false); expect(factory).not.toHaveBeenCalled();
    horn.setEnabled(true); visibility.hidden = true; expect(horn.play()).toBe(false);
    visibility.hidden = false; horn.play(); horn.play();
    expect(factory).toHaveBeenCalledTimes(1); expect(voices[0].disconnect).toHaveBeenCalled();
    horn.setEnabled(false); expect(voices[2].disconnect).toHaveBeenCalled();
    horn.dispose(); expect(context.close).toHaveBeenCalled();
    horn.setEnabled(true); expect(horn.play()).toBe(false);
  });
});
