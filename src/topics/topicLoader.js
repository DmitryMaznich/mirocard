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
  const isReading = manifest.meta.renderer === "reading" || Array.isArray(manifest.texts);
  if (isReading) {
    if (!Array.isArray(manifest.texts) || manifest.texts.length === 0) {
      throw new TopicImportError("Тема чтения не содержит текстов");
    }
  } else if (!Array.isArray(manifest.cards) || manifest.cards.length === 0) {
    throw new TopicImportError("Тема не содержит карточек");
  }

  if (manifest.meta.minAppVersion && appVersion) {
    if (semver.lt(appVersion, manifest.meta.minAppVersion)) {
      throw new TopicImportError(
        `Обновите приложение до версии ${manifest.meta.minAppVersion}`
      );
    }
  }

  const textIds = (manifest.texts ?? []).map((text) => text.id);
  if (new Set(textIds).size !== textIds.length) {
    throw new TopicImportError("Тексты содержат дублирующиеся id");
  }

  const cardIds = (manifest.cards ?? []).map((c) => c.id);
  if (new Set(cardIds).size !== cardIds.length) {
    throw new TopicImportError("Карточки содержат дублирующиеся id");
  }
}

function validateImages(manifest, zip) {
  const isProcedural = manifest.meta.cardType === "procedural" || !!manifest.meta.renderer;
  for (const card of manifest.cards ?? []) {
    if (isProcedural && card.renderer) continue;
    if (card.image && !zip.file(card.image)) {
      throw new TopicImportError(`Файл не найден в ZIP: ${card.image}`);
    }
  }

  for (const path of collectReadingAssetPaths(manifest.texts ?? [])) {
    if (!zip.file(path)) {
      throw new TopicImportError(`Файл не найден в ZIP: ${path}`);
    }
  }
}

function collectReadingAssetPaths(texts) {
  const paths = [];
  for (const text of texts) {
    if (text.image) paths.push(text.image);
    for (const line of text.lines ?? []) {
      if (line.image) paths.push(line.image);
      for (const pictogram of line.pictograms ?? []) {
        if (pictogram.image) paths.push(pictogram.image);
      }
    }
    for (const question of text.questions ?? []) {
      if (question.image) paths.push(question.image);
    }
  }
  return paths;
}

const RENDERER_MAP = {
  math_comparison_numbers: "comparison",
  math_comparison_objects: "comparison",
  math_houses:             "math_houses",
  addition_subtraction:    "addition_subtraction",
};

const DEFAULT_FLASHCARD_MODES = [
  {
    id: "intro", type: "intro", evaluation: "none",
    ui: { title: "Знакомство", instruction: "Нажмите чтобы продолжить", icon: "media/icons/flashcards_intro.svg" },
  },
  {
    id: "find_n", type: "find_n", evaluation: "auto",
    ui: { title: "Найди картинку", instruction: "Нажми на нужную картинку", icon: "media/icons/flashcards_find_n.svg" },
    params: {
      optionCount:    { type: "enum",   label: { ru: "Вариантов" },             values: [2, 4, 6], default: 4 },
      repsPerConcept: { type: "number", label: { ru: "Повторений на понятие" }, default: 1, min: 1, max: 3 },
    },
  },
  {
    id: "yes_no", type: "yes_no", evaluation: "auto",
    ui: { title: "Да / Нет", instruction: "Правильное ли слово?", icon: "media/icons/flashcards_yes_no.svg" },
    params: {
      repsPerConcept: { type: "number", label: { ru: "Повторений на понятие" }, default: 1, min: 1, max: 5 },
    },
  },
  {
    id: "choose_word_by_picture", type: "choose_word_by_picture", evaluation: "auto",
    ui: { title: "Выбери слово", instruction: "Нажми на правильное слово", icon: "media/icons/flashcards_choose_word.svg" },
    params: {
      repsPerConcept: { type: "number", label: { ru: "Повторений на понятие" }, default: 1, min: 1, max: 3 },
      concepts:       { type: "concept_selector" },
    },
  },
  {
    id: "choose_all", type: "choose_all", evaluation: "auto",
    ui: { title: "Выбери все", instruction: "Найди все карточки", icon: "media/icons/flashcards_choose_all.svg" },
    params: {
      optionCount: { type: "enum", label: { ru: "Карточек в сетке" }, values: [2, 4, 6, 9], default: 4 },
    },
  },
];

const CANONICAL_MODE_ORDER = ["intro", "find_n", "yes_no", "choose_word_by_picture", "choose_all", "question_answer"];

function sortModes(modes) {
  return [...modes].sort((a, b) => {
    const ai = CANONICAL_MODE_ORDER.indexOf(a.id);
    const bi = CANONICAL_MODE_ORDER.indexOf(b.id);
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

const QA_PARAMS = {
  useKeyboard: {
    type: "boolean",
    label: { ru: "Использовать клавиатуру" },
    hint:  { ru: "1 — Не ответил  2 — С подсказкой  3 — Правильно  4 — Легко!" },
    default: false,
  },
};

const OPERATION_PARAMS = {
  railSize: {
    type: "enum",
    label: { ru: "Диапазон" },
    values: [10, 20],
    default: 20,
  },
  changeMax: {
    type: "enum",
    label: { ru: "Прибавить/убрать до" },
    values: [1, 2, 3, 5],
    default: 1,
  },
  includeZero: {
    type: "boolean",
    label: { ru: "Включать 0" },
    hint: { ru: "Для первого этапа лучше выключить, чтобы не смешивать знак и понятие нуля." },
    default: false,
  },
};

function buildFlashcardModes(meta, existingModes) {
  const base = existingModes?.length
    ? mergeDefaultModes(existingModes, DEFAULT_FLASHCARD_MODES)
    : DEFAULT_FLASHCARD_MODES;
  const withoutQA = base.filter((m) => m.id !== "question_answer");
  const sorted   = sortModes(withoutQA);
  if (!meta.questionKey) return sorted;
  const existingQA = base.find((m) => m.id === "question_answer");
  const qaMode = existingQA
    ? {
      ...existingQA,
      ui: {
        ...existingQA.ui,
        title: meta.questionKey,
        instruction: meta.questionKey,
        icon: existingQA.ui?.icon ?? "media/icons/flashcards_question_answer.svg",
      },
      params: existingQA.params ?? QA_PARAMS,
    }
    : {
      id: "question_answer",
      type: "question_answer",
      evaluation: "none",
      ui: {
        title: meta.questionKey,
        instruction: meta.questionKey,
        icon: "media/icons/flashcards_question_answer.svg",
      },
      params: QA_PARAMS,
    };
  return [...sorted, qaMode];
}

const DEFAULT_MODES = {
  reading: [
    {
      id: "read_text",
      type: "read_text",
      evaluation: "none",
      ui: {
        title: "Читаем текст",
        instruction: "Читайте вместе с ребёнком",
        icon: "media/icons/reading_read.svg",
      },
      params: {
        supportLevel: {
          type: "enum",
          label: { ru: "Опоры" },
          values: ["all", "key", "none"],
          labels: { ru: { all: "Все", key: "Ключевые", none: "Скрыть" } },
          default: "all",
        },
        layout: {
          type: "enum",
          label: { ru: "Показ" },
          values: ["full", "line"],
          labels: { ru: { full: "Весь текст", line: "По строкам" } },
          default: "full",
        },
      },
    },
    {
      id: "understand_text",
      type: "understand_text",
      evaluation: "none",
      ui: {
        title: "Понимаю текст",
        instruction: "Задайте вопрос и при необходимости покажите фрагмент",
        icon: "media/icons/reading_understand.svg",
      },
    },
    {
      id: "assemble_text",
      type: "assemble_text",
      evaluation: "auto",
      ui: {
        title: "Собираю текст",
        instruction: "Соберите строки из слов",
        icon: "media/icons/reading_assemble.svg",
      },
    },
  ],
  comparison: [
    { id: "compare_sign",         type: "compare_sign",         evaluation: "auto", ui: { title: "Крокодил",      instruction: "Нажми на большее число",                          icon: "media/icons/comparison_sign.svg" } },
    { id: "compare_first_number", type: "compare_first_number", evaluation: "auto", ui: { title: "Первое число",  instruction: "Сравни первое число со вторым и выбери ответ.",    icon: "media/icons/comparison_first_number.svg" } },
    { id: "compare_visual",       type: "compare_visual",       evaluation: "auto", ui: { title: "Сравни и нажми", instruction: "Нажми на сторону, где больше",                   icon: "media/icons/comparison_visual.svg" } },
  ],
  math_houses: [
    { id: "math_houses_read",      type: "math_houses_read",      evaluation: "auto", ui: { title: "Читаю",              instruction: "Собери пример по активному этажу",          icon: "media/icons/math_houses_read.svg" } },
    { id: "math_houses",           type: "math_houses",           evaluation: "auto", ui: { title: "Дополняю",           instruction: "Заполни состав числа по этажам",            icon: "media/icons/math_houses.svg" } },
    { id: "math_houses_recall",    type: "math_houses_recall",    evaluation: "auto", ui: { title: "Вспоминаю",          instruction: "Вспомни обе части числа",                   icon: "media/icons/math_houses_recall.svg" } },
    {
      id: "math_houses_selective",
      type: "math_houses_selective",
      evaluation: "auto",
      ui: {
        title: "Дополняю выборочно",
        instruction: "Найди пропущенные числа слева или справа",
        icon: "media/icons/math_houses_selective.svg",
      },
      params: {
        hiddenWindows: {
          type: "number",
          min: 1,
          max: 6,
          default: 1,
          label: { ru: "Сколько окон прятать" },
        },
        shufflePairs: {
          type: "boolean",
          default: false,
          label: { ru: "Перемешивать пары" },
          hint: { ru: "Не показывать пары подряд по порядку" },
        },
      },
    },
    { id: "math_houses_grow",      type: "math_houses_grow",      evaluation: "auto", ui: { title: "Растущий домик",     instruction: "Вспомни все пары числа",                    icon: "media/icons/math_houses_grow.svg" } },
  ],
  addition_subtraction: [
    {
      id: "operation_action_from_sign",
      type: "operation_action_from_sign",
      evaluation: "auto",
      ui: {
        title: "Знак ↔ действие",
        instruction: "Быстро свяжи знак и действие",
        icon: "media/icons/operations_action_from_sign.svg",
      },
      params: OPERATION_PARAMS,
      methodology: {
        text: "Короткая автоматизация связи в обе стороны: плюс — прибавить, минус — убрать; прибавить — плюс, убрать — минус.",
        tips: ["Без чисел и фишек: только знак и глагол.", "Делайте короткой разминкой перед действиями с фишками."],
        duration: "2-3 минуты",
      },
    },
    {
      id: "operation_do_action",
      type: "operation_do_action",
      evaluation: "auto",
      ui: {
        title: "Сделай действие",
        instruction: "Выполни: прибавь или убери фишки",
        icon: "media/icons/operations_action_from_sign.svg",
      },
      params: OPERATION_PARAMS,
      methodology: {
        text: "После быстрой связки знак-глагол ребенок телесно проживает смысл: прибавить — положить еще, убрать — снять часть.",
        tips: ["Начинайте с изменения на 1 фишку.", "Проговаривайте одну формулу: было, прибавили/убрали, стало."],
        duration: "3-5 минут",
      },
    },
    {
      id: "operation_name_action",
      type: "operation_name_action",
      evaluation: "auto",
      ui: {
        title: "Что сделали?",
        instruction: "Посмотри, как изменились фишки, и назови действие",
        icon: "media/icons/operations_sign_from_action.svg",
      },
      params: OPERATION_PARAMS,
      methodology: {
        text: "Ребенок учится различать само действие до знакомства со знаком: прибавили или убрали.",
        tips: ["Не показывайте знак на этом этапе.", "Если ребенок считает итог, возвращайте вопрос к действию: что сделали?"],
        duration: "3-5 минут",
      },
    },
    {
      id: "operation_more_less",
      type: "operation_more_less",
      evaluation: "auto",
      ui: {
        title: "Больше / меньше",
        instruction: "Определи, стало больше или меньше",
        icon: "media/icons/operations_more_less.svg",
      },
      params: OPERATION_PARAMS,
      methodology: {
        text: "Режим связывает действие с изменением количества: прибавили — стало больше, убрали — стало меньше.",
        tips: ["На этом этапе лучше не показывать пример со знаком.", "Сравнивайте именно было и стало."],
        duration: "4-6 минут",
      },
    },
    {
      id: "operation_sign_from_action",
      type: "operation_sign_from_action",
      evaluation: "auto",
      ui: {
        title: "Действие → знак",
        instruction: "Посмотри, что сделали, и выбери знак",
        icon: "media/icons/operations_sign_from_action.svg",
      },
      params: OPERATION_PARAMS,
      methodology: {
        text: "Первый выход к математическому знаку: прибавили — плюс, убрали — минус. В задании знак заранее не показывается.",
        tips: ["Проговаривайте: прибавили — это плюс, убрали — это минус.", "Не переходите дальше, пока выбор знака не станет спокойным."],
        duration: "3-5 минут",
      },
    },
    {
      id: "operation_build_expression",
      type: "operation_build_expression",
      evaluation: "auto",
      ui: {
        title: "Собери пример",
        instruction: "По истории было-сделали-стало выбери знак",
        icon: "media/icons/operations_missing_sign.svg",
      },
      params: OPERATION_PARAMS,
      methodology: {
        text: "Мост от наглядной истории к записи примера: ребенок видит действие и вставляет знак в выражение.",
        tips: ["Оставляйте фишки видимыми.", "Читайте вслух: было 3, прибавили 1, стало 4."],
        duration: "4-6 минут",
      },
    },
    {
      id: "operation_result",
      type: "operation_result",
      evaluation: "auto",
      ui: {
        title: "Сколько стало?",
        instruction: "Посчитай результат после прибавления или убирания",
        icon: "media/icons/operations_result.svg",
      },
      params: OPERATION_PARAMS,
      methodology: {
        text: "Здесь появляется вычисление. Ребенок уже знает смысл действия и считает итог с опорой на фишки.",
        tips: ["Держите изменение маленьким: 1-2 фишки.", "Если ребенок угадывает знак, вернитесь на один режим назад."],
        duration: "5-7 минут",
      },
    },
    {
      id: "operation_missing_sign",
      type: "operation_missing_sign",
      evaluation: "auto",
      ui: {
        title: "Вставь знак",
        instruction: "Выбери плюс или минус для готового примера",
        icon: "media/icons/operations_missing_sign.svg",
      },
      params: OPERATION_PARAMS,
      methodology: {
        text: "Финальный перенос без наглядной подсказки: по числам было — изменение — стало ребенок выбирает знак операции.",
        tips: ["Используйте после уверенного результата.", "Не смешивайте с большими числами, пока выбор знака не станет спокойным."],
        duration: "5-7 минут",
      },
    },
  ],
};

const DEFAULT_META = {
  flashcards: {
    avatar: "media/avatar_flashcards.svg",
  },
  comparison: {
    avatar: "media/avatar_comparison.svg",
  },
  math_houses: {
    avatar: "media/avatar.svg",
  },
  addition_subtraction: {
    avatar: "media/avatar_operations.svg",
  },
  reading: {
    avatar: "media/avatar_reading.svg",
  },
};

const MODE_ICON_FALLBACKS = {
  flashcards: {
    default: "media/icons/flashcards_mode.svg",
  },
  comparison: {
    default: "media/icons/comparison_mode.svg",
  },
  math_houses: {
    default: "media/icons/math_houses_mode.svg",
  },
  addition_subtraction: {
    default: "media/icons/operations_mode.svg",
  },
  reading: {
    default: "media/icons/reading_mode.svg",
  },
};

function ensureModeIcons(modes = [], renderer) {
  const fallback = MODE_ICON_FALLBACKS[renderer]?.default ?? null;
  if (!fallback) return modes;
  return modes.map((mode) => {
    if (mode.ui?.icon) return mode;
    return {
      ...mode,
      ui: {
        ...(mode.ui ?? {}),
        icon: fallback,
      },
    };
  });
}

function mergeDefaultModes(existingModes = [], defaultModes = []) {
  const existingById = Object.fromEntries(existingModes.map((mode) => [mode.id, mode]));
  const defaultIds = new Set(defaultModes.map((mode) => mode.id));
  const mergedDefaults = defaultModes.map((def) => {
    const existing = existingById[def.id];
    if (!existing) return def;
    return {
      ...def,
      ...existing,
      ui:     { ...(def.ui ?? {}), ...(existing.ui ?? {}) },
      params: { ...(def.params ?? {}), ...(existing.params ?? {}) },
    };
  });
  const customModes = existingModes.filter((mode) => !defaultIds.has(mode.id));
  return [...mergedDefaults, ...customModes];
}

function mergeDefaultMeta(meta, renderer) {
  return {
    ...(DEFAULT_META[renderer] ?? {}),
    ...meta,
  };
}

function normalizeLabel(card) {
  const raw = card.label ?? card.labels;
  if (!raw) return card.answerKey ?? card.id;
  if (typeof raw === "string") return raw;
  return raw.ru ?? raw.en ?? card.answerKey ?? card.id;
}

function normalizeFlashcards(manifest) {
  if (manifest.meta.renderer && manifest.meta.renderer !== "flashcards") return manifest;
  if (manifest.meta.cardType === "procedural") return manifest;

  const meta = mergeDefaultMeta({ ...manifest.meta, renderer: "flashcards" }, "flashcards");

  const cards = manifest.cards.map((card) => ({
    ...card,
    label:     normalizeLabel(card),
    conceptId: card.conceptId ?? card.id,
    primary:   card.primary ?? true,
  }));

  const modes = ensureModeIcons(buildFlashcardModes(manifest.meta, manifest.modes), "flashcards");

  return { ...manifest, meta, cards, modes };
}

function normalizeProcedural(manifest) {
  if (manifest.meta.renderer === "reading") return manifest;
  // Infer meta.renderer from first card's renderer field
  const firstRenderer = manifest.cards[0]?.renderer;
  const renderer = manifest.meta.renderer ?? RENDERER_MAP[firstRenderer] ?? firstRenderer ?? "comparison";

  if (manifest.meta.cardType !== "procedural" && !DEFAULT_MODES[renderer]) return manifest;

  const meta = mergeDefaultMeta({ ...manifest.meta, renderer }, renderer);

  const cards = manifest.cards.map((card) => ({
    ...card,
    conceptId: card.conceptId ?? card.id,
    primary:   card.primary   ?? true,
  }));

  const defaultModes = DEFAULT_MODES[renderer] ?? [];
  const modes = manifest.modes?.length
    ? ensureModeIcons(mergeDefaultModes(manifest.modes, defaultModes), renderer)
    : defaultModes;

  return { ...manifest, meta, cards, modes };
}

function normalizeReading(manifest) {
  if (manifest.meta.renderer !== "reading" && !Array.isArray(manifest.texts)) return manifest;

  const meta = mergeDefaultMeta({ ...manifest.meta, renderer: "reading" }, "reading");
  const cards = Array.isArray(manifest.cards) ? manifest.cards : [];
  const texts = (manifest.texts ?? []).map((text) => ({
    ...text,
    kind: text.kind ?? "prose",
    lines: text.lines ?? [],
    questions: text.questions ?? [],
  }));
  const modes = manifest.modes?.length
    ? ensureModeIcons(mergeDefaultModes(manifest.modes, DEFAULT_MODES.reading), "reading")
    : DEFAULT_MODES.reading;

  return { ...manifest, meta, cards, texts, modes };
}

export async function importTopic(db, zipBuffer, appVersion = "0.0.0") {
  const zip = await JSZip.loadAsync(zipBuffer);

  let manifest = await parseManifest(zip);
  manifest = normalizeReading(manifest);
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
    cards: manifest.cards ?? [],
    texts: manifest.texts ?? undefined,
    installedAt: new Date().toISOString(),
  };

  await kv.set(db, `topic:${topicId}`, record);
  await addToIndex(db, topicId);

  return record;
}

export async function getTopicRecord(db, topicId) {
  return migrateRecord(await kv.get(db, `topic:${topicId}`));
}

function migrateRecord(record) {
  if (!record) return record;
  if (record.meta?.renderer === "reading" || Array.isArray(record.texts)) {
    return normalizeReading({
      ...record,
      meta: { ...record.meta, renderer: "reading" },
      cards: record.cards ?? [],
      texts: record.texts ?? [],
      modes: record.modes ?? [],
    });
  }
  const proceduralRenderer =
    record.meta.renderer
    ?? RENDERER_MAP[record.cards?.[0]?.renderer]
    ?? record.cards?.[0]?.renderer;

  if (proceduralRenderer === "math_houses") {
    const normalizedCards = record.cards.map((card) => ({
      ...card,
      conceptId: card.conceptId ?? card.id,
      primary:   card.primary ?? true,
    }));
    return {
      ...record,
      meta:  mergeDefaultMeta({ ...record.meta, renderer: "math_houses" }, "math_houses"),
      cards: normalizedCards,
      modes: ensureModeIcons(mergeDefaultModes(record.modes ?? [], DEFAULT_MODES.math_houses), "math_houses"),
    };
  }

  if (record.meta.cardType === "procedural") {
    return {
      ...record,
      meta: mergeDefaultMeta({ ...record.meta, renderer: proceduralRenderer }, proceduralRenderer),
      modes: ensureModeIcons(mergeDefaultModes(record.modes ?? [], DEFAULT_MODES[proceduralRenderer] ?? []), proceduralRenderer),
    };
  }

  // Flashcard deck already has renderer set — patch missing modes, fix sort order, backfill params
  if (record.meta.renderer === "flashcards") {
    const existingIds  = new Set(record.modes?.map((m) => m.id) ?? []);
    const missing      = DEFAULT_FLASHCARD_MODES.filter((m) => !existingIds.has(m.id));
    const defaultById  = Object.fromEntries(DEFAULT_FLASHCARD_MODES.map((m) => [m.id, m]));
    const patchedModes = (record.modes ?? []).map((m) => {
      const def = defaultById[m.id];
      if (!def?.params) return m;
      // backfill individual missing param keys (not just the whole params object)
      const missingKeys = Object.keys(def.params).filter((k) => !m.params?.[k]);
      if (missingKeys.length === 0) return m;
      const patch = Object.fromEntries(missingKeys.map((k) => [k, def.params[k]]));
      return { ...m, params: { ...(m.params ?? {}), ...patch } };
    });
    const allModes  = [...patchedModes, ...missing];
    const reordered = buildFlashcardModes(record.meta, allModes);
    const sameOrder = JSON.stringify(reordered.map((m) => m.id)) === JSON.stringify((record.modes ?? []).map((m) => m.id));
    const hadPatches = patchedModes.some((m, i) => m !== (record.modes ?? [])[i]);
    const oldQA = (record.modes ?? []).find((m) => m.id === "question_answer");
    const newQA = reordered.find((m) => m.id === "question_answer");
    const hadQAParamChange = newQA && oldQA && !oldQA.params?.useKeyboard && !!newQA.params?.useKeyboard;
    const withIcons = ensureModeIcons(reordered, "flashcards");
    if (missing.length === 0 && sameOrder && !hadPatches && !hadQAParamChange && record.meta.avatar) {
      const hadAllIcons = (record.modes ?? []).every((mode) => mode.ui?.icon);
      if (hadAllIcons) return record;
    }
    return {
      ...record,
      meta: mergeDefaultMeta({ ...record.meta }, "flashcards"),
      modes: withIcons,
    };
  }

  if (record.meta.renderer) {
    return {
      ...record,
      meta: mergeDefaultMeta({ ...record.meta }, record.meta.renderer),
      modes: ensureModeIcons(mergeDefaultModes(record.modes ?? [], DEFAULT_MODES[record.meta.renderer] ?? []), record.meta.renderer),
    };
  }
  // Old flashcard record without renderer — add defaults at runtime
  return {
    ...record,
    meta: mergeDefaultMeta({ ...record.meta, renderer: "flashcards" }, "flashcards"),
    modes: ensureModeIcons(buildFlashcardModes(record.meta, record.modes), "flashcards"),
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
