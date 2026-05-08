import { useState, useCallback, useRef } from "react";
import { getDb, topics } from "@/core/db";

export function useAudio() {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const currentRef = useRef(null);
  const genRef     = useRef(0);

  const stop = useCallback(() => {
    genRef.current++;
    if (currentRef.current) {
      currentRef.current.pause();
      currentRef.current = null;
    }
  }, []);

  const playFeedback = useCallback((kind) => {
    if (!soundEnabled) return;
    stop();
    const src = kind === "correct" ? "/sounds/correct.wav" : "/sounds/incorrect.wav";
    try {
      const audio = new Audio(src);
      currentRef.current = audio;
      audio.play().catch(() => {});
    } catch {}
  }, [soundEnabled, stop]);

  const playTopicFile = useCallback(async (topicId, filePath) => {
    if (!soundEnabled || !topicId || !filePath) return;
    stop();
    const myGen = genRef.current;
    try {
      const db = await getDb();
      if (genRef.current !== myGen) return;
      const blob = await topics.getFile(db, topicId, filePath);
      if (genRef.current !== myGen) return;
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      if (genRef.current !== myGen) { URL.revokeObjectURL(url); return; }
      currentRef.current = audio;
      audio.onended = () => URL.revokeObjectURL(url);
      audio.onerror = () => URL.revokeObjectURL(url);
      await audio.play();
    } catch {}
  }, [soundEnabled, stop]);

  const toggleSound = useCallback(() => setSoundEnabled((v) => !v), []);

  return { soundEnabled, toggleSound, playFeedback, playTopicFile };
}
