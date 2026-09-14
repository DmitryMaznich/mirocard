import Modal from "@/shared/components/Modal";
import Button from "@/shared/components/Button";

export default function IosInstallGuideModal({ visible, onClose, isIosNonSafari }) {
  if (!visible) return null;

  return (
    <Modal
      title="Установка на iPhone/iPad"
      onClose={onClose}
      actions={<Button variant="secondary" onClick={onClose}>Понятно</Button>}
    >
      {isIosNonSafari ? (
        <div className="ios-install-guide__safari-note">
          <div className="ios-install-guide__safari-note-icon">🧭</div>
          <div>
            Apple разрешает установку приложений на домашний экран только через
            браузер <strong>Safari</strong>. Откройте эту страницу в Safari и
            повторите — там появятся те же шаги.
          </div>
        </div>
      ) : (
        <ol className="ios-install-guide__steps">
          <li className="ios-install-guide__step">
            <span className="ios-install-guide__step-num">1</span>
            <span className="ios-install-guide__step-icon" aria-hidden="true">📤</span>
            <span className="ios-install-guide__step-text">
              Нажмите значок «Поделиться» в панели Safari
            </span>
          </li>
          <li className="ios-install-guide__step">
            <span className="ios-install-guide__step-num">2</span>
            <span className="ios-install-guide__step-icon" aria-hidden="true">➕</span>
            <span className="ios-install-guide__step-text">
              Прокрутите список вниз и выберите «На экран «Домой»»
            </span>
          </li>
          <li className="ios-install-guide__step">
            <span className="ios-install-guide__step-num">3</span>
            <span className="ios-install-guide__step-icon" aria-hidden="true">✓</span>
            <span className="ios-install-guide__step-text">
              Нажмите «Добавить» в правом верхнем углу
            </span>
          </li>
        </ol>
      )}
    </Modal>
  );
}
