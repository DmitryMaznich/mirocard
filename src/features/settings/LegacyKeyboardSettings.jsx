import { useAppStore } from "@/core/store";
import { getDb, kv } from "@/core/db";
import { useUiTranslation } from "@/shared/i18n/useUiTranslation.js";

// Retained for a future return; deliberately not mounted in SettingsScreen.
export default function LegacyKeyboardSettings() {
  const { t } = useUiTranslation();
  const enabled = useAppStore(s => s.settings.physicalKeyboard ?? false);
  async function change() {
    useAppStore.getState().patchSettings({ physicalKeyboard: !enabled });
    await kv.set(await getDb(), "settings", useAppStore.getState().settings);
  }
  return <section className="settings-section"><h2>{t("settings.controls")}</h2>
    <label className="settings-row"><span>{t("settings.keyboard")}</span>
      <input type="checkbox" checked={enabled} onChange={change} /></label>
  </section>;
}
