import { useAppStore } from "@/core/store";
import { BackArrowIcon } from "@/shared/components/ArrowIcons";
import PrivacyContent from "./PrivacyContent";

export default function PrivacyScreen() {
  const setScreen = useAppStore((s) => s.setScreen);
  const account = useAppStore((s) => s.account);

  return (
    <div className="screen">
      <div className="screen-header">
        <button className="back-btn" onClick={() => setScreen(account ? "help" : "register")}>
          <BackArrowIcon />
        </button>
        <h1 className="screen-title">Политика конфиденциальности</h1>
      </div>

      <div className="settings-body">
        <div className="settings-section">
          <PrivacyContent />
        </div>
      </div>
    </div>
  );
}
