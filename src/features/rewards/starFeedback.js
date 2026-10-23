export function playRewardStarSound() {
  try {
    const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AudioContext) return;
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.frequency.value = 520;
    gain.gain.setValueAtTime(.025, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + .12);
    oscillator.start();
    oscillator.stop(context.currentTime + .13);
    oscillator.onended = () => context.close();
    context.resume().catch(() => context.close());
  } catch { /* Sound is optional; stars must still work if audio is blocked. */ }
}
