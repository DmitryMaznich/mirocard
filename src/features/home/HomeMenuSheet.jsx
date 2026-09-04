export default function HomeMenuSheet({ onClose, onOpenProfile, onOpenStudents, onOpenSettings }) {
  function handleOverlay(e) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div className="action-sheet-overlay" onClick={handleOverlay}>
      <div className="action-sheet" role="dialog" aria-modal="true">
        <div className="action-sheet__title">Аккаунт</div>
        <button
          className="action-sheet__item"
          onClick={() => { onOpenProfile(); onClose(); }}
        >
          Профиль
        </button>
        <button
          className="action-sheet__item"
          onClick={() => { onOpenStudents(); onClose(); }}
        >
          Ученики
        </button>

        {/* This section is also the reserved home for a future "Язык"
            (interface language) row once i18n ships -- keep it a separate
            group from "Аккаунт" rather than merging Настройки in above. */}
        <div className="action-sheet__title action-sheet__title--divided">Приложение</div>
        <button
          className="action-sheet__item"
          onClick={() => { onOpenSettings(); onClose(); }}
        >
          Настройки
        </button>

        <button className="action-sheet__item action-sheet__item--cancel" onClick={onClose}>
          Отмена
        </button>
      </div>
    </div>
  );
}
