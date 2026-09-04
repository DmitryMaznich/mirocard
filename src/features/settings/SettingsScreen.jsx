import { useState } from "react";
import { useAppStore } from "@/core/store";
import { getDb, kv } from "@/core/db";
import { api } from "@/core/api";
import PinGateModal from "@/shared/components/PinGateModal";
import ZoneSettingsSection from "./ZoneSettingsSection";
import { BackArrowIcon } from "@/shared/components/ArrowIcons";

export default function SettingsScreen() {
  const setScreen        = useAppStore((s) => s.setScreen);
  const buildInfo        = useAppStore((s) => s.buildInfo);
  const settings         = useAppStore((s) => s.settings);
  const patchSettings    = useAppStore((s) => s.patchSettings);

  const adultPinHash      = settings.adultPinHash ?? null;
  const physicalKeyboard  = settings.physicalKeyboard ?? false;
  const [pinResetMode, setPinResetMode] = useState(null); // null | "verify-old" | "set-new"

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

  function handleSetNewSuccess() {
    setPinResetMode(null);
  }

  return (
    <div className="screen">
      <div className="screen-header">
        <button className="back-btn" onClick={() => setScreen("home")}><BackArrowIcon /></button>
        <h1 className="screen-title">Настройки</h1>
      </div>

      <div className="settings-body">
        <div className="settings-section">
          <div className="settings-section-title">Темп продолжения</div>
          <div
            className="settings-row"
            style={{ cursor: "pointer" }}
            onClick={() => handlePatchSettings({ adultConfirmAdvance: !adultConfirmAdvance })}
          >
            <span className="settings-row__label">Переход после подтверждения</span>
            <input
              type="checkbox"
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
            <span className="settings-row__label">Следующая карта по тапу</span>
            <input
              type="checkbox"
              checked={adultConfirmAdvance ? true : tapToAdvance}
              readOnly
              disabled={adultConfirmAdvance}
              style={{ width: 18, height: 18, accentColor: "var(--color-primary, #5b8def)", flexShrink: 0, cursor: "pointer" }}
            />
          </div>
          <div
            className="settings-row"
            style={{ opacity: requiresTapToAdvance ? 0.4 : 1, pointerEvents: requiresTapToAdvance ? "none" : "auto" }}
          >
            <div className="settings-row__label">Задержка (сек)</div>
            <div className="param-stepper">
              <button
                className="stepper-btn"
                disabled={autoAdvanceDelay <= 1}
                onClick={() => handlePatchSettings({ autoAdvanceDelay: autoAdvanceDelay - 1 })}
              >−</button>
              <span className="stepper-value">{autoAdvanceDelay}</span>
              <button
                className="stepper-btn"
                disabled={autoAdvanceDelay >= 10}
                onClick={() => handlePatchSettings({ autoAdvanceDelay: autoAdvanceDelay + 1 })}
              >+</button>
            </div>
          </div>
          <div className="settings-row">
            <span className="settings-label">PIN-код занятия</span>
            <button className="link-btn" onClick={startPinReset}>
              {adultPinHash ? "Изменить PIN" : "Задать PIN"}
            </button>
          </div>
        </div>

        <div className="settings-section">
          <div className="settings-section-title">Управление</div>
          <div
            className="settings-row"
            style={{ cursor: "pointer" }}
            onClick={() => handlePatchSettings({ physicalKeyboard: !physicalKeyboard })}
          >
            <span className="settings-row__label">Физическая клавиатура</span>
            <input
              type="checkbox"
              checked={physicalKeyboard}
              readOnly
              style={{ width: 18, height: 18, accentColor: "var(--color-primary, #5b8def)", flexShrink: 0, cursor: "pointer" }}
            />
          </div>
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
