import { useUiTranslation } from "@/shared/i18n/useUiTranslation.js";
export default function HomeMenuSheet({ onClose, onOpenProfile, onOpenStudents, onOpenSettings, onOpenHelp, onOpenStatistics }) {
  const { t } = useUiTranslation();
  function handleOverlay(e) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div className="action-sheet-overlay" onClick={handleOverlay}>
      <div className="action-sheet" role="dialog" aria-modal="true">
        <div className="action-sheet__title">{t("nav.account")}</div>
        <button
          className="action-sheet__item"
          onClick={() => { onOpenProfile(); onClose(); }}
        >{t("nav.profile")}</button>
        <button
          className="action-sheet__item"
          onClick={() => { onOpenStudents(); onClose(); }}
        >{t("nav.students")}</button>

        {onOpenStatistics && <button className="action-sheet__item" onClick={() => { onOpenStatistics(); onClose(); }}>{t("nav.studentStatistics")}</button>}

        <div className="action-sheet__title action-sheet__title--divided">{t("nav.application")}</div>
        <button
          className="action-sheet__item"
          onClick={() => { onOpenSettings(); onClose(); }}
        >{t("nav.settings")}</button>
        <button
          className="action-sheet__item"
          onClick={() => { onOpenHelp(); onClose(); }}
        >{t("nav.help")}</button>

        <button className="action-sheet__item action-sheet__item--cancel" onClick={onClose}>{t("common.cancel")}</button>
      </div>
    </div>
  );
}
