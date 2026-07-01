import { getDb, kv } from '@/core/db';
import { pushOp } from '@/core/syncApi';
import { api } from '@/core/api';
import { normalizePlan } from './plannerUtils.js';

const planKey = (studentId) => `planner:plan:${studentId}`;

export const PANTRY_ITEMS = new Set([
  'масло растительное',
  'масло сливочное',
  'масло оливковое',
  'масло тыквенное',
  'соль',
  'сахар',
  'специи',
  'мёд',
  'бальзамический уксус',
  'яблочный уксус',
  'мука',
  'горчица',
  'кетчуп',
]);

export async function savePlan(plan) {
  const db = await getDb();
  const key = planKey(plan.studentId);
  await kv.set(db, key, plan);
  pushOp('kv.upsert', { key, value: plan }).catch(() => {});
}

export async function loadPlan(studentId) {
  const db = await getDb();
  const raw = await kv.get(db, planKey(studentId));
  return raw ? normalizePlan(raw) : null;
}

export async function sendPlanToStudent(studentId, plan) {
  await api.patch(`/students/${studentId}/active-task`, {
    topicId: null,
    modeId: null,
    planData: plan,
  });
}
