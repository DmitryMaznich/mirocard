import { useState, useCallback, useEffect, useRef } from "react";
import { getDb, topics } from "@/core/db";

const FEEDBACK_SOURCES = {
  correct: "/sounds/correct.wav",
  incorrect: "/sounds/incorrect.mp3",
};

function createAudio(src) {
  const audio = new Audio(src);
  audio.preload = "auto";
  audio.playsInline = true;
  audio.load();
  return audio;
}

export function useAudio() {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const currentRef = useRef(null);
  const genRef     = useRef(0);
  const feedbackRef = useRef(null);
  const unlockedRef = useRef(false);

  const getFeedbackAudio = useCallback((kind) => {
    if (!feedbackRef.current) {
      feedbackRef.current = {
        correct: createAudio(FEEDBACK_SOURCES.correct),
        incorrect: createAudio(FEEDBACK_SOURCES.incorrect),
      };
    }
    return feedbackRef.current[kind];
  }, []);

  const unlockFeedbackAudio = useCallback(() => {
    if (unlockedRef.current || !soundEnabled) return;
    unlockedRef.current = true;

    for (const kind of Object.keys(FEEDBACK_SOURCES)) {
      const audio = getFeedbackAudio(kind);
      const previousMuted = audio.muted;
      audio.muted = true;
      audio.currentTime = 0;
      audio.play()
        .then(() => {
          audio.pause();
          audio.currentTime = 0;
          audio.muted = previousMuted;
        })
        .catch(() => {
          audio.muted = previousMuted;
          unlockedRef.current = false;
        });
    }
  }, [getFeedbackAudio, soundEnabled]);

  useEffect(() => {
    getFeedbackAudio("correct");
    getFeedbackAudio("incorrect");
  }, [getFeedbackAudio]);

  useEffect(() => {
    if (!soundEnabled) return undefined;

    const options = { passive: true, capture: true };
    document.addEventListener("pointerdown", unlockFeedbackAudio, options);
    document.addEventListener("touchstart", unlockFeedbackAudio, options);
    document.addEventListener("click", unlockFeedbackAudio, options);

    return () => {
      document.removeEventListener("pointerdown", unlockFeedbackAudio, options);
      document.removeEventListener("touchstart", unlockFeedbackAudio, options);
      document.removeEventListener("click", unlockFeedbackAudio, options);
    };
  }, [soundEnabled, unlockFeedbackAudio]);

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
    try {
      unlockFeedbackAudio();
      const audio = getFeedbackAudio(kind === "correct" ? "correct" : "incorrect");
      audio.pause();
      audio.muted = false;
      audio.currentTime = 0;
      currentRef.current = audio;
      audio.play().catch(() => {});
    } catch {
      // Feedback sounds are optional; the visual confirmation remains primary.
    }
  }, [getFeedbackAudio, soundEnabled, stop, unlockFeedbackAudio]);

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
      audio.playsInline = true;
      if (genRef.current !== myGen) { URL.revokeObjectURL(url); return; }
      currentRef.current = audio;
      audio.onended = () => URL.revokeObjectURL(url);
      audio.onerror = () => URL.revokeObjectURL(url);
      await audio.play();
    } catch {
      // Topic audio is best-effort because browsers can still reject playback.
    }
  }, [soundEnabled, stop]);

  const toggleSound = useCallback(() => {
    setSoundEnabled((v) => {
      const next = !v;
      if (next) {
        unlockedRef.current = false;
        window.setTimeout(unlockFeedbackAudio, 0);
      }
      return next;
    });
  }, [unlockFeedbackAudio]);

  const isAudioPlaying = useCallback(() => {
    const a = currentRef.current;
    return Boolean(a && !a.paused && !a.ended);
  }, []);

  return { soundEnabled, toggleSound, playFeedback, playTopicFile, isAudioPlaying };
}
