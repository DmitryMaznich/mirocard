import { getInterfaceTopicTitle } from "@/shared/i18n/topicTitles.js";
import { useUiTranslation } from "@/shared/i18n/useUiTranslation.js";
import { FIRST_PARTY_DECK_IDS } from "@/topics/builtinTopics";

export default function TopicActionSheet({ record, onClose, onInfo, onDelete, onStatistics }) {
  const { t } = useUiTranslation();
  const isBuiltin    = Boolean(record.meta.builtin);
  const isFirstParty = FIRST_PARTY_DECK_IDS.has(record.meta.id);
  const isDeletable  = !isBuiltin && !isFirstParty;

  function handleOverlay(e) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div className="action-sheet-overlay" onClick={handleOverlay}>
      <div className="action-sheet" role="dialog" aria-modal="true">
        <div className="action-sheet__title">{getInterfaceTopicTitle(record.meta.id, record.meta.title)}</div>
        {onStatistics && <button className="action-sheet__item" onClick={() => { onStatistics(record); onClose(); }}>{t("nav.statistics")}</button>}
        <button
          className="action-sheet__item"
          onClick={() => { onInfo(record); onClose(); }}
        >{t("topics.about")}</button>
        {isDeletable && (
          <button
            className="action-sheet__item action-sheet__item--danger"
            onClick={() => { onDelete(record); onClose(); }}
          >{t("common.delete")}</button>
        )}
        <button className="action-sheet__item action-sheet__item--cancel" onClick={onClose}>{t("common.cancel")}</button>
      </div>
    </div>
  );
}
