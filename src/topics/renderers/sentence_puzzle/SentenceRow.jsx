import { useDroppable } from "@dnd-kit/core";
import PuzzlePieceSvg, { BODY_W, BODY_H } from "./PuzzlePiece";

export const SLOT_TYPES = {
  simple: ["subject", "verb"],
  full:   ["subject", "verb", "adjective", "object"],
};

function Slot({ rowIndex, slotType, card, position, structure, result, colorless, active }) {
  const { isOver, setNodeRef } = useDroppable({
    id:   `${rowIndex}_${slotType}`,
    data: { rowIndex, slotType },
  });

  const resultClass = result === "correct"   ? " sp-slot--correct"
                    : result === "incorrect" ? " sp-slot--incorrect"
                    : "";
  const activeClass = active && !card ? " sp-slot--active" : "";

  return (
    <div
      ref={setNodeRef}
      className={`sp-slot${resultClass}${activeClass}`}
      style={{
        flex:        1,
        aspectRatio: `${BODY_W} / ${BODY_H}`,
        position:    "relative",
        zIndex:      position + 1,
        overflow:    "visible",
      }}
    >
      <PuzzlePieceSvg
        slotType={slotType}
        structure={structure}
        emoji={card?.emoji}
        label={card?.label}
        photo={card?.photo ?? null}
        isEmpty={!card}
        isOver={isOver}
        scalable
        colorless={colorless}
      />
    </div>
  );
}

export default function SentenceRow({ rowIndex, structure, placed, slotResults, colorless = false, activeSlotType = null }) {
  const slots = SLOT_TYPES[structure] ?? SLOT_TYPES.simple;

  return (
    <div className="sp-row">
      {slots.map((slotType, i) => (
        <Slot
          key={slotType}
          rowIndex={rowIndex}
          slotType={slotType}
          card={placed[slotType] ?? null}
          position={i}
          structure={structure}
          result={slotResults?.[slotType] ?? null}
          colorless={colorless}
          active={slotType === activeSlotType}
        />
      ))}
    </div>
  );
}
