import { useState } from "react";
import { useAppStore } from "@/core/store";
import { getDb, kv } from "@/core/db";
import { api } from "@/core/api";
import PinGateModal from "@/shared/components/PinGateModal";
import { useUiTranslation } from "@/shared/i18n/useUiTranslation.js";

export default function AdultPinSettings() {
  const { t } = useUiTranslation();
  const adultPinHash = useAppStore(s => s.settings.adultPinHash ?? null);
  const [pinResetMode, setPinResetMode] = useState(null);
  const [error, setError] = useState(false);
  async function handlePatchSettings(patch) {
    setError(false);
    useAppStore.getState().patchSettings(patch);
    try {
      await kv.set(await getDb(), "settings", useAppStore.getState().settings);
      if (useAppStore.getState().token) await api.patch("/account/settings", patch);
    } catch { setError(true); }
  }

  function startPinReset() {
    setPinResetMode(adultPinHash === null ? "set-new" : "verify-old");
  }

  function handleVerifyOldSuccess() {
    setPinResetMode("set-new");
  }

  async function handleSetNewPin(hash) {
    await handlePatchSettings({ adultPinHash: hash });
  }

  function handleSetNewSuccess() { setPinResetMode(null); }
  return <div className="settings-row">
    <span>{t("settings.pin")}</span><button className="link-btn" onClick={startPinReset}>{t(adultPinHash ? "settings.changePin" : "settings.setPin")}</button>
    {error && <span role="alert">{t("account.saveError")}</span>}
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
  </div>;
}
