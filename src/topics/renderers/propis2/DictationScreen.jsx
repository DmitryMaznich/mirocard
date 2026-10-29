import { useCallback, useLayoutEffect, useMemo, useState } from "react";
import ReviewScreen from "../propis/DictationReviewScreen";
import { dictationAudioUrl } from "../propis/dictationAudio";
import { useDictationVoice } from "./useDictationVoice";

// «Диктант» in `propis2` (2026-10-29; until then the screen of `propis`, `propis/DictationView.jsx`). Same flow and audio, laid out for
// the child who writes on paper, not on the screen:
// - the circle is the only signal of the phase: waves and bars while the voice sounds; in the silence after it (the time to write, also
//   the pauses between the sentences of a text) nothing moves and the circle steps back, so the eyes go to the paper. No «Слушай/Пиши»
//   labels: tried (2026-10-29), they looked like buttons that do nothing -- the owner's call to drop them;
// - the session as notebook cells (done / now / left), in rows of ten: how much is left is seen, not read;
// - a text shows which of its sentences sounds; a repeat limit shows the listens left as dots under the circle;
// - any screen: one composition drawn in the px of a reference screen and scaled by one unit (--u, dictation.css); portrait = one
//   column, landscape = the circle | a panel as tall as it (the head, cells and «Дальше» inside `.p2d-panel`, `display: contents` in portrait).
// The review screen after the last item is the shared one of `propis` (with this topic's `Answers` and `Grading`).

// Gap after each sentence of a text without the signs voiced (as in `propis/DictationView.jsx`).
const SENTENCE_PAUSE_MS = 2500;

const LEVEL_LABEL = { letters: "Буквы", words: "Слова", texts: "Текст" };

const icon = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, focusable: "false" };
const IconArrow = () => <svg {...icon}><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
const IconCheck = () => <svg {...icon} strokeWidth={3}><path d="M5.5 12.5l4 4 9-9" /></svg>;
const IconClose = () => <svg {...icon} strokeWidth={2.4}><path d="M6 6l12 12M18 6L6 18" /></svg>;

// The cells go in rows of ten with a gap after the fifth, like the beads of an abacus: 40 items are four even rows and "a row and a half
// left" is seen without counting (a plain wrap cut the rows wherever the width ended: 17 + 17 + 6 on a phone).
const cellColumns = (total) => {
  const cols = Math.min(total, 10);
  return cols > 5 ? `repeat(5, var(--cell)) var(--group) repeat(${cols - 5}, var(--cell))` : `repeat(${cols}, var(--cell))`;
};
const cellColumn = (i) => (i % 10 < 5 ? i % 10 + 1 : i % 10 + 2);

export default function DictationScreen({ task, onClose, Answers = null, Grading = null }) {
  const items = task?.items ?? [];
  const total = items.length;
  const level = task?.level ?? "letters";

  const [index, setIndex] = useState(0);
  const [repeatsUsed, setRepeatsUsed] = useState(0);
  const [done, setDone] = useState(false);
  const { isPlaying, speaking, clip, play } = useDictationVoice();

  const item = items[index];

  // One clip per sentence for a text, the voiced signs when the task has them (`item.audio`), else one clip. `sentence` = which
  // sentence of the text the clip belongs to.
  const playbackItems = useMemo(() => {
    if (!item) return [];
    if (item.audio?.length) return item.audio.map((a) => ({ url: dictationAudioUrl(a.key), pauseAfterMs: a.pauseAfterMs ?? 0, sentence: a.sentence ?? 0 }));
    if (item.sentences?.length) return item.sentences.map((s, i) => ({ url: dictationAudioUrl(s.key), pauseAfterMs: SENTENCE_PAUSE_MS, sentence: i }));
    return [{ url: dictationAudioUrl(item.key), sentence: 0 }];
  }, [item]);

  const playCurrent = useCallback(() => {
    if (playbackItems.length) play(playbackItems);
  }, [play, playbackItems]);

  // Auto-play on a real item advance only (a mid-playback re-render must not restart it). A layout effect: the new item never paints
  // in the last item's silence.
  useLayoutEffect(() => {
    playCurrent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const repeatLimit = task?.repeatLimit ?? null;
  const canRepeat = repeatLimit == null || repeatsUsed < repeatLimit;

  function handleRepeat() {
    if (!canRepeat || isPlaying) return;
    setRepeatsUsed((n) => n + 1);
    playCurrent();
  }

  function handleNext() {
    if (isPlaying) return;
    if (index + 1 >= total) setDone(true);
    else {
      setRepeatsUsed(0);
      setIndex((i) => i + 1);
    }
  }

  if (!total) {
    return (
      <div className="p2d-stage">
        <button type="button" className="p2d-close" onClick={onClose} aria-label="Закрыть"><IconClose /></button>
        <div className="p2d-empty">Нет элементов для диктанта — проверьте настройки режима.</div>
      </div>
    );
  }

  if (done) return <ReviewScreen task={task} onClose={onClose} Answers={Answers} Grading={Grading} />;

  const phase = speaking || clip < 0 ? "listen" : "write";
  const sentenceCount = item.sentences?.length ?? 0;
  const sentenceNow = clip >= 0 ? (playbackItems[clip]?.sentence ?? 0) : 0;
  const last = index + 1 >= total;
  const dense = total > 20;

  return (
    <div className={`p2d-stage p2d-stage--${phase}`}>
      <button type="button" className="p2d-close" onClick={onClose} aria-label="Закрыть"><IconClose /></button>

      <div className="p2d-frame">
        <div className="p2d-voice">
          <div className={`p2d-diktor-wrap${speaking ? " is-speaking" : ""}${!isPlaying && !canRepeat ? " is-exhausted" : ""}`}>
            <span className="p2d-ripple" />
            <span className="p2d-ripple" />
            <span className="p2d-ripple" />
            <button type="button" className="p2d-diktor" onClick={handleRepeat} disabled={isPlaying || !canRepeat} aria-label="Слушать ещё раз">
              <span className="p2d-bar" />
              <span className="p2d-bar" />
              <span className="p2d-bar" />
              <span className="p2d-bar" />
            </button>
          </div>
          {repeatLimit != null && repeatLimit > 0 && (
            <div className="p2d-listens" aria-label={`Повторов осталось: ${repeatLimit - repeatsUsed}`}>
              {Array.from({ length: repeatLimit }, (_, i) => <span key={i} className={`p2d-listen${i < repeatLimit - repeatsUsed ? " is-left" : ""}`} />)}
            </div>
          )}
        </div>

        <div className="p2d-panel">
          <header className="p2d-head">
            <div className="p2d-title">
              Диктант
              <span className="p2d-level">{LEVEL_LABEL[level] ?? ""}</span>
            </div>
            <div className="p2d-count" aria-label={`${index + 1} из ${total}`}>
              <b>{index + 1}</b><span>из {total}</span>
            </div>
          </header>

          <ol className={`p2d-cells${dense ? " p2d-cells--dense" : ""}`} style={{ gridTemplateColumns: cellColumns(total) }} aria-hidden="true">
            {items.map((_, i) => (
              <li key={i} className={`p2d-cell${i < index ? " is-done" : i === index ? " is-now" : ""}`} style={{ gridColumn: cellColumn(i) }}>
                {i < index ? <IconCheck /> : i === index && !dense ? i + 1 : null}
              </li>
            ))}
          </ol>

          <div className="p2d-side">
            {sentenceCount > 1 && (
              <div className="p2d-sentences" aria-label={`Предложение ${sentenceNow + 1} из ${sentenceCount}`}>
                <span className="p2d-sentences-label">Предложение</span>
                {Array.from({ length: sentenceCount }, (_, i) => (
                  <span key={i} className={`p2d-sentence${i < sentenceNow ? " is-done" : i === sentenceNow ? " is-now" : ""}`} />
                ))}
              </div>
            )}

            <button type="button" className={`p2d-next${last ? " p2d-next--last" : ""}`} onClick={handleNext} disabled={isPlaying}>
              {last ? "Готово" : "Дальше"}
              {!last && <IconArrow />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
