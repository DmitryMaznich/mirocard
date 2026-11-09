import { useEffect } from "react";
import { useAppStore } from "@/core/store";
import { useTopicUiPreview } from "@/core/topicUiPreview";
import { getDb, kv } from "@/core/db";

const PICKER_SCREENS = new Set(["home", "topics", "texts", "all_texts", "modes", "params", "chat_params"]);

// Legacy Home used to persist this context when returning from every picker.
// The preview goes straight between pickers, so persist the same existing key.
export default function TopicUiPreviewContext() {
  const { enabled } = useTopicUiPreview();
  const screen = useAppStore((state) => state.screen);
  const studentId = useAppStore((state) => state.activeStudentId);
  const topicId = useAppStore((state) => state.activeTopicId);
  const textId = useAppStore((state) => state.activeTextId);
  const modeId = useAppStore((state) => state.activeModeId);
  const records = useAppStore((state) => state.topicRecords);
  const accountId = useAppStore((state) => state.account?.id);
  useEffect(() => {
    if (!enabled || !PICKER_SCREENS.has(screen) || !studentId || !records.some((r) => r.meta.id === topicId && !r.meta.hidden)) return;
    let cancelled = false;
    getDb().then((db) => {
      if (!cancelled) return kv.set(db, "lastContext", { studentId, topicId, textId: textId ?? null, modeId: modeId ?? null });
    }).catch(() => { /* Existing in-memory selection stays usable if IDB is unavailable. */ });
    return () => { cancelled = true; };
  }, [enabled, screen, studentId, topicId, textId, modeId, records, accountId]);
  return null;
}
