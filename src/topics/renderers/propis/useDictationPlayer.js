import { useCallback, useEffect, useRef, useState } from "react";

// Plays a sequence of plain <audio> clips back to back, like useAudioSequence
// (addition_subtraction) -- not reused directly, since that hook has no notion of a pause
// between items, and "Диктант" needs one specifically for texts (each sentence gets its own
// clip, with a silent gap after it so the child has time to write before the next sentence
// starts -- see propisDictation's SENTENCE_PAUSE_MS). Kept here, not shared, per this
// project's per-family "duplicated, not shared" convention for topic-specific logic.
//
// `items` is an array of { url, pauseAfterMs? } -- pauseAfterMs defaults to 0 (letters/words
// are a single clip, no pause needed). A clip that fails to load (e.g. the audio file hasn't
// been recorded yet) still advances instead of getting the sequence stuck.
export function useDictationPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const activeRef = useRef(null);
  const timeoutRef = useRef(null);
  const tokenRef = useRef(0);

  const stop = useCallback(() => {
    tokenRef.current += 1;
    clearTimeout(timeoutRef.current);
    activeRef.current?.pause();
    activeRef.current = null;
    setIsPlaying(false);
  }, []);

  useEffect(() => stop, [stop]);

  const play = useCallback((items) => {
    stop();
    if (!items?.length) return;
    const myToken = tokenRef.current;
    setIsPlaying(true);

    function playAt(index) {
      if (tokenRef.current !== myToken) return;
      if (index >= items.length) {
        setIsPlaying(false);
        return;
      }
      const { url, pauseAfterMs = 0 } = items[index];
      const audio = new Audio(url);
      activeRef.current = audio;

      let advanced = false;
      const advance = () => {
        if (advanced || tokenRef.current !== myToken) return;
        advanced = true;
        timeoutRef.current = setTimeout(() => playAt(index + 1), pauseAfterMs);
      };

      audio.addEventListener("ended", advance, { once: true });
      audio.addEventListener("error", advance, { once: true });
      audio.play().catch(advance);
    }

    playAt(0);
  }, [stop]);

  return { isPlaying, play, stop };
}
