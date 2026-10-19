import { useUiTranslation } from "@/shared/i18n/useUiTranslation.js";
import { useAppStore } from "@/core/store";
import { BackArrowIcon } from "@/shared/components/ArrowIcons";
import PrivacyContent from "./PrivacyContent";

export default function PrivacyScreen() {
  const { t: tr } = useUiTranslation();
  const setScreen = useAppStore((s) => s.setScreen);
  const account = useAppStore((s) => s.account);

  return (
    <div className="screen">
      <div className="screen-header">
        <button className="back-btn" onClick={() => setScreen(account ? "help" : "register")}>
          <BackArrowIcon />
        </button>
        <h1 className="screen-title">{tr("help.privacy")}</h1>
      </div>

      <div className="settings-body">
        <div className="settings-section">
          <PrivacyContent />
        </div>
      </div>
    </div>
  );
}
