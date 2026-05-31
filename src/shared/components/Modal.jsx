export default function Modal({
  title,
  children,
  onClose,
  actions,
  closeOnOverlay = true,
  showCloseButton = true,
}) {
  function handleOverlayClick(e) {
    if (closeOnOverlay && e.target === e.currentTarget) onClose?.();
  }

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-content" role="dialog" aria-modal="true">
        <div className="modal-header">
          {title && <div className="modal-title">{title}</div>}
          {showCloseButton && (
            <button className="modal-close" type="button" onClick={onClose} aria-label="Закрыть">
              ×
            </button>
          )}
        </div>
        <div className="modal-body">{children}</div>
        {actions && <div className="modal-actions">{actions}</div>}
      </div>
    </div>
  );
}
