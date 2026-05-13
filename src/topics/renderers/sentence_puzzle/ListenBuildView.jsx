import { useState, useEffect }                                                        from "react";
import { DndContext, DragOverlay, PointerSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core";
import SentenceRow, { SLOT_TYPES } from "./SentenceRow";
import CardPool                    from "./CardPool";
import PuzzlePieceSvg              from "./PuzzlePiece";

export default function ListenBuildView({
  task, topicId, soundEnabled, playTopicFile, onCorrect, onIncorrect,
}) {
  const slotTypes = SLOT_TYPES[task.structure] ?? SLOT_TYPES.simple;
  const emptyRow  = () => Object.fromEntries(slotTypes.map((t) => [t, null]));

  const [placed,      setPlaced]      = useState(emptyRow);
  const [pool,        setPool]        = useState(() => [...task.pool]);
  const [slotResults, setSlotResults] = useState(null);
  const [activeCard,  setActiveCard]  = useState(null);

  useEffect(() => {
    if (task.audioPath && soundEnabled) {
      playTopicFile(topicId, task.audioPath);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 150, tolerance: 5 } }),
  );

  const isComplete = slotTypes.every((t) => placed[t] !== null);

  function handleDragStart({ active }) {
    setActiveCard(active.data.current?.card ?? null);
  }

  function handleDragEnd({ active, over }) {
    setActiveCard(null);
    if (!over) return;
    const card = active.data.current?.card;
    if (!card) return;
    const { rowIndex, slotType } = over.data.current ?? {};
    if (rowIndex === undefined || !slotType) return;
    if (card.type !== slotType) return;

    setPlaced((prev) => {
      if (prev[slotType] !== null) return prev;
      return { ...prev, [slotType]: card };
    });
    setPool((prev) => prev.filter((c) => c.id !== card.id));
  }

  function handleCheck() {
    const results = Object.fromEntries(
      slotTypes.map((t) => [t, placed[t]?.id === task.target[t]?.id ? "correct" : "incorrect"])
    );
    setSlotResults(results);
    const allCorrect = slotTypes.every((t) => results[t] === "correct");
    setTimeout(() => {
      if (allCorrect) onCorrect();
      else            onIncorrect();
    }, 600);
  }

  function handleReplay() {
    if (task.audioPath && soundEnabled) playTopicFile(topicId, task.audioPath);
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="sp-screen">

        <div className="sp-audio-section">
          {task.audioPath ? (
            <button className="sp-audio-btn" onClick={handleReplay} aria-label="Повторить предложение">
              🔊
            </button>
          ) : (
            <div className="sp-audio-prompt">
              <span className="sp-audio-prompt__label">Произнесите вслух:</span>
              <span className="sp-audio-prompt__sentence">
                {slotTypes.map((t) => task.target[t]?.label ?? "").join(" ")}
              </span>
            </div>
          )}
        </div>

        <div className="sp-rows-area">
          <SentenceRow
            rowIndex={0}
            structure={task.structure}
            placed={placed}
            slotResults={slotResults}
          />
        </div>

        <CardPool cards={pool} structure={task.structure} />

        {isComplete && !slotResults && (
          <div className="sp-complete-bar">
            <button className="sp-btn sp-btn--primary" onClick={handleCheck}>
              Проверить →
            </button>
          </div>
        )}

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
  );
}
