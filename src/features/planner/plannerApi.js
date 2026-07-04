import { getDb, kv } from '@/core/db';
import { pushOp } from '@/core/syncApi';
import { api } from '@/core/api';
import {
  getRawRecipeTxt,
  savePlannerShopCustomData, savePlannerShopPlan, savePlannerShopBought,
  savePlannerPutawayPlan, savePlannerShopMenuKeys,
} from '@/core/groupStore';
import { normalizePlan } from './plannerUtils.js';
import { parseRecipeMetadata } from './recipeParser.js';

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

// Every recipe topic's instruction texts, with parsed ingredients/portions —
// shared between PlannerMenuScreen (browsing) and the Planner hub (checking
// whether every selected recipe's ingredients have a Дома/Купить decision).
export async function loadAllRecipes(topicRecords) {
  const all = [];
  for (const record of topicRecords) {
    if (record.meta?.renderer !== 'reading') continue;
    for (const text of record.texts ?? []) {
      if (text.kind !== 'instruction' || !text.file) continue;
      const content = await getRawRecipeTxt(record.meta.id, text.file);
      if (!content) continue;
      const { tags, ingredients, portions, fixedPortions, maxPortions, status } = parseRecipeMetadata(content);
      all.push({ topicId: record.meta.id, text, tags, ingredients, portions, fixedPortions, maxPortions, status });
    }
  }
  return all;
}

// Clears the whole downstream shopping-list lifecycle for a student: the
// generated category list, what's checked, what's bought, where it's been
// put away, and which checks were menu-managed. Used both when starting a
// brand-new menu (Меню's "Начать меню заново") and when regenerating the
// list from the current menu (Покупки's "Пересоставить из рецептов") — the
// store list and shopping history are untouched by this on purpose.
export async function resetShoppingData(studentId) {
  await savePlannerShopCustomData(studentId, null);
  await savePlannerShopPlan(studentId, {});
  await savePlannerShopBought(studentId, {});
  await savePlannerPutawayPlan(studentId, {});
  await savePlannerShopMenuKeys(studentId, []);
}
