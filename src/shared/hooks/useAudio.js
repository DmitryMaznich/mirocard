import { useState, useCallback, useEffect, useRef } from "react";
import { getDb, topics } from "@/core/db";

const FEEDBACK_SOURCES = {
  correct: "/sounds/correct.wav",
  incorrect: "/sounds/incorrect.wav",
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
  const [isTopicAudioPlaying, setIsTopicAudioPlaying] = useState(false);
  const currentRef = useRef(null);
  const currentCleanupRef = useRef(null);
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
    currentCleanupRef.current?.();
    currentCleanupRef.current = null;
    setIsTopicAudioPlaying(false);
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

  // A coordinate can be assembled from a letter recording and a number
  // recording. Loading the whole short sequence before it starts means a
  // missing component cannot leave the child with a half-spoken command.
  const playTopicFiles = useCallback(async (topicId, filePaths) => {
    const paths = (Array.isArray(filePaths) ? filePaths : [filePaths]).filter(Boolean);
    if (!soundEnabled || !topicId || !paths.length) return false;
    stop();
    const myGen = genRef.current;
    try {
      const db = await getDb();
      if (genRef.current !== myGen) return false;
      const blobs = [];
      for (const path of paths) {
        const blob = await topics.getFile(db, topicId, path);
        if (genRef.current !== myGen) return false;
        if (!blob) return false;
        blobs.push(blob);
      }

      for (let index = 0; index < blobs.length; index += 1) {
        if (genRef.current !== myGen) return false;
        const blob = blobs[index];
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.playsInline = true;
        currentRef.current = audio;

        const completed = await new Promise((resolve) => {
          let settled = false;
          let cancelCurrent = null;
          const finish = (played) => {
            if (settled) return;
            settled = true;
            audio.onended = null;
            audio.onerror = null;
            URL.revokeObjectURL(url);
            if (currentRef.current === audio) currentRef.current = null;
            if (currentCleanupRef.current === cancelCurrent) currentCleanupRef.current = null;
            resolve(played);
          };
          cancelCurrent = () => finish(false);
          currentCleanupRef.current = cancelCurrent;
          audio.onended = () => finish(true);
          audio.onerror = () => finish(false);
          audio.play()
            .then(() => {
              if (genRef.current === myGen && currentRef.current === audio) setIsTopicAudioPlaying(true);
            })
            .catch(() => finish(false));
        });
        if (!completed || genRef.current !== myGen) return false;
        if (index + 1 < blobs.length) await new Promise((resolve) => window.setTimeout(resolve, 120));
      }
      return true;
    } catch {
      // Topic audio is best-effort because browsers can still reject playback.
      return false;
    } finally {
      if (genRef.current === myGen) {
        currentRef.current = null;
        currentCleanupRef.current = null;
        setIsTopicAudioPlaying(false);
      }
    }
  }, [soundEnabled, stop]);

  const playTopicFile = useCallback(
    (topicId, filePath) => playTopicFiles(topicId, [filePath]),
    [playTopicFiles],
  );

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

  return { soundEnabled, toggleSound, playFeedback, playTopicFile, playTopicFiles, isAudioPlaying, isTopicAudioPlaying };
}
