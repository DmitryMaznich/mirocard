import { useCallback, useEffect, useRef, useState } from "react";

// Plays a list of short word recordings back to back, like a diktor reading
// a sentence built from separate takes. Chains plain <audio> elements via
// "ended" (no Web Audio decoding/splicing needed for word-at-a-time speech —
// the small natural gap between files reads as a spoken pause, not a glitch)
// so it works the same on every browser without CORS/decode concerns.
export function useAudioSequence() {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);
  const tokenRef = useRef(0);

  useEffect(() => () => { audioRef.current?.pause(); }, []);

  const play = useCallback((urls) => {
    audioRef.current?.pause();
    const myToken = ++tokenRef.current;
    setIsPlaying(true);

    function playAt(index) {
      if (tokenRef.current !== myToken) return;
      if (index >= urls.length) { setIsPlaying(false); return; }
      const audio = new Audio(urls[index]);
      audioRef.current = audio;
      audio.onended = () => playAt(index + 1);
      audio.onerror = () => playAt(index + 1);
      audio.play().catch(() => playAt(index + 1));
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
