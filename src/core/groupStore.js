import { getDb, kv, topics } from "@/core/db";

const groupKey = (topicId) => `group_${topicId}`;
const overrideKey = (topicId, textId) => `recipe_override_${topicId}_${textId}`;

export async function getGroup(topicId) {
  const db = await getDb();
  return (await kv.get(db, groupKey(topicId))) ?? [];
}

export async function saveGroup(topicId, children) {
  const db = await getDb();
  await kv.set(db, groupKey(topicId), children);
}

export async function getRecipeOverride(topicId, textId) {
  const db = await getDb();
  return (await kv.get(db, overrideKey(topicId, textId))) ?? null;
}

export async function saveRecipeOverride(topicId, textId, rawText) {
  const db = await getDb();
  await kv.set(db, overrideKey(topicId, textId), rawText);
}

/** Load raw recipe .txt from ZIP store (topics IndexedDB). */
export async function getRawRecipeTxt(topicId, filePath) {
  const db = await getDb();
  const blob = await topics.getFile(db, topicId, filePath);
  if (!blob) return null;
  return blob.text();
}
