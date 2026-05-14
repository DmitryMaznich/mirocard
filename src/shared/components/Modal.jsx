export default function Modal({ title, children, onClose, actions }) {
  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) onClose?.();
  }

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-content" role="dialog" aria-modal="true">
        <div className="modal-header">
          {title && <div className="modal-title">{title}</div>}
          <button className="modal-close" type="button" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {actions && <div className="modal-actions">{actions}</div>}
      </div>
    </div>
  );
}
