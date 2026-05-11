import { useDroppable } from "@dnd-kit/core";

const SLOT_LABELS = {
  subject:   "КТО?",
  verb:      "ЧТО ДЕЛАЕТ?",
  adjective: "КАКУЮ?",
  object:    "ЧТО?",
};

export const SLOT_TYPES = {
  simple: ["subject", "verb"],
  full:   ["subject", "verb", "adjective", "object"],
};

function Slot({ rowIndex, slotType, card }) {
  const { isOver, setNodeRef } = useDroppable({
    id:   `${rowIndex}_${slotType}`,
    data: { rowIndex, slotType },
  });

  return (
    <div
      ref={setNodeRef}
      className={[
        "sp-slot",
        `sp-slot--${slotType}`,
        card    ? "sp-slot--filled" : "",
        isOver  ? "sp-slot--over"   : "",
      ].join(" ")}
    >
      {card
        ? <><span className="sp-slot__emoji">{card.emoji}</span><span className="sp-slot__word">{card.label}</span></>
        : <span className="sp-slot__label">{SLOT_LABELS[slotType]}</span>
      }
    </div>
  );
}

export default function SentenceRow({ rowIndex, structure, placed }) {
  const slots = SLOT_TYPES[structure] ?? SLOT_TYPES.simple;

  return (
    <div className="sp-row">
      {slots.map((slotType, i) => (
        <div key={slotType} className="sp-row__cell">
          {i > 0 && <span className="sp-arrow" aria-hidden>→</span>}
          <Slot rowIndex={rowIndex} slotType={slotType} card={placed[slotType] ?? null} />
        </div>
      ))}
    </div>
  );
}
