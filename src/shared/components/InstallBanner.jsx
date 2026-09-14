import { useState } from "react";
import { useInstallPrompt } from "@/shared/hooks/useInstallPrompt";
import IosInstallGuideModal from "@/shared/components/IosInstallGuideModal";

export default function InstallBanner() {
  const { visible, install, dismiss, isIos, isIosNonSafari, hasNativePrompt } = useInstallPrompt();
  const [showIosGuide, setShowIosGuide] = useState(false);

  if (!visible) return null;

  return (
    <>
      <div className="install-banner" role="complementary" aria-label="Установка приложения">
        <div className="install-banner__icon">📲</div>
        <div className="install-banner__body">
          <div className="install-banner__title">Установить приложение</div>
          <div className="install-banner__hint">Работает без интернета, удобнее на планшете</div>
        </div>
        <div className="install-banner__actions">
          <button
            className="install-banner__btn install-banner__btn--primary"
            onClick={hasNativePrompt ? install : () => setShowIosGuide(true)}
          >
            Установить
          </button>
          <button className="install-banner__btn install-banner__btn--dismiss" onClick={dismiss} aria-label="Закрыть">
            ✕
          </button>
        </div>
      </div>
      {isIos && (
        <IosInstallGuideModal
          visible={showIosGuide}
          onClose={() => setShowIosGuide(false)}
          isIosNonSafari={isIosNonSafari}
        />
      )}
    </>
  );
}
