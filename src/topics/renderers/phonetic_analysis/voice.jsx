import { useCallback, useEffect, useRef, useState } from "react";
import { useSpeech } from "@/shared/hooks/useSpeech";
import { useTopicFile } from "@/shared/hooks/useTopicFile";

export const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

// The word is voiced from its recording (word.audio) when the deck has one,
// otherwise by the browser's speech synthesis — a stand-in until the words are
// recorded. While it plays, another tap does nothing (a child with autism may
// tap for the sound itself).
export function useWordVoice({ topicId, playTopicFile }) {
  const { speak } = useSpeech();
  const [playing, setPlaying] = useState(null);
  const busy = useRef(false);
  const play = useCallback(async (word) => {
    if (!word || busy.current) return;
    busy.current = true;
    setPlaying(word.id);
    try {
      if (word.audio && playTopicFile) await playTopicFile(topicId, word.audio);
      else await new Promise((resolve) => { speak(word.word, { rate: 0.8, onEnd: resolve }); window.setTimeout(resolve, 2500); });
    } finally {
      busy.current = false;
      setPlaying(null);
    }
  }, [topicId, playTopicFile, speak]);
  return { play, playing };
}

// Plays the word once when the task appears.
export function useSayOnce(play, word) {
  useEffect(() => {
    const t = window.setTimeout(() => play(word), 350);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [word?.id]);
}

export function Wave() {
  return (
    <svg className="pa-wave" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 9 Q11 12 8 15" /><path d="M12 6 Q17 12 12 18" /><path d="M16 3 Q23 12 16 21" />
    </svg>
  );
}

// A picture that says its word when tapped.
export function Picture({ topicId, word, playing, onTap, className = "", children, ...rest }) {
  const url = useTopicFile(topicId, word?.image);
  return (
    <button
      type="button"
      className={`pa-pic${playing ? " pa-pic--playing" : ""} ${className}`}
      aria-label={word?.word}
      onClick={(event) => { event.stopPropagation(); onTap?.(word); }}
      {...rest}
    >
      {url ? <img src={url} alt="" draggable={false} /> : <span className="pa-pic__emoji">{word?.emoji}</span>}
      <Wave />
      {children}
    </button>
  );
}
