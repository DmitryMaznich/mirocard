import { useState }                                                                   from "react";
import { ForwardArrowIcon } from "@/shared/components/ArrowIcons";
import { DndContext, DragOverlay, PointerSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core";
import { shuffle }    from "@/shared/utils/shuffle";
import SentenceRow, { SLOT_TYPES } from "./SentenceRow";
import CardPool       from "./CardPool";
import QuestionsView  from "./QuestionsView";
import PuzzlePieceSvg from "./PuzzlePiece";

function pickN(arr, n) {
  return shuffle([...arr]).slice(0, Math.min(n, arr.length));
}

function adultsAsSubjects(student) {
  const adults = student?.closeAdults;
  if (!Array.isArray(adults) || adults.length === 0) return null;
  return adults.map((a) => ({
    id:    `adult_${a.id}`,
    type:  "subject",
    label: a.name,
    emoji: null,
    photo: a.photo ?? null,
  }));
}

function buildRound(task, sessionParams, student) {
  const level     = Number(sessionParams?.level)  || 1;
  const structure = sessionParams?.structure      || "simple";
  const slotTypes = SLOT_TYPES[structure] ?? SLOT_TYPES.simple;

  const adultSubjects = adultsAsSubjects(student);
  const subjects   = adultSubjects ? pickN(adultSubjects, level) : pickN(task.subjects, level);
  const verbs      = pickN(task.verbs,      level);
  const adjectives = structure === "full" ? pickN(task.adjectives, level) : [];
  const objects    = structure === "full" ? pickN(task.objects,    level) : [];

  const pool     = shuffle([...subjects, ...verbs, ...adjectives, ...objects]);
  const emptyRow = () => Object.fromEntries(slotTypes.map((t) => [t, null]));
  const rows     = Array.from({ length: level }, emptyRow);

  return { pool, rows, structure, slotTypes, level };
}

export default function SentencePuzzleBuilder({ task, sessionParams, student, soundEnabled, playFeedback }) {
  const [round,      setRound]      = useState(() => buildRound(task, sessionParams, student));
  const [phase,      setPhase]      = useState("building");
  const [activeCard, setActiveCard] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 150, tolerance: 5 } }),
  );

  const isComplete = round.rows.every((placed) =>
    round.slotTypes.every((t) => placed[t] !== null)
  );

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

    if (card.type !== slotType) {
      if (soundEnabled) playFeedback?.("incorrect");
      return;
    }

    setRound((prev) => {
      if (prev.rows[rowIndex]?.[slotType] !== null) return prev;
      const newRows = prev.rows.map((row, i) =>
        i === rowIndex ? { ...row, [slotType]: card } : row
      );
      const newPool = prev.pool.filter((c) => c.id !== card.id);
      const rowComplete = prev.slotTypes.every((t) => newRows[rowIndex][t] !== null);
      if (rowComplete && soundEnabled) playFeedback?.("correct");
      return { ...prev, rows: newRows, pool: newPool };
    });
  }

  function startNewRound() {
    setRound(buildRound(task, sessionParams, student));
    setPhase("building");
  }

  if (phase === "questions") {
    return (
      <QuestionsView
        rows={round.rows}
        structure={round.structure}
        onNewRound={startNewRound}
        onBack={() => setPhase("building")}
      />
    );
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="sp-screen">
        <div className="sp-rows-area">
          <div className="sp-title">
            {round.level === 1 ? "Собери предложение" : "Собери предложения"}
          </div>
          {round.rows.map((placed, rowIndex) => (
            <SentenceRow
              key={rowIndex}
              rowIndex={rowIndex}
              structure={round.structure}
              placed={placed}
            />
          ))}
        </div>

        <CardPool cards={round.pool} structure={round.structure} />

        {isComplete && (
          <div className="sp-complete-bar">
            <button className="sp-btn sp-btn--primary" onClick={() => setPhase("questions")}>
              Вопросы <ForwardArrowIcon size={16} />
            </button>
          </div>
        )}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeCard && (
          <div className="sp-card-overlay">
            <PuzzlePieceSvg
              slotType={activeCard.type}
              structure={round.structure}
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
