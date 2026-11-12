import { createPencilRecordingBuffer } from "./pencilRecording.js";

// One quiet recorded pencil texture, reused for every drawing and step.
// The graph is created only in an explicit user gesture; motion controls gain.
export function createPencilSound({ contextFactory, visibilityTarget = document } = {}) {
  let context = null, gain = null, source = null, previous = null;
  let enabled = true, disposed = false;
  const hidden = () => Boolean(visibilityTarget.hidden);

  function level(value) {
    if (!gain || context.state === "closed") return;
    const now = context.currentTime;
    if (gain.gain.cancelAndHoldAtTime) gain.gain.cancelAndHoldAtTime(now);
    else gain.gain.cancelScheduledValues(now);
    gain.gain.setTargetAtTime(value, now, value ? .008 : .004);
  }
  function stop() { previous = null; level(0); }

  function unlock() {
    if (!enabled || disposed || hidden()) return;
    try {
      if (!context) {
        const Ctx = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!contextFactory && !Ctx) return;
        context = contextFactory ? contextFactory() : new Ctx();
        gain = context.createGain(); gain.gain.value = 0;
        const buffer = createPencilRecordingBuffer(context);
        const high = context.createBiquadFilter(); high.type = "highpass"; high.frequency.value = 140;
        const low = context.createBiquadFilter(); low.type = "lowpass"; low.frequency.value = 6500;
        source = context.createBufferSource(); source.buffer = buffer; source.loop = true;
        source.connect(high); high.connect(low); low.connect(gain); gain.connect(context.destination);
        source.start(); // The gain is zero until the point actually moves.
      }
      if (context.state === "suspended") context.resume()?.catch(() => {});
    } catch {
      // Missing/blocked audio never prevents the drawing lesson from running.
      stop();
    }
  }

  function move(x, y, stroke = 0) {
    if (!enabled || disposed || hidden() || !context || context.state !== "running") { stop(); return; }
    const now = context.currentTime;
    if (!previous || previous.stroke !== stroke) { level(0); previous = { x, y, time: now, stroke }; return; }
    const distance = Math.hypot(x - previous.x, y - previous.y);
    const speed = distance / Math.max(1 / 120, now - previous.time);
    previous = { x, y, time: now, stroke };
    if (distance < .02) { level(0); return; }
    const pressure = Math.min(.085, .028 + speed * .00012);
    level(pressure);
  }

  const onVisibility = () => { if (hidden()) stop(); };
  visibilityTarget.addEventListener("visibilitychange", onVisibility);
  return {
    unlock, move, stop,
    beginStroke() { stop(); },
    setEnabled(value) { enabled = Boolean(value); if (!enabled) stop(); },
    dispose() {
      if (disposed) return;
      stop(); disposed = true;
      visibilityTarget.removeEventListener("visibilitychange", onVisibility);
      try { source?.stop(); } catch { /* Already stopped. */ }
      try { context?.close()?.catch(() => {}); } catch { /* Already closed. */ }
    },
  };
}
