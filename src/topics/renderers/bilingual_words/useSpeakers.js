import { useCallback, useEffect, useRef, useState } from "react";

const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

// Plays a word in one language while that side's tile glows. A run is a
// sequence of such steps; starting a new run (or unmounting) cancels the old
// one at its next step, so a prompt can never talk over the child's answer.
// With sound off the tile still glows for a moment: the place stays a cue.
export function useSpeakers(topicId, playTopicFile) {
  const [speaking, setSpeaking] = useState(null);
  const runRef = useRef(0);

  useEffect(() => () => { runRef.current += 1; }, []);

  const startRun = useCallback(() => {
    runRef.current += 1;
    const id = runRef.current;
    const alive = () => runRef.current === id;
    const say = async (lang, card) => {
      if (!alive()) return false;
      setSpeaking(lang);
      await Promise.all([playTopicFile?.(topicId, card?.audio?.[lang]), wait(600)]);
      if (alive()) setSpeaking(null);
      return alive();
    };
    const pause = async (ms) => { await wait(ms); return alive(); };
    return { say, pause, alive };
  }, [topicId, playTopicFile]);

  const cancel = useCallback(() => {
    runRef.current += 1;
    setSpeaking(null);
  }, []);

  return { speaking, startRun, cancel };
}

// The gap between the Russian and the Slovenian word: clearly two words.
export const PAIR_GAP_MS = 700;
