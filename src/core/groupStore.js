import { getDb, kv, topics } from "@/core/db";
import { pushOp } from "@/core/syncApi";

const groupKey     = (topicId) => `group_${topicId}`;
const settingsKey  = (topicId) => `recipe_settings_${topicId}`;
const overrideKey  = (topicId, textId, mode) =>
  mode === "individual"
    ? `recipe_override_${topicId}_${textId}_individual`
    : `recipe_override_${topicId}_${textId}`;

export async function getGroup(topicId) {
  const db = await getDb();
  return (await kv.get(db, groupKey(topicId))) ?? [];
}

export async function saveGroup(topicId, children) {
  const db = await getDb();
  await kv.set(db, groupKey(topicId), children);
}

// ─── Recipe settings ─────────────────────────────────────────────────────────

export async function getRecipeSettings(topicId) {
  const db = await getDb();
  return (await kv.get(db, settingsKey(topicId))) ?? { mode: "group", portions: 1 };
}

export async function saveRecipeSettings(topicId, settings) {
  const db = await getDb();
  const key = settingsKey(topicId);
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

/** Load raw recipe .txt from ZIP store (topics IndexedDB). */
export async function getRawRecipeTxt(topicId, filePath) {
  const db = await getDb();
  const blob = await topics.getFile(db, topicId, filePath);
  if (!blob) return null;
  return blob.text();
}
