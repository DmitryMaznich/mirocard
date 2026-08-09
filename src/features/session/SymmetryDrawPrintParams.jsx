import { useState } from "react";
import { deriveConcepts, getConceptCards } from "@/shared/utils/topicUtils";
import Button from "@/shared/components/Button";
import Modal from "@/shared/components/Modal";
import { openSymmetryDrawPrintWindow } from "./symmetryDrawPrintHtml";
import "./SymmetryDrawPrintParams.css";

export default function SymmetryDrawPrintParams({ topicRecord, mode }) {
  const concepts = deriveConcepts(getConceptCards(topicRecord, mode));
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [popupBlocked, setPopupBlocked] = useState(false);

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
    const opened = openSymmetryDrawPrintWindow(chosen);
    setPopupBlocked(!opened);
    if (opened) setModalOpen(false);
  }

  return (
    <>
      <button type="button" className="sdpp-trigger" onClick={() => setModalOpen(true)}>
        🖨 Печать / PDF
      </button>

      {modalOpen && (
        <Modal title="Печать карточек" onClose={() => setModalOpen(false)}>
          <div className="sdpp-header">
            <span className="sdpp-count">Выбрано: {selected.size}</span>
            <button type="button" className="sdpp-select-toggle" onClick={allSelected ? selectNone : selectAll}>
              {allSelected ? "Снять всё" : "Выбрать всё"}
            </button>
          </div>
          {popupBlocked && (
            <div className="sdpp-popup-warning">
              Браузер заблокировал всплывающее окно печати. Разрешите всплывающие окна для этого сайта и попробуйте ещё раз.
            </div>
          )}
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
        </Modal>
      )}
    </>
  );
}
