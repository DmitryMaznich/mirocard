import { useAppStore } from "@/core/store";
import { BackArrowIcon } from "@/shared/components/ArrowIcons";
import UiLanguagePicker from "@/shared/components/UiLanguagePicker";
import { useUiTranslation } from "@/shared/i18n/useUiTranslation.js";
import DeviceSettings from "./DeviceSettings";

export default function SettingsScreen() {
  const { t } = useUiTranslation();
  const setScreen        = useAppStore((s) => s.setScreen);

  return (
    <div className="screen">
      <div className="screen-header">
        <button className="back-btn" aria-label={t("common.back")} onClick={() => setScreen("home")}><BackArrowIcon /></button>
        <h1 className="screen-title">{t("settings.title")}</h1>
      </div>

      <div className="settings-body">
        <p className="settings-scope">{t("settings.appScope")}</p>
        <UiLanguagePicker />
        <DeviceSettings />
      </div>
    </div>
  );
}
