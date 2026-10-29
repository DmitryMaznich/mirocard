import Modal from "@/shared/components/Modal";
import Button from "@/shared/components/Button";

export default function AndroidInstallGuideModal({ visible, onClose }) {
  if (!visible) return null;

  return (
    <Modal
      title="Установка на Android"
      onClose={onClose}
      actions={<Button variant="secondary" onClick={onClose}>Понятно</Button>}
    >
      <ol>
        <li>Откройте Mironium в обычной, не приватной вкладке браузера.</li>
        <li>Дождитесь загрузки страницы и откройте меню браузера.</li>
        <li>Выберите «Установить приложение» или «Добавить на главный экран», затем «Установить», если браузер предлагает этот вариант.</li>
        <li>Запускайте Mironium с появившегося значка.</li>
      </ol>
      <p>
        Если значок открывает обычную вкладку, браузер добавил ссылку. Для запуска
        в отдельном окне попробуйте установку через Chrome или Samsung Internet.
      </p>
    </Modal>
  );
}
