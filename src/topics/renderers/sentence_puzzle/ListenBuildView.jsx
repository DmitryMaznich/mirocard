import { useState, useEffect, useRef }                                                from "react";
import { DndContext, DragOverlay, PointerSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core";
import SentenceRow, { SLOT_TYPES } from "./SentenceRow";
import CardPool                    from "./CardPool";
import PuzzlePieceSvg              from "./PuzzlePiece";

function playSound(name, enabled) {
  if (!enabled) return;
  const ext = name === "incorrect" ? "mp3" : "wav";
  try { new Audio(`/sounds/${name}.${ext}`).play(); } catch {}
}

function speakRu(text, { onStart, onEnd } = {}) {
  const synth = window.speechSynthesis;
  if (!synth) return;
  synth.cancel();
  const utt  = new SpeechSynthesisUtterance(text);
  utt.lang   = "ru-RU";
  utt.rate   = 0.88;
  utt.onstart = () => onStart?.();
  utt.onend   = () => onEnd?.();
  utt.onerror = () => onEnd?.();
  synth.speak(utt);
}

export default function ListenBuildView({
  task, topicId, soundEnabled, playTopicFile, onCorrect, onIncorrect, onMistake,
}) {
  const slotTypes    = SLOT_TYPES[task.structure] ?? SLOT_TYPES.simple;
  const sentenceText = slotTypes.map((t) => task.target[t]?.label ?? "").join(" ");

  const [placed,     setPlaced]     = useState(() => Object.fromEntries(slotTypes.map((t) => [t, null])));
  const [pool,       setPool]       = useState(() => [...task.pool]);
  const [showError,  setShowError]  = useState(false);
  const [speaking,   setSpeaking]   = useState(false);
  const [activeCard, setActiveCard] = useState(null);
  const errorTimer = useRef(null);

  const hasTts = !!window.speechSynthesis;

  useEffect(() => {
    if (!soundEnabled) return;
    if (task.audioPath) {
      playTopicFile(topicId, task.audioPath);
    } else if (hasTts) {
      const t = setTimeout(() =>
        speakRu(sentenceText, { onStart: () => setSpeaking(true), onEnd: () => setSpeaking(false) }),
        350
      );
      return () => clearTimeout(t);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => {
    clearTimeout(errorTimer.current);
    window.speechSynthesis?.cancel();
  }, []);

  const isComplete = slotTypes.every((t) => placed[t] !== null);

  useEffect(() => {
    if (!isComplete) return;
    playSound("correct", soundEnabled);
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

    if (card.id !== task.target[slotType]?.id) {
      playSound("incorrect", soundEnabled);
      onMistake?.(null, null);
      setShowError(true);
      clearTimeout(errorTimer.current);
      errorTimer.current = setTimeout(() => setShowError(false), 550);
      return;
    }

    setPlaced((prev) => ({ ...prev, [slotType]: card }));
    setPool((prev) => prev.filter((c) => c.id !== card.id));
  }

  function handleReplay() {
    if (task.audioPath) {
      if (soundEnabled) playTopicFile(topicId, task.audioPath);
    } else if (hasTts) {
      speakRu(sentenceText, { onStart: () => setSpeaking(true), onEnd: () => setSpeaking(false) });
    }
  }

  return (
    <>
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="sp-screen">

          <div className="sp-audio-section">
            {(task.audioPath || hasTts) ? (
              <button
                className={`sp-audio-btn${speaking ? " sp-audio-btn--speaking" : ""}`}
                onClick={handleReplay}
                aria-label="Прослушать предложение"
              >
                🔊
              </button>
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
