import { getDb, kv } from '@/core/db';
import { pushOp } from '@/core/syncApi';
import { api } from '@/core/api';
import {
  getRawRecipeTxt,
  savePlannerShopCustomData, savePlannerShopPlan, savePlannerShopBought,
  savePlannerPutawayPlan, savePlannerShopMenuKeys,
  getPlannerShopPlan, getPlannerShopStores,
  getPlannerCycleTrips, savePlannerCycleTrips,
  getPlannerCycleHistory, savePlannerCycleHistory,
} from '@/core/groupStore';
import { normalizePlan } from './plannerUtils.js';
import { parseRecipeMetadata } from './recipeParser.js';
import { archiveTripPhotos } from './plannerPhotos.js';

const RU_MONTHS = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];

function formatHistoryDate(d) {
  return `${d.getDate()} ${RU_MONTHS[d.getMonth()]} • ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatDateOnly(d) {
  return `${d.getDate()} ${RU_MONTHS[d.getMonth()]}`;
}

export function formatCycleDateRange(start, end) {
  const startStr = formatDateOnly(start);
  const endStr = formatDateOnly(end);
  return startStr === endStr ? startStr : `${startStr} — ${endStr}`;
}

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

// Archives one shopping trip (receipt + zone photos) into this cycle's
// not-yet-closed trip accumulator — called by "Начать новый список"
// (Покупки), which may run several times within the same cycle if more
// than one trip to the store is needed. Does NOT touch planned/bought/
// putawayPlan — the caller resets those separately, same as before.
export async function archiveShoppingTrip(studentId, store) {
  const planned = await getPlannerShopPlan(studentId);
  if (!planned || Object.keys(planned).length === 0) return null;
  const now = new Date();
  const tripId = now.getTime();
  const { hasReceipt, zonePhotos } = await archiveTripPhotos(studentId, tripId);
  const trip = {
    tripId,
    date: formatHistoryDate(now),
    store: store ?? null,
    count: Object.keys(planned).length,
    hasReceipt,
    zonePhotos,
  };
  const trips = await getPlannerCycleTrips(studentId);
  const nextTrips = [...trips, trip];
  await savePlannerCycleTrips(studentId, nextTrips);
  return trip;
}

// Closes the whole cycle — called by "Начать новое меню" (hub), before its
// own reset. Archives any still-open trip first (the child may have gone
// straight here without ever clicking "Начать новый список"), then builds
// one entry covering every trip of this cycle plus which recipes were
// cooked. Zone photos are merged by zone across all trips — if the same
// zone was photographed more than once, only the latest trip's photo is
// kept in the entry.
export async function archiveCycle(studentId, plan, menuRecipes, cookedTextIds) {
  const stores = await getPlannerShopStores(studentId);
  await archiveShoppingTrip(studentId, stores?.current);

  const trips = await getPlannerCycleTrips(studentId);
  if (trips.length === 0 && menuRecipes.length === 0) return null;

  const zoneMap = new Map();
  for (const trip of trips) {
    for (const zoneId of trip.zonePhotos) zoneMap.set(zoneId, trip.tripId);
  }

  const now = new Date();
  const entry = {
    id: now.getTime(),
    dateRange: formatCycleDateRange(new Date(plan.createdAt), now),
    recipes: menuRecipes.map((r) => ({
      textId: r.text.id,
      title: r.text.title,
      cooked: cookedTextIds.has(r.text.id),
    })),
    trips,
    zonePhotos: Array.from(zoneMap, ([zoneId, tripId]) => ({ zoneId, tripId })),
  };

  const history = await getPlannerCycleHistory(studentId);
  await savePlannerCycleHistory(studentId, [entry, ...history].slice(0, 5));
  await savePlannerCycleTrips(studentId, []);
  return entry;
}
