// A short, quiet two-tone car horn. Audio is created only by the explicit
// completion gesture; replay never overlaps voices and cancellation mutes it.
export function createCarHorn({ contextFactory, visibilityTarget = document } = {}) {
  let context = null, gain = null, filter = null, voices = [], enabled = true, disposed = false;
  function stop() {
    try {
      if (gain && context?.state !== 'closed') {
        gain.gain.cancelScheduledValues(context.currentTime);
        gain.gain.setValueAtTime(0, context.currentTime);
      }
      for (const voice of voices) {
        try { voice.stop(); } catch { /* Already ended. */ }
        try { voice.disconnect(); } catch { /* Already disconnected. */ }
      }
      gain?.disconnect(); filter?.disconnect();
    } catch { /* Audio availability must never affect the drawing. */ }
    voices = []; gain = null; filter = null;
  }
  function play() {
    stop();
    if (!enabled || disposed || visibilityTarget.hidden) return false;
    try {
      if (!context || context.state === 'closed') {
        const Ctx = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!contextFactory && !Ctx) return false;
        context = contextFactory ? contextFactory() : new Ctx();
      }
      if (context.state === 'suspended') context.resume()?.catch(() => {});
      gain = context.createGain(); gain.gain.value = 0;
      filter = context.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 1800; filter.Q.value = .5;
      gain.connect(filter); filter.connect(context.destination);
      const now = context.currentTime;
      gain.gain.setValueAtTime(0, now);
      for (const offset of [0, .27]) {
        gain.gain.setValueAtTime(0, now+offset);
        gain.gain.linearRampToValueAtTime(.055, now+offset+.018);
        gain.gain.setValueAtTime(.055, now+offset+.15);
        gain.gain.linearRampToValueAtTime(0, now+offset+.20);
      }
      voices = [349, 440].map(frequency => {
        const voice = context.createOscillator(); voice.type = 'triangle'; voice.frequency.value = frequency;
        voice.connect(gain); voice.start(now); voice.stop(now+.52); return voice;
      });
      return true;
    } catch { stop(); return false; }
  }
  return {
    play, stop,
    setEnabled(value) { enabled = Boolean(value); if (!enabled) stop(); },
    dispose() { stop(); disposed = true; try { context?.close()?.catch(() => {}); } catch { /* Already closed. */ } },
  };
}
