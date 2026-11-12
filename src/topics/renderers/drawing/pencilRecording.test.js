import { expect, it, vi } from 'vitest';
import { createPencilRecordingBuffer } from './pencilRecording';
it('decodes the embedded recording as 24 kHz signed PCM without a network request or asynchronous decoder', () => {
  let samples;
  const context = { createBuffer: vi.fn((channels, length, sampleRate) => {
    samples = new Float32Array(length);
    return { numberOfChannels: channels, sampleRate, getChannelData: () => samples };
  }) };
  const buffer = createPencilRecordingBuffer(context);
  expect(buffer.sampleRate).toBe(24000); expect(buffer.numberOfChannels).toBe(1);
  expect(samples).toHaveLength(26160);
  const rms = Math.sqrt(samples.reduce((sum, v) => sum+v*v, 0)/samples.length);
  expect(rms).toBeGreaterThan(.09); expect(rms).toBeLessThan(.11);
  expect(Math.max(...samples.map(Math.abs))).toBeLessThan(.75);
  expect(Math.min(...samples)).toBeLessThan(-.1); expect(Math.max(...samples)).toBeGreaterThan(.1);
  expect(samples[0]).toBe(0); expect(samples.at(-1)).toBe(0);
});
