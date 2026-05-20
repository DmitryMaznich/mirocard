import { useState, useEffect, useRef }                                                from "react";
import { DndContext, DragOverlay, PointerSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core";
import SentenceRow, { SLOT_TYPES } from "./SentenceRow";
import CardPool                    from "./CardPool";
import PuzzlePieceSvg              from "./PuzzlePiece";

function speakRu(text, { onStart, onEnd } = {}) {
  const synth = window.speechSynthesis;
  if (!synth) return null;
  synth.cancel();

  let stopped = false;

  function cancel() {
    stopped = true;
    synth.cancel();
  }

  // Speak the full sentence in one utterance so the TTS language model has
  // enough context to correctly stress words like тяжёлую (word-by-word mode
  // strips context and causes vowel reduction errors: тяжЁлую → тяжАлую).
  const utt = new SpeechSynthesisUtterance(text);
  utt.lang  = "ru-RU";
  utt.rate  = 0.9;
  utt.onstart = () => { if (!stopped) onStart?.(); };
  utt.onend   = () => { if (!stopped) onEnd?.(); };
  utt.onerror = () => { if (!stopped) onEnd?.(); };
  synth.speak(utt);

  return cancel;
}

export default function ListenBuildView({
  task, topicId, soundEnabled, playTopicFile, playFeedback, onCorrect, onMistake,
}) {
  const slotTypes    = SLOT_TYPES[task.structure] ?? SLOT_TYPES.simple;
  const sentenceText = slotTypes.map((t) => task.target[t]?.pronounce ?? task.target[t]?.label ?? "").join(" ");

  const [placed,          setPlaced]          = useState(() => Object.fromEntries(slotTypes.map((t) => [t, null])));
  const [pool,            setPool]            = useState(() => [...task.pool]);
  const [showError,       setShowError]       = useState(false);
  const [speaking,        setSpeaking]        = useState(false);
  const [activeCard,      setActiveCard]      = useState(null);
  const [activeSlotIndex, setActiveSlotIndex] = useState(0);
  const [replayCount,     setReplayCount]     = useState(0);
  const errorTimer  = useRef(null);
  const ttsCancel   = useRef(null);

  const activeSlotType = slotTypes[activeSlotIndex] ?? null;

  const hasTts = !!window.speechSynthesis;

  function startTts() {
    ttsCancel.current?.();
    ttsCancel.current = speakRu(sentenceText, {
      onStart: () => setSpeaking(true),
      onEnd:   () => setSpeaking(false),
    });
  }

  useEffect(() => {
    if (!soundEnabled) return;
    if (task.audioPath) {
      playTopicFile(topicId, task.audioPath);
    } else if (hasTts) {
      const t = setTimeout(startTts, 350);
      return () => clearTimeout(t);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => {
    clearTimeout(errorTimer.current);
    ttsCancel.current?.();
  }, []);

  const isComplete = slotTypes.every((t) => placed[t] !== null);

  useEffect(() => {
    if (!isComplete) return;
    const t = setTimeout(() => onCorrect(), 600);
    return () => clearTimeout(t);
  }, [isComplete]); // eslint-disable-line react-hooks/exhaustive-deps

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 150, tolerance: 5 } }),
  );

  function handleDragStart({ active }) {
    setActiveCard(active.data.current?.card ?? null);
  }

  function handleDragEnd({ active, over }) {
    setActiveCard(null);
    if (!over) return;
    const card = active.data.current?.card;
    if (!card) return;
    const { slotType } = over.data.current ?? {};
    if (!slotType) return;

    if (placed[slotType] !== null) return;

    // Slots must be filled in order; dropping on the wrong slot counts as a mistake.
    if (slotType !== activeSlotType || card.id !== task.target[slotType]?.id) {
      if (soundEnabled) playFeedback?.("incorrect");
      onMistake?.(null, null);
      setShowError(true);
      clearTimeout(errorTimer.current);
      errorTimer.current = setTimeout(() => setShowError(false), 550);
      return;
    }

    setPlaced((prev) => ({ ...prev, [slotType]: card }));
    setPool((prev) => prev.filter((c) => c.id !== card.id));
    setActiveSlotIndex((prev) => prev + 1);
  }

  const MAX_REPLAYS = 3;

  function handleReplay() {
    if (replayCount >= MAX_REPLAYS) return;
    setReplayCount((c) => c + 1);
    if (task.audioPath) {
      if (soundEnabled) playTopicFile(topicId, task.audioPath);
    } else if (hasTts) {
      startTts();
    }
  }

  return (
    <>
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="sp-screen">

          <div className="sp-audio-section">
            {(task.audioPath || hasTts) ? (
              <div className="sp-audio-replay-wrap">
              <button
                className={`sp-audio-btn${speaking ? " sp-audio-btn--speaking" : ""}${replayCount >= MAX_REPLAYS ? " sp-audio-btn--exhausted" : ""}`}
                onClick={handleReplay}
                disabled={replayCount >= MAX_REPLAYS}
                aria-label="Прослушать предложение"
              >
                🔊
              </button>
              <span className="sp-audio-replay-count">
                {Array.from({ length: MAX_REPLAYS }, (_, i) => (
                  <span key={i} className={`sp-audio-dot${i < replayCount ? " sp-audio-dot--used" : ""}`} />
                ))}
              </span>
            </div>
            ) : (
              <div className="sp-audio-prompt">
                <span className="sp-audio-prompt__label">Произнесите вслух:</span>
                <span className="sp-audio-prompt__sentence">{sentenceText}</span>
              </div>
            )}
          </div>

          <div className="sp-rows-area">
            <SentenceRow
              rowIndex={0}
              structure={task.structure}
              placed={placed}
              activeSlotType={activeSlotType}
            />
          </div>

          <CardPool cards={pool} structure={task.structure} />

        </div>

        <DragOverlay dropAnimation={null}>
          {activeCard && (
            <div className="sp-card-overlay">
              <PuzzlePieceSvg
                slotType={activeCard.type}
                structure={task.structure}
                emoji={activeCard.emoji}
                label={activeCard.label}
                photo={activeCard.photo ?? null}
                isEmpty={false}
              />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {showError && (
        <div className="sp-error-overlay">
          <span className="sp-error-overlay__x">✕</span>
        </div>
      )}
    </>
  );
}
