import { getDb, kv, topics } from "@/core/db";
import { pushOp } from "@/core/syncApi";
import { api } from "@/core/api";
import { RECIPES_TOPIC_ID, getBuiltinRecipeRawText } from "@/topics/builtinRecipesTopic";

const settingsKey  = (topicId, textId) => `recipe_settings_${topicId}_${textId}`;
const overrideKey  = (topicId, textId, mode) =>
  mode === "individual"
    ? `recipe_override_${topicId}_${textId}_individual`
    : `recipe_override_${topicId}_${textId}`;

// ─── Recipe settings ─────────────────────────────────────────────────────────

export async function getRecipeSettings(topicId, textId) {
  const db = await getDb();
  // portions defaults to null (not 1) so callers can distinguish "never
  // configured" from "explicitly chose 1" and fall back to their own
  // recipe-appropriate default (e.g. the recipe's own base serving count).
  return (await kv.get(db, settingsKey(topicId, textId))) ?? { mode: "group", portions: null };
}

export async function saveRecipeSettings(topicId, textId, settings) {
  const db = await getDb();
  const key = settingsKey(topicId, textId);
  await kv.set(db, key, settings);
  pushOp("kv.upsert", { key, value: settings }).catch(() => {});
}

// ─── Recipe overrides (mode-aware) ───────────────────────────────────────────

export async function getRecipeOverride(topicId, textId) {
  return getRecipeOverrideForMode(topicId, textId, "group");
}

export async function saveRecipeOverride(topicId, textId, rawText) {
  return saveRecipeOverrideForMode(topicId, textId, "group", rawText);
}

export async function getRecipeOverrideForMode(topicId, textId, mode) {
  const db = await getDb();
  return (await kv.get(db, overrideKey(topicId, textId, mode))) ?? null;
}

export async function saveRecipeOverrideForMode(topicId, textId, mode, rawText) {
  const db = await getDb();
  const key = overrideKey(topicId, textId, mode);
  await kv.set(db, key, rawText);
  pushOp("kv.upsert", { key, value: rawText }).catch(() => {});
}

/** Load raw recipe .txt — from the bundled recipe library, or from ZIP store (topics IndexedDB) for any other reading topic. */
export async function getRawRecipeTxt(topicId, filePath) {
  if (topicId === RECIPES_TOPIC_ID) {
    return getBuiltinRecipeRawText(filePath);
  }
  const db = await getDb();
  const blob = await topics.getFile(db, topicId, filePath);
  if (!blob) return null;
  return blob.text();
}

// ─── User-created recipes ─────────────────────────────────────────────────────

const userRecipesKey = (topicId) => `user_recipes_${topicId}`;

export async function getUserRecipes(topicId) {
  const db = await getDb();
  return (await kv.get(db, userRecipesKey(topicId))) ?? [];
}

export async function createUserRecipe(topicId, titleRu) {
  const db = await getDb();
  const id = `user_${Date.now()}`;
  const entry = {
    id,
    kind: "instruction",
    title: { ru: titleRu, en: titleRu },
    file: null,
    stepCount: 0,
    createdByUser: true,
  };
  const list = await getUserRecipes(topicId);
  list.push(entry);
  const key = userRecipesKey(topicId);
  await kv.set(db, key, list);
  pushOp("kv.upsert", { key, value: list }).catch(() => {});
  return entry;
}

export async function deleteUserRecipe(topicId, recipeId) {
  const db = await getDb();
  const list = await getUserRecipes(topicId);
  const filtered = list.filter((r) => r.id !== recipeId);
  const key = userRecipesKey(topicId);
  await kv.set(db, key, filtered);
  pushOp("kv.upsert", { key, value: filtered }).catch(() => {});
  for (const mode of ["group", "individual"]) {
    await kv.set(db, overrideKey(topicId, recipeId, mode), null);
  }
}

// ─── Shopping category order ──────────────────────────────────────────────────

const shoppingOrderKey = (topicId) => `shopping_order_${topicId}`;

export async function getShoppingOrder(topicId) {
  const db = await getDb();
  return (await kv.get(db, shoppingOrderKey(topicId))) ?? null;
}

export async function saveShoppingOrder(topicId, names) {
  const db = await getDb();
  const key = shoppingOrderKey(topicId);
  await kv.set(db, key, names);
  pushOp("kv.upsert", { key, value: names }).catch(() => {});
}

export function applyShoppingOrder(steps, categoryIcons, savedOrder) {
  if (!savedOrder?.length) return { steps, categoryIcons };
  const nameToIdx = {};
  steps.forEach((s, i) => { nameToIdx[s.text.replace(/:$/, "").trim()] = i; });
  const ordered = [];
  const used = new Set();
  for (const name of savedOrder) {
    const i = nameToIdx[name];
    if (i !== undefined) { ordered.push(i); used.add(i); }
  }
  steps.forEach((_, i) => { if (!used.has(i)) ordered.push(i); });
  return {
    steps:         ordered.map((i) => steps[i]),
    categoryIcons: ordered.map((i) => categoryIcons[i] ?? "📦"),
  };
}

// ─── Server sync (pull) ───────────────────────────────────────────────────────

// ─── Shopping plan (standalone topic) ────────────────────────────────────────

const shoppingPlanKey = (topicId) => `shopping_plan_${topicId}`;

export async function getShoppingPlan(topicId) {
  const db = await getDb();
  return (await kv.get(db, shoppingPlanKey(topicId))) ?? {};
}

export async function saveShoppingPlan(topicId, plan) {
  const db = await getDb();
  const key = shoppingPlanKey(topicId);
  await kv.set(db, key, plan);
  pushOp("kv.upsert", { key, value: plan }).catch(() => {});
}

// ─── Shopping stores (list + current selection) ──────────────────────────────

const shoppingStoresKey = (topicId) => `shopping_stores_${topicId}`;

export async function getShoppingStores(topicId) {
  const db = await getDb();
  return (await kv.get(db, shoppingStoresKey(topicId))) ?? null;
}

export async function saveShoppingStores(topicId, stores) {
  const db = await getDb();
  const key = shoppingStoresKey(topicId);
  await kv.set(db, key, stores);
}

// ─── Shopping history (last 5 completed lists) ───────────────────────────────

const shoppingHistoryKey = (topicId) => `shopping_history_${topicId}`;

export async function getShoppingHistory(topicId) {
  const db = await getDb();
  return (await kv.get(db, shoppingHistoryKey(topicId))) ?? [];
}

export async function saveShoppingHistory(topicId, history) {
  const db = await getDb();
  const key = shoppingHistoryKey(topicId);
  await kv.set(db, key, history);
}

// ─── Shopping custom category data ───────────────────────────────────────────

const shoppingCustomKey = (topicId) => `shopping_custom_${topicId}`;

export async function getShoppingCustomData(topicId) {
  const db = await getDb();
  return (await kv.get(db, shoppingCustomKey(topicId))) ?? null;
}

export async function saveShoppingCustomData(topicId, data) {
  const db = await getDb();
  await kv.set(db, shoppingCustomKey(topicId), data);
}

// ─── Planner shopping storage (separate from shopping topic) ─────────────────

const plannerShopPlanKey    = (sid) => `planner_shop_plan_${sid}`;
const plannerShopCustomKey  = (sid) => `planner_shop_custom_${sid}`;

export async function getPlannerShopPlan(studentId) {
  const db = await getDb();
  return (await kv.get(db, plannerShopPlanKey(studentId))) ?? {};
}

export async function savePlannerShopPlan(studentId, plan) {
  const db = await getDb();
  const key = plannerShopPlanKey(studentId);
  await kv.set(db, key, plan);
  pushOp("kv.upsert", { key, value: plan }).catch(() => {});
}

export async function getPlannerShopCustomData(studentId) {
  const db = await getDb();
  return (await kv.get(db, plannerShopCustomKey(studentId))) ?? null;
}

export async function savePlannerShopCustomData(studentId, data) {
  const db = await getDb();
  const key = plannerShopCustomKey(studentId);
  await kv.set(db, key, data);
  pushOp("kv.upsert", { key, value: data }).catch(() => {});
}

// ─── Planner shopping "bought" state (persists ShopView's tap-to-take
// checks — previously local useState, lost on navigating away; Раскладка
// needs to know what was actually bought, not just planned) ────────────────

const plannerShopBoughtKey = (sid) => `planner_shop_bought_${sid}`;

export async function getPlannerShopBought(studentId) {
  const db = await getDb();
  return (await kv.get(db, plannerShopBoughtKey(studentId))) ?? {};
}

export async function savePlannerShopBought(studentId, bought) {
  const db = await getDb();
  const key = plannerShopBoughtKey(studentId);
  await kv.set(db, key, bought);
  pushOp("kv.upsert", { key, value: bought }).catch(() => {});
}

// ─── Planner putaway (Раскладка) placements ──────────────────────────────
// { [planKey]: zoneId } — keyed the same way as the shopping plan/bought
// maps, so no new identifier scheme is introduced.

const plannerPutawayPlanKey = (sid) => `planner_putaway_plan_${sid}`;

export async function getPlannerPutawayPlan(studentId) {
  const db = await getDb();
  return (await kv.get(db, plannerPutawayPlanKey(studentId))) ?? {};
}

export async function savePlannerPutawayPlan(studentId, plan) {
  const db = await getDb();
  const key = plannerPutawayPlanKey(studentId);
  await kv.set(db, key, plan);
  pushOp("kv.upsert", { key, value: plan }).catch(() => {});
}

// ─── Planner "menu-managed" keys ──────────────────────────────────────────
// { planKey: true } → array of planKey strings currently checked *because*
// Меню decided "Купить" for them (as opposed to checked manually in
// Покупки, e.g. napkins) — lets syncDecisionsIntoShoppingData tell the two
// apart when a recipe leaves the menu and its ingredients need un-checking.

const plannerShopMenuKeysKey = (sid) => `planner_shop_menu_keys_${sid}`;

export async function getPlannerShopMenuKeys(studentId) {
  const db = await getDb();
  return (await kv.get(db, plannerShopMenuKeysKey(studentId))) ?? [];
}

export async function savePlannerShopMenuKeys(studentId, keys) {
  const db = await getDb();
  const key = plannerShopMenuKeysKey(studentId);
  await kv.set(db, key, keys);
  pushOp("kv.upsert", { key, value: keys }).catch(() => {});
}

const plannerShopStoresKey  = (sid) => `planner_shop_stores_${sid}`;
const plannerShopHistoryKey = (sid) => `planner_shop_history_${sid}`;

export async function getPlannerShopStores(studentId) {
  const db = await getDb();
  return (await kv.get(db, plannerShopStoresKey(studentId))) ?? null;
}

export async function savePlannerShopStores(studentId, stores) {
  const db = await getDb();
  const key = plannerShopStoresKey(studentId);
  await kv.set(db, key, stores);
  pushOp("kv.upsert", { key, value: stores }).catch(() => {});
}

export async function getPlannerShopHistory(studentId) {
  const db = await getDb();
  return (await kv.get(db, plannerShopHistoryKey(studentId))) ?? [];
}

export async function savePlannerShopHistory(studentId, history) {
  const db = await getDb();
  const key = plannerShopHistoryKey(studentId);
  await kv.set(db, key, history);
  pushOp("kv.upsert", { key, value: history }).catch(() => {});
}

const plannerCycleTripsKey   = (sid) => `planner_cycle_trips_${sid}`;
const plannerCycleHistoryKey = (sid) => `planner_cycle_history_${sid}`;

export async function getPlannerCycleTrips(studentId) {
  const db = await getDb();
  return (await kv.get(db, plannerCycleTripsKey(studentId))) ?? [];
}

export async function savePlannerCycleTrips(studentId, trips) {
  const db = await getDb();
  const key = plannerCycleTripsKey(studentId);
  await kv.set(db, key, trips);
  pushOp("kv.upsert", { key, value: trips }).catch(() => {});
}

export async function getPlannerCycleHistory(studentId) {
  const db = await getDb();
  return (await kv.get(db, plannerCycleHistoryKey(studentId))) ?? [];
}

export async function savePlannerCycleHistory(studentId, history) {
  const db = await getDb();
  const key = plannerCycleHistoryKey(studentId);
  await kv.set(db, key, history);
  pushOp("kv.upsert", { key, value: history }).catch(() => {});
}

// ─── Planner zone customizations (Раскладка: family-renamed/added zones) ──

const plannerZoneCustomizationsKey = (sid) => `planner_zone_customizations_${sid}`;

export async function getPlannerZoneCustomizations(studentId) {
  const db = await getDb();
  return (await kv.get(db, plannerZoneCustomizationsKey(studentId))) ?? { renamed: {}, added: [] };
}

export async function savePlannerZoneCustomizations(studentId, customizations) {
  const db = await getDb();
  const key = plannerZoneCustomizationsKey(studentId);
  await kv.set(db, key, customizations);
  pushOp("kv.upsert", { key, value: customizations }).catch(() => {});
}

// ─── Planner product zone overrides (family fix for one product's zone) ───

const plannerProductZoneOverridesKey = (sid) => `planner_product_zone_overrides_${sid}`;

export async function getPlannerProductZoneOverrides(studentId) {
  const db = await getDb();
  return (await kv.get(db, plannerProductZoneOverridesKey(studentId))) ?? {};
}

export async function savePlannerProductZoneOverrides(studentId, overrides) {
  const db = await getDb();
  const key = plannerProductZoneOverridesKey(studentId);
  await kv.set(db, key, overrides);
  pushOp("kv.upsert", { key, value: overrides }).catch(() => {});
}

// ─── Safe code (safe_code mode) session config ───────────────────────────────

const safeCodeConfigKey = (topicId) => `safe_code_config_${topicId}`;

export async function getSafeCodeConfig(topicId) {
  const db = await getDb();
  return (await kv.get(db, safeCodeConfigKey(topicId))) ?? null;
}

export async function saveSafeCodeConfig(topicId, config) {
  const db = await getDb();
  const key = safeCodeConfigKey(topicId);
  await kv.set(db, key, config);
  pushOp("kv.upsert", { key, value: config }).catch(() => {});
}

// ─── Safe code custom (user-typed) hiding spots ──────────────────────────────

const safeCodeCustomLocationsKey = (topicId) => `safe_code_custom_locations_${topicId}`;

export async function getSafeCodeCustomLocations(topicId) {
  const db = await getDb();
  return (await kv.get(db, safeCodeCustomLocationsKey(topicId))) ?? [];
}

export async function saveSafeCodeCustomLocations(topicId, locations) {
  const db = await getDb();
  const key = safeCodeCustomLocationsKey(topicId);
  await kv.set(db, key, locations);
  pushOp("kv.upsert", { key, value: locations }).catch(() => {});
}

// ─── Safe code attempt log (analytics only, not synced) ──────────────────────

const safeCodeLogKey = (topicId) => `safe_code_log_${topicId}`;

export async function getSafeCodeLog(topicId) {
  const db = await getDb();
  return (await kv.get(db, safeCodeLogKey(topicId))) ?? [];
}

export async function appendSafeCodeLog(topicId, entry) {
  const db = await getDb();
  const key = safeCodeLogKey(topicId);
  const existing = (await kv.get(db, key)) ?? [];
  const updated = [...existing, entry].slice(-200);
  await kv.set(db, key, updated);
}

const RECIPE_KV_PREFIXES = ["recipe_override_", "user_recipes_", "recipe_settings_", "shopping_order_", "shopping_plan_"];

export async function pullRecipeKvFromServer() {
  try {
    const query = RECIPE_KV_PREFIXES.map((p) => `prefix=${encodeURIComponent(p)}`).join("&");
    const { kv: items } = await api.get(`/account/kv?${query}`);
    if (!Array.isArray(items) || !items.length) return;
    const db = await getDb();
    for (const { key, value } of items) {
      await kv.set(db, key, value);
    }
  } catch {
    // Offline или не авторизован — пропускаем тихо
  }
}

const PLANNER_KV_PREFIX = "planner_";

export async function pullPlannerKvFromServer() {
  try {
    const { kv: items } = await api.get(`/account/kv?prefix=${encodeURIComponent(PLANNER_KV_PREFIX)}`);
    if (!Array.isArray(items) || !items.length) return;
    const db = await getDb();
    for (const { key, value } of items) {
      await kv.set(db, key, value);
    }
  } catch {
    // Offline или не авторизован — пропускаем тихо, как pullRecipeKvFromServer
  }
}
