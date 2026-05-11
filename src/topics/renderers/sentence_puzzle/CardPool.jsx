import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

function DraggableCard({ card }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id:   card.id,
    data: { card },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity:   isDragging ? 0.4 : 1,
    touchAction: "none",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`sp-card sp-card--${card.type}`}
    >
      <span className="sp-card__emoji">{card.emoji}</span>
      <span className="sp-card__label">{card.label}</span>
    </div>
  );
}

export default function CardPool({ cards }) {
  return (
    <div className="sp-pool">
      {cards.map((card) => (
        <DraggableCard key={card.id} card={card} />
      ))}
    </div>
  );
}
