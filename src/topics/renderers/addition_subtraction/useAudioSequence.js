import { useCallback, useEffect, useRef, useState } from "react";
import { PART_GAP_SECONDS } from "../place_value/numberAudio";

// The clips are trimmed of their silence (owner's-voice bank, 2026-11-11), so
// the pause between them is set here, not baked into the files:
// - a "tight" item is the second word of one number («двадцать»·«четыре»):
//   the same short breath «Разряды числа» uses (PART_GAP_SECONDS, tuned by
//   the owner's ear on 2026-10-12);
// - any other item gets a normal pause between words or phrases.
// The previous Gemini clips carried 0.1–0.4 s of silence at each end and were
// trimmed while playing; doing that to trimmed clips would cut the words.
export const WORD_GAP_SECONDS = 0.35;

// Plays a list of short recordings back to back, like a diktor reading a
// sentence built from separate takes. Every clip is created (and starts
// loading) up front, so the gaps are the intended ones, not loading delays.
// `items` is an array of { url, tight? }.
export function useAudioSequence() {
  const [isPlaying, setIsPlaying] = useState(false);
  const activeRef = useRef([]);
  const timerRef = useRef(null);
  const tokenRef = useRef(0);

  const stopAll = useCallback(() => {
    clearTimeout(timerRef.current);
    activeRef.current.forEach((a) => a.pause());
    activeRef.current = [];
  }, []);

  useEffect(() => stopAll, [stopAll]);

  const play = useCallback((items, onComplete) => {
    stopAll();
    const myToken = ++tokenRef.current;
    setIsPlaying(true);
    const clips = items.map(({ url }) => {
      const audio = new Audio(url);
      audio.preload = "auto";
      return audio;
    });
    activeRef.current = clips;

    const finish = () => {
      if (tokenRef.current !== myToken) return;
      activeRef.current = [];
      setIsPlaying(false);
      onComplete?.();
    };

    function playAt(index) {
      if (tokenRef.current !== myToken) return;
      if (index >= clips.length) { finish(); return; }
      const audio = clips[index];
      let advanced = false;
      const advance = () => {
        if (advanced || tokenRef.current !== myToken) return;
        advanced = true;
        const next = items[index + 1];
        if (!next) { finish(); return; }
        const gap = next.tight ? PART_GAP_SECONDS : WORD_GAP_SECONDS;
        timerRef.current = setTimeout(() => playAt(index + 1), gap * 1000);
      };
      audio.addEventListener("ended", advance, { once: true });
      audio.addEventListener("error", advance, { once: true });
      try {
        const started = audio.play();
        if (started?.catch) started.catch(advance);
      } catch {
        advance();
      }
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
