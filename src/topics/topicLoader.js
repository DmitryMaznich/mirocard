import JSZip from "jszip";
import { kv, topics } from "@/core/db";
import { semver } from "@/shared/utils/semver";

export class TopicImportError extends Error {
  constructor(message) {
    super(message);
    this.name = "TopicImportError";
  }
}

async function getInstalledTopicIds(db) {
  return (await kv.get(db, "installedTopicIds")) ?? [];
}

async function addToIndex(db, topicId) {
  const ids = await getInstalledTopicIds(db);
  if (!ids.includes(topicId)) {
    await kv.set(db, "installedTopicIds", [...ids, topicId]);
  }
}

async function removeFromIndex(db, topicId) {
  const ids = await getInstalledTopicIds(db);
  await kv.set(db, "installedTopicIds", ids.filter((id) => id !== topicId));
}

async function parseManifest(zip) {
  const manifestFile = zip.file("topic.json") ?? zip.file("deck.json");
  if (!manifestFile) {
    throw new TopicImportError("ZIP не содержит topic.json");
  }
  const text = await manifestFile.async("string");
  try {
    return JSON.parse(text);
  } catch {
    throw new TopicImportError("topic.json содержит невалидный JSON");
  }
}

function validateManifest(manifest, appVersion) {
  if (!manifest.meta?.id) throw new TopicImportError("Отсутствует meta.id");
  if (!manifest.meta?.version) throw new TopicImportError("Отсутствует meta.version");
  if (!Array.isArray(manifest.cards) || manifest.cards.length === 0) {
    throw new TopicImportError("Тема не содержит карточек");
  }

  if (manifest.meta.minAppVersion && appVersion) {
    if (semver.lt(appVersion, manifest.meta.minAppVersion)) {
      throw new TopicImportError(
        `Обновите приложение до версии ${manifest.meta.minAppVersion}`
      );
    }
  }

  const ids = manifest.cards.map((c) => c.id);
  if (new Set(ids).size !== ids.length) {
    throw new TopicImportError("Карточки содержат дублирующиеся id");
  }
}

function validateImages(manifest, zip) {
  for (const card of manifest.cards) {
    if (card.image && !zip.file(card.image)) {
      throw new TopicImportError(`Файл не найден в ZIP: ${card.image}`);
    }
  }
}

export async function importTopic(db, zipBuffer, appVersion = "0.0.0") {
  const zip = await JSZip.loadAsync(zipBuffer);

  const manifest = await parseManifest(zip);
  validateManifest(manifest, appVersion);
  validateImages(manifest, zip);

  const topicId = manifest.meta.id;

  // Delete old assets if re-importing
  await topics.deleteTopic(db, topicId);

  // Save all non-manifest files as blobs
  for (const filename of Object.keys(zip.files)) {
    if (zip.files[filename].dir) continue;
    if (filename === "topic.json" || filename === "deck.json") continue;
    const blob = await zip.files[filename].async("blob");
    await topics.saveFile(db, topicId, filename, blob);
  }

  const record = {
    id: topicId,
    meta: manifest.meta,
    modes: manifest.modes ?? [],
    cards: manifest.cards,
    installedAt: new Date().toISOString(),
  };

  await kv.set(db, `topic:${topicId}`, record);
  await addToIndex(db, topicId);

  return record;
}

export async function getTopicRecord(db, topicId) {
  return kv.get(db, `topic:${topicId}`);
}

export async function listTopicRecords(db) {
  const ids = await getInstalledTopicIds(db);
  const records = await Promise.all(ids.map((id) => kv.get(db, `topic:${id}`)));
  return records.filter(Boolean);
}

export async function deleteTopicRecord(db, topicId) {
  await topics.deleteTopic(db, topicId);
  await kv.del(db, `topic:${topicId}`);
  await removeFromIndex(db, topicId);
}
