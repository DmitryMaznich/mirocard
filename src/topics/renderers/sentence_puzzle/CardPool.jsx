import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import PuzzlePieceSvg, { PHOTO_W, PHOTO_H } from "./PuzzlePiece";

// Deterministic tilt per card so the "scattered" look is stable across renders
function cardTilt(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(31, h) + id.charCodeAt(i)) | 0;
  return ((h & 0xff) / 255) * 14 - 7; // −7 … +7 degrees
}

function DraggableCard({ card, structure }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id:   card.id,
    data: { card },
  });

  const photo = card.photo ?? null;
  const tilt  = cardTilt(card.id);

  return (
    <div
      ref={setNodeRef}
      style={{
        transform:   `${CSS.Translate.toString(transform) ?? ""} rotate(${isDragging ? 2 : tilt}deg)`,
        opacity:     isDragging ? 0.4 : 1,
        touchAction: "none",
        cursor:      "grab",
        overflow:    "visible",
        transition:  isDragging ? "none" : "transform 0.15s ease",
        ...(photo ? { width: PHOTO_W, height: PHOTO_H } : {}),
      }}
      {...listeners}
      {...attributes}
    >
      <PuzzlePieceSvg
        slotType={card.type}
        structure={structure}
        emoji={card.emoji}
        label={card.label}
        photo={photo}
        isEmpty={false}
        scalable={!!photo}
      />
    </div>
  );
}

export default function CardPool({ cards, structure }) {
  return (
    <div className="sp-pool">
      {cards.map((card) => (
        <DraggableCard key={card.id} card={card} structure={structure} />
      ))}
    </div>
  );
}
