import { useEffect, useRef, useState } from "react";
import { useTopicUiPreview } from "@/core/topicUiPreview";
import { useAppStore } from "@/core/store";
import { getStoragePersistenceStatus, requestStoragePersistence, STORAGE_PERSISTENCE_EVENT } from "@/core/storagePersistence";
import { useUiTranslation } from "@/shared/i18n/useUiTranslation.js";
import { useInstallPrompt } from "@/shared/hooks/useInstallPrompt";

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
  const installPrompt = useInstallPrompt();

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
      {/* The app already asks the browser for this protection on the first tap
          of every visit; the browser decides. Nothing to show while it holds
          (or cannot hold) — only when it refused, and then what helps: the app
          on the home screen (owner, 2026-11-19). */}
      {(storageStatus === "not_granted" || storageStatus === "error") && (
        <StorageAtRisk t={t} install={installPrompt} onRetry={handleStorageRequest} />
      )}
      <button type="button" className="settings-build-info" onClick={revealPreview}
        style={{ border: 0, background: "transparent", fontFamily: "inherit", cursor: "default" }}>
        v{buildInfo.version} · {buildInfo.gitSha}
      </button>
    </>
  );
}

function StorageAtRisk({ t, install, onRetry }) {
  const advice = install.installed ? null
    : install.isIosNonSafari ? t("settings.storageInstallIosOther")
    : install.isIos ? t("settings.storageInstallIos")
    : install.isAndroid ? t("settings.storageInstallAndroid")
    : t("settings.storageInstallDesktop");
  return (
    <div className="settings-section" data-testid="storage-at-risk">
      <div className="settings-section-title">{t("settings.deviceData")}</div>
      <p className="settings-section__text settings-section__text--first">{t("settings.storageAtRisk")}</p>
      {advice && <p className="settings-section__text">{advice}</p>}
      <div className="settings-row settings-row--action">
        {install.hasNativePrompt && !install.installed
          ? <button className="link-btn" onClick={install.install}>{t("settings.storageInstall")}</button>
          : <span />}
        <button className="link-btn" onClick={onRetry}>{t("settings.storageRetry")}</button>
      </div>
    </div>
  );
}
