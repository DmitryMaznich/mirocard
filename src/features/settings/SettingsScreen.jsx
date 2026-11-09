import { useEffect, useRef, useState } from "react";
import { useTopicUiPreview } from "@/core/topicUiPreview";
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
  const { enabled: previewEnabled, setEnabled: setPreviewEnabled } = useTopicUiPreview();
  const [previewUnlocked, setPreviewUnlocked] = useState(false);
  const [previewSaved, setPreviewSaved] = useState(true);
  const secretTaps = useRef({ count: 0, startedAt: 0 });

  function revealPreview() {
    const now = Date.now();
    if (now - secretTaps.current.startedAt > 5000) secretTaps.current = { count: 0, startedAt: now };
    secretTaps.current.count += 1;
    if (secretTaps.current.count >= 7) {
      setPreviewUnlocked(true);
      secretTaps.current.count = 0;
    }
  }

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
        {(previewUnlocked || previewEnabled) && (
          <div className="settings-section" data-testid="topic-ui-preview-settings">
            <div className="settings-section-title">{t("preview.settingsTitle")}</div>
            <label className="settings-row">
              <span>{t("preview.settingsToggle")}</span>
              <input type="checkbox" role="switch" checked={previewEnabled}
                onChange={(event) => {
                  setPreviewUnlocked(true);
                  setPreviewSaved(setPreviewEnabled(event.target.checked));
                }} />
            </label>
            <p className="settings-row__label">{t("preview.settingsHelp")}</p>
            {!previewSaved && <p role="status">{t("preview.notSaved")}</p>}
          </div>
        )}
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

      <button type="button" className="settings-build-info" onClick={revealPreview}
        style={{ border: 0, background: "transparent", fontFamily: "inherit", cursor: "default" }}>
        v{buildInfo.version} · {buildInfo.gitSha}
      </button>


    </div>
  );
}
