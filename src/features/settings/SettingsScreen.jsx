import { useEffect, useState } from "react";
import { useAppStore } from "@/core/store";
import { getStoragePersistenceStatus, requestStoragePersistence, STORAGE_PERSISTENCE_EVENT } from "@/core/storagePersistence";
import { BackArrowIcon } from "@/shared/components/ArrowIcons";
import UiLanguagePicker from "@/shared/components/UiLanguagePicker";
import { useUiTranslation } from "@/shared/i18n/useUiTranslation.js";

export default function SettingsScreen() {
  const { t } = useUiTranslation();
  const setScreen        = useAppStore((s) => s.setScreen);
  const buildInfo        = useAppStore((s) => s.buildInfo);
  const [storageStatus, setStorageStatus] = useState("checking");

  useEffect(() => {
    let active = true;
    let changed = false;
    const onStatusChanged = (event) => {
      changed = true;
      setStorageStatus(event.detail);
    };
    window.addEventListener(STORAGE_PERSISTENCE_EVENT, onStatusChanged);
    getStoragePersistenceStatus().then((status) => {
      if (active && !changed) setStorageStatus(status);
    });
    return () => {
      active = false;
      window.removeEventListener(STORAGE_PERSISTENCE_EVENT, onStatusChanged);
    };
  }, []);

  async function handleStorageRequest() {
    setStorageStatus("checking");
    setStorageStatus(await requestStoragePersistence({ force: true }));
  }

  return (
    <div className="screen">
      <div className="screen-header">
        <button className="back-btn" aria-label={t("common.back")} onClick={() => setScreen("home")}><BackArrowIcon /></button>
        <h1 className="screen-title">{t("settings.title")}</h1>
      </div>

      <div className="settings-body">
        <p className="settings-scope">{t("settings.appScope")}</p>
        <UiLanguagePicker />
        <div className="settings-section">
          <div className="settings-section-title">{t("settings.deviceData")}</div>
          <div className="settings-row">
            <span className="settings-row__label">
              {t(`settings.protection.${storageStatus}`)}
            </span>
            {(storageStatus === "not_granted" || storageStatus === "error") && (
              <button className="link-btn" onClick={handleStorageRequest}>{t("settings.enable")}</button>
            )}
          </div>
          <p className="settings-row__label">
            {t("settings.storageHelp")}
          </p>
        </div>



      </div>

      <div className="settings-build-info">
        v{buildInfo.version} · {buildInfo.gitSha}
      </div>


    </div>
  );
}
