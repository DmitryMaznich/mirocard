import { useCallback, useEffect, useRef, useState } from "react";

// Measured directly off the generated mp3s (Web Audio decode, amplitude
// threshold 0.01): tens words (n20..n90) carry 182-224ms of trailing
// silence, ones words (n1..n9) carry 79-128ms of leading silence. For a
// "tight" transition (see `items[].tight`) we trim both close to those
// floors — leaving only a small safety margin, never clipping a word's own
// sound — and then nudge the next word's start earlier still, so its quiet
// lead-in overlaps the previous word's fading tail instead of just abutting
// it. At this overlap size that reaches slightly past the pure-silence
// margin into the last, already-quiet moment of some words' tails (not
// their core sound) — tuned up from 30ms by ear across two rounds of
// feedback; push further only after listening again.
const TIGHT_TRAIL_TRIM_SECONDS = 0.17;
const TIGHT_LEAD_SKIP_SECONDS = 0.065;
const TIGHT_OVERLAP_SECONDS = 0.07;

// Plays a list of short word recordings back to back, like a diktor reading
// a sentence built from separate takes. Chains plain <audio> elements via
// "ended" (no Web Audio decoding/splicing needed for word-at-a-time speech —
// the small natural gap between files reads as a spoken pause, not a glitch)
// so it works the same on every browser without CORS/decode concerns.
// `items` is an array of { url, tight? } — a tight item is glued to the
// previous one, for words that belong to the same spoken number (e.g.
// "двадцать"+"четыре" for 24).
export function useAudioSequence() {
  const [isPlaying, setIsPlaying] = useState(false);
  // Every clip currently sounding, including a tight transition's outgoing
  // clip left to finish its (already near-silent) tail in the background —
  // tracked here, not just the latest one, so a fresh play()/stop() call
  // silences all of them instead of leaking that overlap indefinitely.
  const activeRef = useRef([]);
  const tokenRef = useRef(0);

  const stopAll = useCallback(() => {
    activeRef.current.forEach((a) => a.pause());
    activeRef.current = [];
  }, []);

  useEffect(() => stopAll, [stopAll]);

  const play = useCallback((items) => {
    stopAll();
    const myToken = ++tokenRef.current;
    setIsPlaying(true);

    function playAt(index) {
      if (tokenRef.current !== myToken) return;
      if (index >= items.length) { setIsPlaying(false); return; }
      const { url, tight } = items[index];
      // "tight" on an item means IT wants to be glued to the previous one;
      // that previous clip's own trailing silence is what needs trimming.
      const nextIsTight = items[index + 1]?.tight === true;
      const audio = new Audio(url);
      activeRef.current.push(audio);

      let advanced = false;
      const advance = () => {
        if (advanced) return;
        advanced = true;
        playAt(index + 1);
      };

      audio.addEventListener("ended", () => {
        activeRef.current = activeRef.current.filter((a) => a !== audio);
        advance();
      });
      audio.addEventListener("error", () => {
        activeRef.current = activeRef.current.filter((a) => a !== audio);
        advance();
      });
      audio.addEventListener("loadedmetadata", () => {
        if (tokenRef.current !== myToken) return;
        const startAt = tight ? Math.min(TIGHT_LEAD_SKIP_SECONDS, audio.duration / 3) : 0;
        audio.currentTime = startAt;
        if (nextIsTight) {
          // Deliberately don't pause this clip when the timer fires — it
          // keeps playing its last, already-quiet moment underneath the
          // next word (the overlap), and cleans itself up via "ended" above.
          const delayMs = Math.max(0, audio.duration - startAt - TIGHT_TRAIL_TRIM_SECONDS - TIGHT_OVERLAP_SECONDS) * 1000;
          setTimeout(() => { if (tokenRef.current === myToken) advance(); }, delayMs);
        }
        audio.play().catch(advance);
      }, { once: true });
    }

    playAt(0);
  }, [stopAll]);

  const stop = useCallback(() => {
    tokenRef.current += 1;
    stopAll();
    setIsPlaying(false);
  }, [stopAll]);

  return { isPlaying, play, stop };
}
