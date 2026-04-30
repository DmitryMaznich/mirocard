import { useAppStore } from "@/core/store";

export default function SyncStatus() {
  const syncStatus = useAppStore((s) => s.syncStatus);
  const buildInfo  = useAppStore((s) => s.buildInfo);

  const dot = {
    idle:    { color: "#4caf50", title: "Синхронизировано" },
    syncing: { color: "#ff9800", title: "Синхронизация…"  },
    error:   { color: "#f44336", title: "Ошибка синхронизации" },
  }[syncStatus] ?? { color: "#9e9e9e", title: "Нет соединения" };

  return (
    <span
      className="sync-status-dot"
      title={`${dot.title} · v${buildInfo.version} · ${buildInfo.gitSha}`}
      style={{ "--dot-color": dot.color }}
    />
  );
}
