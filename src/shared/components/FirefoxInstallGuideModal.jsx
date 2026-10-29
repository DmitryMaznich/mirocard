import Modal from "@/shared/components/Modal";
import Button from "@/shared/components/Button";

export default function FirefoxInstallGuideModal({ visible, onClose }) {
  if (!visible) return null;

  return (
    <Modal
      title="Установка через Firefox"
      onClose={onClose}
      actions={<Button variant="secondary" onClick={onClose}>Понятно</Button>}
    >
      <ol>
        <li>Дождитесь загрузки приложения в обычной, не приватной вкладке Firefox.</li>
        <li>Откройте меню Firefox ⋮ и выберите «Установить».</li>
        <li>Подтвердите добавление значка и запускайте Mironium с этого значка.</li>
      </ol>
      <p>Приложение должно открываться без адресной строки и вкладок Firefox.</p>
      <p>
        Если доступно только «Добавить на домашний экран» и значок открывает обычную
        вкладку, Firefox создал ссылку. Обновите Firefox, перезагрузите страницу и
        проверьте, появился ли пункт «Установить». Если он появился, удалите старый
        значок-ссылку и установите приложение заново.
      </p>
      <p>
        Если пункт «Установить» не появился, сообщите нам версию Firefox и модель
        телефона. Для установки также можно использовать Chrome или Samsung Internet.
      </p>
    </Modal>
  );
}
