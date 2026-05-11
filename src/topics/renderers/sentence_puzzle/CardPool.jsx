import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import PuzzlePieceSvg, { PHOTO_W, PHOTO_H } from "./PuzzlePiece";

function DraggableCard({ card, structure }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id:   card.id,
    data: { card },
  });

  const photo = card.photo ?? null;

  return (
    <div
      ref={setNodeRef}
      style={{
        transform:   CSS.Translate.toString(transform),
        opacity:     isDragging ? 0.4 : 1,
        touchAction: "none",
        cursor:      "grab",
        overflow:    "visible",
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
