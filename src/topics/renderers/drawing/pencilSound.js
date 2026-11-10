// A quiet procedural graphite/paper texture. No recordings or per-step assets.
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
        const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
        const data = buffer.getChannelData(0);
        let seed = 31, b0 = 0, b1 = 0, b2 = 0, grain = .8;
        for (let i = 0; i < data.length; i++) {
          seed = (seed * 1664525 + 1013904223) >>> 0;
          const white = seed / 2147483648 - 1;
          b0 = .99765 * b0 + white * .099046;
          b1 = .963 * b1 + white * .2965164;
          b2 = .57 * b2 + white * 1.0526913;
          if (i % 240 === 0) grain = .55 + (white + 1) * .225;
          data[i] = ((b0 + b1 + b2 + white * .1848) * .10 + white * .11) * grain;
        }
        const high = context.createBiquadFilter(); high.type = "highpass"; high.frequency.value = 420;
        const paper = context.createBiquadFilter(); paper.type = "bandpass"; paper.frequency.value = 1750; paper.Q.value = .55;
        const low = context.createBiquadFilter(); low.type = "lowpass"; low.frequency.value = 4100;
        source = context.createBufferSource(); source.buffer = buffer; source.loop = true;
        source.connect(high); high.connect(paper); paper.connect(low); low.connect(gain); gain.connect(context.destination);
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
    level(pressure * (.88 + .12 * Math.sin(now * 43)));
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
