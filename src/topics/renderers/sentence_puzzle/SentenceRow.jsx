import { useDroppable } from "@dnd-kit/core";
import PuzzlePieceSvg, { BODY_W } from "./PuzzlePiece";

export const SLOT_TYPES = {
  simple: ["subject", "verb"],
  full:   ["subject", "verb", "adjective", "object"],
};

function Slot({ rowIndex, slotType, card, position, structure }) {
  const { isOver, setNodeRef } = useDroppable({
    id:   `${rowIndex}_${slotType}`,
    data: { rowIndex, slotType },
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        width:    BODY_W,
        position: "relative",
        zIndex:   position + 1,
        overflow: "visible",
        flexShrink: 0,
      }}
    >
      <PuzzlePieceSvg
        slotType={slotType}
        structure={structure}
        emoji={card?.emoji}
        label={card?.label}
        isEmpty={!card}
        isOver={isOver}
      />
    </div>
  );
}

export default function SentenceRow({ rowIndex, structure, placed }) {
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
        />
      ))}
    </div>
  );
}
