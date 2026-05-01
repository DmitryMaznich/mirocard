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
  const isProcedural = manifest.meta.cardType === "procedural" || !!manifest.meta.renderer;
  for (const card of manifest.cards) {
    if (isProcedural && card.renderer) continue;
    if (card.image && !zip.file(card.image)) {
      throw new TopicImportError(`Файл не найден в ZIP: ${card.image}`);
    }
  }
}

const RENDERER_MAP = {
  math_comparison_numbers: "comparison",
  math_comparison_objects: "comparison",
  math_houses:             "math_houses",
};

const DEFAULT_FLASHCARD_MODES = [
  { id: "intro",                  type: "intro",                  evaluation: "none", ui: { title: "Знакомство",      instruction: "Нажмите чтобы продолжить" } },
  { id: "yes_no",                 type: "yes_no",                 evaluation: "auto", ui: { title: "Да / Нет",        instruction: "Правильное ли слово?" } },
  { id: "find_n",                 type: "find_n",                 evaluation: "auto", ui: { title: "Найди картинку",  instruction: "Нажми на нужную картинку" } },
  { id: "choose_word_by_picture", type: "choose_word_by_picture", evaluation: "auto", ui: { title: "Выбери слово",    instruction: "Нажми на правильное слово" } },
];

const DEFAULT_MODES = {
  comparison: [
    { id: "compare_numbers", type: "compare_numbers", evaluation: "auto", ui: { title: "Какое больше?",       instruction: "Нажми на большее число" } },
    { id: "compare_sign",    type: "compare_sign",    evaluation: "auto", ui: { title: "Крокодил",            instruction: "Нажми на большее число" } },
    { id: "compare_equal",   type: "compare_equal",   evaluation: "auto", ui: { title: "Больше или равно",    instruction: "Нажми на большее число или на =" } },
    { id: "compare_visual",  type: "compare_visual",  evaluation: "auto", ui: { title: "Где больше кружков?", instruction: "Нажми на группу с большим количеством" } },
  ],
  math_houses: [
    { id: "math_houses_read", type: "math_houses_read", evaluation: "none", ui: { title: "Изучаем домик",     instruction: "Рассмотри домик числа" } },
    { id: "math_houses",      type: "math_houses",      evaluation: "auto", ui: { title: "Дополняю до числа", instruction: "Нажми на пропущенное число" } },
  ],
};

function normalizeLabel(card) {
  const raw = card.label ?? card.labels;
  if (!raw) return card.answerKey ?? card.id;
  if (typeof raw === "string") return raw;
  return raw.ru ?? raw.en ?? card.answerKey ?? card.id;
}

function normalizeFlashcards(manifest) {
  if (manifest.meta.renderer) return manifest;
  if (manifest.meta.cardType === "procedural") return manifest;

  const meta = { ...manifest.meta, renderer: "flashcards" };

  const cards = manifest.cards.map((card) => ({
    ...card,
    label:     normalizeLabel(card),
    conceptId: card.conceptId ?? card.id,
    primary:   card.primary ?? true,
  }));

  const modes = manifest.modes?.length ? manifest.modes : DEFAULT_FLASHCARD_MODES;

  return { ...manifest, meta, cards, modes };
}

function normalizeProcedural(manifest) {
  if (manifest.meta.cardType !== "procedural" && manifest.meta.renderer) return manifest;
  if (manifest.meta.cardType !== "procedural") return manifest;

  // Infer meta.renderer from first card's renderer field
  const firstRenderer = manifest.cards[0]?.renderer;
  const renderer = RENDERER_MAP[firstRenderer] ?? firstRenderer ?? "comparison";

  const meta = { ...manifest.meta, renderer };

  const cards = manifest.cards.map((card) => ({
    ...card,
    conceptId: card.conceptId ?? card.id,
    primary:   card.primary   ?? true,
  }));

  const modes = manifest.modes?.length ? manifest.modes : (DEFAULT_MODES[renderer] ?? []);

  return { ...manifest, meta, cards, modes };
}

export async function importTopic(db, zipBuffer, appVersion = "0.0.0") {
  const zip = await JSZip.loadAsync(zipBuffer);

  let manifest = await parseManifest(zip);
  manifest = normalizeProcedural(manifest);
  manifest = normalizeFlashcards(manifest);
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

function migrateRecord(record) {
  if (!record) return record;
  if (record.meta.renderer) return record;
  if (record.meta.cardType === "procedural") return record;
  // Old flashcard record without renderer — add defaults at runtime
  return {
    ...record,
    meta: { ...record.meta, renderer: "flashcards" },
    modes: record.modes?.length ? record.modes : DEFAULT_FLASHCARD_MODES,
    cards: record.cards.map((card) => ({
      ...card,
      label:     typeof card.label === "string" ? card.label : normalizeLabel(card),
      conceptId: card.conceptId ?? card.id,
      primary:   card.primary ?? true,
    })),
  };
}

export async function listTopicRecords(db) {
  const ids = await getInstalledTopicIds(db);
  const records = await Promise.all(ids.map((id) => kv.get(db, `topic:${id}`)));
  return records.filter(Boolean).map(migrateRecord);
}

export async function deleteTopicRecord(db, topicId) {
  await topics.deleteTopic(db, topicId);
  await kv.del(db, `topic:${topicId}`);
  await removeFromIndex(db, topicId);
}
