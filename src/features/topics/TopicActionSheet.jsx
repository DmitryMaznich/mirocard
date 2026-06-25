import { FIRST_PARTY_DECK_IDS } from "@/topics/builtinTopics";
import { getTopicTitle } from "@/shared/utils/format";

export default function TopicActionSheet({ record, onClose, onInfo, onAnalytics, onDelete }) {
  const isBuiltin    = Boolean(record.meta.builtin);
  const isFirstParty = FIRST_PARTY_DECK_IDS.has(record.meta.id);
  const isDeletable  = !isBuiltin && !isFirstParty;

  function handleOverlay(e) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div className="action-sheet-overlay" onClick={handleOverlay}>
      <div className="action-sheet" role="dialog" aria-modal="true">
        <div className="action-sheet__title">{getTopicTitle(record.meta.title)}</div>
        <button
          className="action-sheet__item"
          onClick={() => { onInfo(record); onClose(); }}
        >
          О теме
        </button>
        {!isBuiltin && (
          <button
            className="action-sheet__item"
            onClick={() => { onAnalytics(record); onClose(); }}
          >
            Аналитика
          </button>
        )}
        {isDeletable && (
          <button
            className="action-sheet__item action-sheet__item--danger"
            onClick={() => { onDelete(record); onClose(); }}
          >
            Удалить
          </button>
        )}
        <button className="action-sheet__item action-sheet__item--cancel" onClick={onClose}>
          Отмена
        </button>
      </div>
    </div>
  );
}
