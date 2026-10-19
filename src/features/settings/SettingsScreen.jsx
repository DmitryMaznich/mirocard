import { useEffect, useState } from "react";
import { useAppStore } from "@/core/store";
import { getDb, kv } from "@/core/db";
import { getStoragePersistenceStatus, requestStoragePersistence, STORAGE_PERSISTENCE_EVENT } from "@/core/storagePersistence";
import { api } from "@/core/api";
import PinGateModal from "@/shared/components/PinGateModal";
import ZoneSettingsSection from "./ZoneSettingsSection";
import { BackArrowIcon } from "@/shared/components/ArrowIcons";
import UiLanguagePicker from "@/shared/components/UiLanguagePicker";
import { useUiTranslation } from "@/shared/i18n/useUiTranslation.js";

export default function SettingsScreen() {
  const { t } = useUiTranslation();
  const setScreen        = useAppStore((s) => s.setScreen);
  const buildInfo        = useAppStore((s) => s.buildInfo);
  const settings         = useAppStore((s) => s.settings);
  const patchSettings    = useAppStore((s) => s.patchSettings);

  const adultPinHash      = settings.adultPinHash ?? null;
  const physicalKeyboard  = settings.physicalKeyboard ?? false;
  const [pinResetMode, setPinResetMode] = useState(null); // null | "verify-old" | "set-new"
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

  const adultConfirmAdvance = settings.adultConfirmAdvance ?? true;
  const tapToAdvance     = settings.tapToAdvance ?? true;
  const requiresTapToAdvance = adultConfirmAdvance || tapToAdvance;
  const autoAdvanceDelay = settings.autoAdvanceDelay ?? 3;

  async function handlePatchSettings(patch) {
    patchSettings(patch);
    const db = await getDb();
    await kv.set(db, "settings", { ...useAppStore.getState().settings, ...patch });
  }

  function startPinReset() {
    setPinResetMode(adultPinHash === null ? "set-new" : "verify-old");
  }

  function handleVerifyOldSuccess() {
    setPinResetMode("set-new");
  }

  async function handleSetNewPin(hash) {
    await handlePatchSettings({ adultPinHash: hash });
    api.patch("/account/settings", { adultPinHash: hash }).catch(() => {});
  }

  async function handleStorageRequest() {
    setStorageStatus("checking");
    setStorageStatus(await requestStoragePersistence({ force: true }));
  }

  function handleSetNewSuccess() {
    setPinResetMode(null);
  }

  return (
    <div className="screen">
      <div className="screen-header">
        <button className="back-btn" aria-label={t("common.back")} onClick={() => setScreen("home")}><BackArrowIcon /></button>
        <h1 className="screen-title">{t("settings.title")}</h1>
      </div>

      <div className="settings-body">
        <UiLanguagePicker />
        <div className="settings-section">
          <div className="settings-section-title">{t("settings.pace")}</div>
          <div
            className="settings-row"
            style={{ cursor: "pointer" }}
            onClick={() => handlePatchSettings({ adultConfirmAdvance: !adultConfirmAdvance })}
          >
            <span className="settings-row__label">{t("settings.confirmAdvance")}</span>
            <input
              type="checkbox"
              aria-label={t("settings.confirmAdvance")}
              checked={adultConfirmAdvance}
              readOnly
              style={{ width: 18, height: 18, accentColor: "var(--color-primary, #5b8def)", flexShrink: 0, cursor: "pointer" }}
            />
          </div>
          <div
            className="settings-row"
            style={{ cursor: adultConfirmAdvance ? "default" : "pointer", opacity: adultConfirmAdvance ? 0.55 : 1 }}
            onClick={() => {
              if (!adultConfirmAdvance) handlePatchSettings({ tapToAdvance: !tapToAdvance });
            }}
          >
            <span className="settings-row__label">{t("settings.tapAdvance")}</span>
            <input
              type="checkbox"
              checked={adultConfirmAdvance ? true : tapToAdvance}
              aria-label={t("settings.tapAdvance")}
              readOnly
              disabled={adultConfirmAdvance}
              style={{ width: 18, height: 18, accentColor: "var(--color-primary, #5b8def)", flexShrink: 0, cursor: "pointer" }}
            />
          </div>
          <div
            className="settings-row"
            style={{ opacity: requiresTapToAdvance ? 0.4 : 1, pointerEvents: requiresTapToAdvance ? "none" : "auto" }}
          >
            <div className="settings-row__label">{t("settings.delay")}</div>
            <div className="param-stepper">
              <button
                className="stepper-btn"
                disabled={autoAdvanceDelay <= 1}
                aria-label={t("settings.decreaseDelay")}
                onClick={() => handlePatchSettings({ autoAdvanceDelay: autoAdvanceDelay - 1 })}
              >−</button>
              <span className="stepper-value">{autoAdvanceDelay}</span>
              <button
                className="stepper-btn"
                disabled={autoAdvanceDelay >= 10}
                aria-label={t("settings.increaseDelay")}
                onClick={() => handlePatchSettings({ autoAdvanceDelay: autoAdvanceDelay + 1 })}
              >+</button>
            </div>
          </div>
          <div className="settings-row">
            <span className="settings-label">{t("settings.pin")}</span>
            <button className="link-btn" onClick={startPinReset}>
              {t(adultPinHash ? "settings.changePin" : "settings.setPin")}
            </button>
          </div>
        </div>

        <div className="settings-section">
          <div className="settings-section-title">{t("settings.controls")}</div>
          <div
            className="settings-row"
            style={{ cursor: "pointer" }}
            onClick={() => handlePatchSettings({ physicalKeyboard: !physicalKeyboard })}
          >
            <span className="settings-row__label">{t("settings.keyboard")}</span>
            <input
              type="checkbox"
              checked={physicalKeyboard}
              aria-label={t("settings.keyboard")}
              readOnly
              style={{ width: 18, height: 18, accentColor: "var(--color-primary, #5b8def)", flexShrink: 0, cursor: "pointer" }}
            />
          </div>
        </div>

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

        <ZoneSettingsSection />

      </div>

      <div className="settings-build-info">
        v{buildInfo.version} · {buildInfo.gitSha}
      </div>

      {pinResetMode === "verify-old" && (
        <PinGateModal
          pinHash={adultPinHash}
          onSuccess={handleVerifyOldSuccess}
          onSetPin={() => {}}
          onCancel={() => setPinResetMode(null)}
        />
      )}
      {pinResetMode === "set-new" && (
        <PinGateModal
          pinHash={null}
          onSuccess={handleSetNewSuccess}
          onSetPin={handleSetNewPin}
          onCancel={() => setPinResetMode(null)}
        />
      )}
    </div>
  );
}
