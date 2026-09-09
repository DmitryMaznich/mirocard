import { useCallback, useEffect, useRef, useState } from "react";

// The recorded word clips each carry ~190-220ms of trailing silence and
// ~80-130ms of leading silence (measured directly off the generated mp3s).
// For a "tight" transition (see `items[].tight`) we cut both: the earlier
// clip hands off before its tail runs out, and the tight clip itself starts
// partway past its own lead-in — leaving a safety margin so no word's own
// sound is ever clipped.
const TIGHT_TRAIL_TRIM_SECONDS = 0.15;
const TIGHT_LEAD_SKIP_SECONDS = 0.05;

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
  const audioRef = useRef(null);
  const tokenRef = useRef(0);

  useEffect(() => () => { audioRef.current?.pause(); }, []);

  const play = useCallback((items) => {
    audioRef.current?.pause();
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
      audioRef.current = audio;

      let advanced = false;
      const advance = () => {
        if (advanced) return;
        advanced = true;
        // Advancing early (the trailing-trim timeout) doesn't stop this
        // clip on its own — without an explicit pause it keeps sounding
        // in the background and overlaps the next word.
        audio.pause();
        playAt(index + 1);
      };

      audio.onended = advance;
      audio.onerror = advance;
      audio.addEventListener("loadedmetadata", () => {
        if (tokenRef.current !== myToken) return;
        const startAt = tight ? Math.min(TIGHT_LEAD_SKIP_SECONDS, audio.duration / 3) : 0;
        audio.currentTime = startAt;
        if (nextIsTight) {
          const delayMs = Math.max(0, audio.duration - startAt - TIGHT_TRAIL_TRIM_SECONDS) * 1000;
          setTimeout(() => { if (tokenRef.current === myToken) advance(); }, delayMs);
        }
        audio.play().catch(advance);
      }, { once: true });
    }

    playAt(0);
  }, []);

  const stop = useCallback(() => {
    tokenRef.current += 1;
    audioRef.current?.pause();
    setIsPlaying(false);
  }, []);

  return { isPlaying, play, stop };
}
