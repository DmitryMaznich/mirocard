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

// What the «Продолжить» card offers: the student's latest topic that is still
// on the device and visible, with its mode when that mode can still be picked.
// Reading keeps the text the lesson was on, so «Начать» lands on the same text.
// `choice` — an exercise picked with «Сменить» after that lesson: it replaces
// the lesson's own exercise until a newer lesson happens.
export function continueContext(recent, records, choice = null) {
  if (!recent) return null;
  const record = records.find((item) => item.meta.id === recent.topicId && !item.meta.hidden);
  if (!record) return null;
  const chosen = choice && choice.topicId === recent.topicId && choice.at > recent.time ? choice : null;
  const modeId = chosen ? chosen.modeId : recent.modeId;
  const mode = record.modes?.filter(isPickableMode).find((item) => item.id === modeId) ?? null;
  const textId = chosen && chosen.textId !== undefined ? chosen.textId : recent.textId ?? null;
  return { record, mode, textId, time: recent.time };
}

// «Сменить» in the «Продолжить» card opens the exercise list in pick mode:
// the tapped exercise goes back into the card instead of opening the lesson
// settings. The flag lives only while the adult is in the pickers (cleared by
// TopicUiPreviewContext on any other screen).
let continuePick = false;
export function startContinuePick() { continuePick = true; }
export function endContinuePick() { continuePick = false; }
export function isContinuePick() { return continuePick; }

const CHOICE_PREFIX = "mirocard.topic-ui-preview.continue.v1:";
export function saveContinueChoice(studentId, { topicId, modeId, textId = null }, now = Date.now()) {
  if (!studentId) return;
  try { localStorage.setItem(CHOICE_PREFIX + studentId, JSON.stringify({ topicId, modeId, textId, at: now })); }
  catch { /* The card falls back to the last lesson's exercise. */ }
}
export function readContinueChoice(studentId) {
  if (!studentId) return null;
  try {
    const value = JSON.parse(localStorage.getItem(CHOICE_PREFIX + studentId));
    return value && typeof value.topicId === "string" && Number.isFinite(value.at) ? value : null;
  } catch { return null; }
}

// Where «Начать занятие» goes — the same routes as the legacy Home button
// (startOrContinue): topics with their own home go to their picker, the rest
// open lesson settings first. Without a remembered mode the picker decides.
export function continueDestination(record, mode, textId) {
  const id = record.meta.id;
  if (id === "games" || id === "my_people") return "modes";
  if (record.meta.renderer === "chat_practice") return record.modes?.length > 0 ? "modes" : "chat_params";
  if (record.meta.renderer === "reading" && !textId) return "texts";
  return mode ? "params" : previewTopicDestination(record);
}

const DAY = 24 * 60 * 60 * 1000;
function dayStart(date) { return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime(); }

// «сегодня, 10:15» / «вчера» / «5 ноября» (year added when it differs).
// Time only for today: for older lessons the day is what an adult needs.
export function lastActivityParts(time, now = new Date()) {
  const date = new Date(time);
  if (!Number.isFinite(date.getTime())) return null;
  const days = Math.round((dayStart(now) - dayStart(date)) / DAY);
  if (days <= 0) return { kind: "today", date };
  if (days === 1) return { kind: "yesterday", date };
  return { kind: "date", date, withYear: date.getFullYear() !== now.getFullYear() };
}

export function formatLastActivity(time, t, language, now = new Date()) {
  const parts = lastActivityParts(time, now);
  if (!parts) return "";
  const locale = language === "sl" ? "sl-SI" : "ru-RU";
  if (parts.kind === "today") {
    return t("preview.today", { time: parts.date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }) });
  }
  if (parts.kind === "yesterday") return t("preview.yesterday");
  return parts.date.toLocaleDateString(locale, { day: "numeric", month: "long", ...(parts.withYear ? { year: "numeric" } : {}) });
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
