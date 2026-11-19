import { useEffect, useRef, useState } from "react";
import { useTopicUiPreview } from "@/core/topicUiPreview";
import { useAppStore } from "@/core/store";
import { getStoragePersistenceStatus, requestStoragePersistence, STORAGE_PERSISTENCE_EVENT } from "@/core/storagePersistence";
import { useUiTranslation } from "@/shared/i18n/useUiTranslation.js";

// «This device»: the experimental-interface switch (7 taps on the build line),
// local data protection and the build line itself. «Настройки приложения»
// shows it under the language; the new interface, which has no such screen
// (the language is in the menu), shows it at the end of «Помощь и поддержка».
export default function DeviceSettings() {
  const { t } = useUiTranslation();
  const buildInfo = useAppStore((s) => s.buildInfo);
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
    <>
      {(previewUnlocked || previewEnabled) && (
        <div className="settings-section" data-testid="topic-ui-preview-settings">
          <div className="settings-section-title">{t("preview.settingsTitle")}</div>
          <label className="settings-row settings-row--switch">
            <span>{t("preview.settingsToggle")}</span>
            <input type="checkbox" role="switch" className="settings-switch" checked={previewEnabled}
              onChange={(event) => {
                setPreviewUnlocked(true);
                setPreviewSaved(setPreviewEnabled(event.target.checked));
              }} />
          </label>
          <p className="settings-section__text">{t("preview.settingsHelp")}</p>
          {!previewSaved && <p className="settings-section__text" role="status">{t("preview.notSaved")}</p>}
        </div>
      )}
      <div className="settings-section">
        <div className="settings-section-title">{t("settings.deviceData")}</div>
        <div className="settings-row settings-row--action">
          <span className="settings-row__label">{t(`settings.protection.${storageStatus}`)}</span>
          {(storageStatus === "not_granted" || storageStatus === "error") && (
            <button className="link-btn" onClick={handleStorageRequest}>{t("settings.enable")}</button>
          )}
        </div>
        <p className="settings-section__text">{t("settings.storageHelp")}</p>
      </div>
      <button type="button" className="settings-build-info" onClick={revealPreview}
        style={{ border: 0, background: "transparent", fontFamily: "inherit", cursor: "default" }}>
        v{buildInfo.version} · {buildInfo.gitSha}
      </button>
    </>
  );
}
