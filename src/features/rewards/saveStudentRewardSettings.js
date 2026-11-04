import { useAppStore } from "@/core/store";
import { getDb, kv } from "@/core/db";
import { pushOp } from "@/core/syncApi";
import { normalizeRewardSettings } from "../../../shared/reward-policy.mjs";

// Change the student's prize rules (strict counting, what a mistake burns) from a lesson settings
// screen (VideoPrizeCard, owner 2026-11-04: «строгий подсчёт должен остаться»). They are the same
// rules as «Ученик → Правила видеоприза», shared by every topic: saved on the student, on this device
// and through the rules' own sync op, exactly as the student card saves them.
export async function saveStudentRewardSettings(studentId, patch) {
  const state = useAppStore.getState();
  const student = state.students.find((s) => s.id === studentId);
  if (!student) return;
  const settings = normalizeRewardSettings({ ...normalizeRewardSettings(student.rewardSettings), ...patch });
  const ts = new Date().toISOString();
  const next = state.students.map((s) => (s.id === studentId ? { ...s, rewardSettings: settings, rewardSettingsUpdatedAt: ts } : s));
  state.setStudents(next);
  try {
    const db = await getDb();
    await kv.set(db, "students", next);
  } catch { /* the store is updated; the op below still syncs */ }
  pushOp("student.reward_settings.upsert", { studentId, settings, updatedAt: ts });
}
