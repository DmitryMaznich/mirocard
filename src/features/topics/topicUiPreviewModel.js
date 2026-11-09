import { isPickableMode } from "@/shared/utils/topicUtils";

export function previewTopicDestination(record) {
  if (record.meta.renderer === "reading") return "texts";
  if (record.meta.renderer === "chat_practice" && !record.modes?.some(isPickableMode)) return "chat_params";
  return "modes"; // Existing picker owns single-mode, games and people routes.
}

export function recentTopicContext(sessions, studentId, snapshot) {
  if (!studentId) return null;
  const candidates = sessions.filter((session) => session.studentId === studentId)
    .map((session) => ({ ...session, time: Date.parse(session.completedAt || session.startedAt) || 0 }));
  if (snapshot?.context?.studentId === studentId) {
    candidates.push({ ...snapshot.context, time: Date.parse(snapshot.updatedAt) || 0 });
  }
  return candidates.filter((item) => item.topicId && item.time > 0)
    .sort((a, b) => b.time - a.time)[0] ?? null;
}

export function rememberPreviewChoice(studentId, kind) {
  if (!studentId) return;
  try {
    const key = `mirocard_home_picker_confirmed_${studentId}`;
    let flags = {};
    try { flags = JSON.parse(localStorage.getItem(key)) || {}; } catch { /* old/broken preference */ }
    localStorage.setItem(key, JSON.stringify({ ...flags, [kind]: true }));
  } catch { /* The legacy prompt can safely reappear if storage is blocked. */ }
}
