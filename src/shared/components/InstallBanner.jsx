import { useInstallPrompt } from "@/shared/hooks/useInstallPrompt";

export default function InstallBanner() {
  const { visible, install, dismiss, isIos, hasNativePrompt } = useInstallPrompt();

  if (!visible) return null;

  return (
    <div className="install-banner" role="complementary" aria-label="Установка приложения">
      <div className="install-banner__icon">📲</div>
      <div className="install-banner__body">
        <div className="install-banner__title">Установить приложение</div>
        {isIos && !hasNativePrompt ? (
          <div className="install-banner__hint">
            Нажмите <span className="install-banner__ios-share">⎋</span> → «На экран «Домой»»
          </div>
        ) : (
          <div className="install-banner__hint">Работает без интернета, удобнее на планшете</div>
        )}
      </div>
      <div className="install-banner__actions">
        {hasNativePrompt && (
          <button className="install-banner__btn install-banner__btn--primary" onClick={install}>
            Установить
          </button>
        )}
        <button className="install-banner__btn install-banner__btn--dismiss" onClick={dismiss} aria-label="Закрыть">
          ✕
        </button>
      </div>
    </div>
  );
}
