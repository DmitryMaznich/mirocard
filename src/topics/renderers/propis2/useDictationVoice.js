import { useCallback, useEffect, useRef, useState } from "react";

// The dictation's player in `propis2`: `propis/useDictationPlayer.js` (clips back to back, a pause after each, a clip that fails
// still advances), plus what the screen needs to show the child WHEN to write: `speaking` is true only while a clip sounds (false
// in the pause after it -- that pause is the time to write), `clip` is the index of the clip that sounds or was last heard.
// An own copy, not a change to `propis` (archived topic, no new work there).
export function useDictationVoice() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [clip, setClip] = useState(-1);
  const activeRef = useRef(null);
  const timeoutRef = useRef(null);
  const tokenRef = useRef(0);

  const stop = useCallback(() => {
    tokenRef.current += 1;
    clearTimeout(timeoutRef.current);
    activeRef.current?.pause();
    activeRef.current = null;
    setIsPlaying(false);
    setSpeaking(false);
  }, []);

  useEffect(() => stop, [stop]);

  const play = useCallback((items) => {
    stop();
    setClip(-1);
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
      setClip(index);
      setSpeaking(true);

      let advanced = false;
      const advance = () => {
        if (advanced || tokenRef.current !== myToken) return;
        advanced = true;
        setSpeaking(false);
        timeoutRef.current = setTimeout(() => playAt(index + 1), pauseAfterMs);
      };

      audio.addEventListener("ended", advance, { once: true });
      audio.addEventListener("error", advance, { once: true });
      audio.play().catch(advance);
    }

    playAt(0);
  }, [stop]);

  return { isPlaying, speaking, clip, play, stop };
}
