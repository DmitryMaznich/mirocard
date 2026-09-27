import { useCallback, useEffect, useMemo, useState } from "react";
import ProgressBar from "@/shared/components/ProgressBar";
import ReviewScreen from "./DictationReviewScreen";
import { dictationAudioUrl, caseWordDictationKey } from "./dictationAudio";
import { useDictationPlayer } from "./useDictationPlayer";

// Gap after each sentence within a text, so the child has time to write it before the next
// one starts -- user's explicit call (2026-09-17): sentence by sentence, with a pause, not
// the whole text read in one breath.
const SENTENCE_PAUSE_MS = 2500;
// Shorter gap between "заглавная"/"строчная" and the letter's own sound -- long enough that
// the two clips read as two separate words, not so long the pause feels like a second item.
const CASE_WORD_PAUSE_MS = 500;

export default function DictationView({ task, onClose }) {
  const items = task?.items ?? [];
  const total = items.length;

  const [index, setIndex] = useState(0);
  const [repeatsUsed, setRepeatsUsed] = useState(0);
  const [done, setDone] = useState(false);
  const { isPlaying, play } = useDictationPlayer();

  const item = items[index];

  // Three shapes: one clip per sentence (with a pause after each) for texts (item.sentences
  // only exists on text-level items); two clips -- case word, then the letter's own sound --
  // for letters (item.soundKey only exists there, see engine.js's dictation branch); a
  // single clip for words.
  const playbackItems = useMemo(() => {
    if (!item) return [];
    if (item.sentences?.length) {
      return item.sentences.map((s) => ({ url: dictationAudioUrl(s.key), pauseAfterMs: SENTENCE_PAUSE_MS }));
    }
    if (item.soundKey) {
      return [
        { url: dictationAudioUrl(caseWordDictationKey(item.isUpper)), pauseAfterMs: CASE_WORD_PAUSE_MS },
        { url: dictationAudioUrl(item.soundKey) },
      ];
    }
    return [{ url: dictationAudioUrl(item.key) }];
  }, [item]);

  const playCurrent = useCallback(() => {
    if (playbackItems.length) play(playbackItems);
  }, [play, playbackItems]);

  // Auto-play as soon as a new item comes up (matches AudioOperationTask's precedent in
  // addition_subtraction) -- not on every playbackItems identity change, only on a real
  // item advance, so a mid-playback re-render can't restart it from the top.
  useEffect(() => {
    setRepeatsUsed(0);
    playCurrent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const unlimitedRepeats = task?.repeatLimit == null;
  const canRepeat = unlimitedRepeats || repeatsUsed < task.repeatLimit;

  function handleRepeat() {
    if (!canRepeat || isPlaying) return;
    setRepeatsUsed((n) => n + 1);
    playCurrent();
  }

  function handleNext() {
    if (isPlaying) return;
    if (index + 1 >= total) setDone(true);
    else setIndex((i) => i + 1);
  }

  if (!total) {
    return (
      <div className="propis-dictation-stage">
        <button type="button" className="propis-ctrl-btn propis-dictation-close" onClick={onClose} aria-label="Закрыть">✕</button>
        <div className="propis-dictation-empty">Нет элементов для диктанта — проверьте настройки режима.</div>
      </div>
    );
  }

  if (done) {
    return <ReviewScreen task={task} onClose={onClose} />;
  }

  return (
    <div className="propis-dictation-stage">
      <button type="button" className="propis-ctrl-btn propis-dictation-close" onClick={onClose} aria-label="Закрыть">✕</button>

      <div className="propis-dictation-frame">
        <div className="propis-dictation-title">Диктант</div>
        <ProgressBar className="propis-dictation-progressbar" value={index + 1} max={total} />

        <div
          className={`propis-dictation-diktor-wrap${isPlaying ? " propis-dictation-diktor-wrap--playing" : ""}${!isPlaying && !canRepeat ? " propis-dictation-diktor-wrap--exhausted" : ""}`}
        >
          <span className="propis-dictation-ripple" />
          <span className="propis-dictation-ripple" />
          <span className="propis-dictation-ripple" />
          <button
            type="button"
            className="propis-dictation-diktor"
            onClick={handleRepeat}
            disabled={isPlaying || !canRepeat}
            aria-label="Слушать ещё раз"
          >
            <span className="propis-dictation-bar" />
            <span className="propis-dictation-bar" />
            <span className="propis-dictation-bar" />
            <span className="propis-dictation-bar" />
          </button>
        </div>

        <div className="propis-dictation-actions">
          <button
            type="button"
            className="propis-dictation-next"
            onClick={handleNext}
            disabled={isPlaying}
          >
            {index + 1 >= total ? "Готово" : "Дальше →"}
          </button>
        </div>
      </div>
    </div>
  );
}
