import { useCallback, useEffect, useRef, useState } from "react";

// How much of a clip's trailing silence to skip before starting the next
// one, for a "tight" transition (see `items[].tight`). Trims the gap without
// cutting into the spoken word itself.
const TIGHT_TRIM_SECONDS = 0.15;

// Plays a list of short word recordings back to back, like a diktor reading
// a sentence built from separate takes. Chains plain <audio> elements via
// "ended" (no Web Audio decoding/splicing needed for word-at-a-time speech —
// the small natural gap between files reads as a spoken pause, not a glitch)
// so it works the same on every browser without CORS/decode concerns.
// `items` is an array of { url, tight? } — a tight item starts early,
// trimming the previous clip's trailing silence, for words that belong to
// the same spoken number (e.g. "двадцать"+"четыре" for 24).
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
      const audio = new Audio(url);
      audioRef.current = audio;

      let advanced = false;
      const advance = () => {
        if (advanced) return;
        advanced = true;
        playAt(index + 1);
      };

      audio.onended = advance;
      audio.onerror = advance;
      if (tight) {
        audio.addEventListener("loadedmetadata", () => {
          const delayMs = Math.max(0, audio.duration - TIGHT_TRIM_SECONDS) * 1000;
          setTimeout(() => { if (tokenRef.current === myToken) advance(); }, delayMs);
        });
      }
      audio.play().catch(advance);
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
