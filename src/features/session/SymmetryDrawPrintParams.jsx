import { useState } from "react";
import { createPortal } from "react-dom";
import { deriveConcepts, getConceptCards } from "@/shared/utils/topicUtils";
import Button from "@/shared/components/Button";
import SymmetryDrawPrintView from "./SymmetryDrawPrintView";
import "./SymmetryDrawPrintParams.css";

export default function SymmetryDrawPrintParams({ topicRecord, mode }) {
  const concepts = deriveConcepts(getConceptCards(topicRecord, mode));
  const [selected, setSelected] = useState(new Set());
  const [printCards, setPrintCards] = useState(null);

  function toggle(cardId) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
  }

  const allSelected = concepts.length > 0 && concepts.every((concept) => selected.has(concept.primary.id));

  function selectAll() {
    setSelected(new Set(concepts.map((concept) => concept.primary.id)));
  }
  function selectNone() {
    setSelected(new Set());
  }

  function downloadPdf() {
    const chosen = concepts
      .filter((concept) => selected.has(concept.primary.id))
      .map((concept) => concept.primary);
    setPrintCards(chosen);
  }

  return (
    <div className="sdpp-root">
      <div className="sdpp-header">
        <span className="sdpp-count">Выбрано: {selected.size}</span>
        <button type="button" className="sdpp-select-toggle" onClick={allSelected ? selectNone : selectAll}>
          {allSelected ? "Снять всё" : "Выбрать всё"}
        </button>
      </div>
      <div className="sdpp-grid">
        {concepts.map((concept) => {
          const card = concept.primary;
          const isSelected = selected.has(card.id);
          return (
            <button
              type="button"
              key={card.id}
              className={`sdpp-card${isSelected ? " sdpp-card--selected" : ""}`}
              onClick={() => toggle(card.id)}
            >
              <span className="sdpp-card-label">{card.label}</span>
            </button>
          );
        })}
      </div>
      <Button fullWidth disabled={selected.size === 0} onClick={downloadPdf}>
        Скачать PDF ({selected.size})
      </Button>
      {printCards && createPortal(
        <SymmetryDrawPrintView cards={printCards} onDone={() => setPrintCards(null)} />,
        document.body
      )}
    </div>
  );
}
