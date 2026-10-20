import { useUiTranslation } from "@/shared/i18n/useUiTranslation.js";
import { useAppStore } from "@/core/store";

export default function SyncStatus() {
  const { t } = useUiTranslation();
  const syncStatus = useAppStore((s) => s.syncStatus);
  const buildInfo  = useAppStore((s) => s.buildInfo);

  const dot = {
    idle:    { color: "#4caf50", title: t("sync.synced") },
    syncing: { color: "#ff9800", title: t("sync.syncing")  },
    error:   { color: "#f44336", title: t("sync.error") },
  }[syncStatus] ?? { color: "#9e9e9e", title: t("sync.offline") };

  return (
    <span
      className="sync-status-dot"
      title={`${dot.title} · v${buildInfo.version} · ${buildInfo.gitSha}`}
      style={{ "--dot-color": dot.color }}
    />
  );
}
