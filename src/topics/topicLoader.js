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
  const bytes = await manifestFile.async("uint8array");
  const text  = new TextDecoder("utf-8").decode(bytes);
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


const DEFAULT_TOPIC_ABOUT = {
  flashcards: {
    description: "Лексическая тема для расширения пассивного и активного словаря через карточки, выбор, узнавание и называние.",
    goals: [
      "Познакомить ребёнка с понятиями темы и их зрительными вариантами.",
      "Закрепить понимание слова через выбор правильной картинки.",
      "Перевести понятия в активную речь через называние и ответы на вопрос.",
    ],
    finalGoal: "Ребёнок узнаёт понятия темы в разных вариантах, понимает слово без лишних подсказок и может назвать его в занятии.",
    flow: [
      "Начинайте со знакомства, затем переходите к выбору картинки и проверке Да / Нет.",
      "Для активной речи используйте режим ответа на вопрос после уверенного узнавания.",
    ],
  },
  reading: {
    description: "Тема чтения помогает пройти текст по ступеням: совместное чтение, понимание смысла и восстановление текста.",
    goals: [
      "Снизить нагрузку при чтении за счёт опор и пошагового показа.",
      "Проверить понимание текста через вопросы и возврат к фрагменту.",
      "Закрепить последовательность текста через сборку строк или слов.",
    ],
    finalGoal: "Ребёнок читает или повторяет текст осмысленно, отвечает на вопросы по содержанию и удерживает порядок фрагментов.",
    flow: [
      "Сначала читайте текст вместе с доступными опорами.",
      "Затем задавайте вопросы по смыслу и только после этого переходите к сборке.",
    ],
  },
  comparison: {
    description: "Педагогическая лестница сравнения: от зрительного различения больше/меньше к осознанному использованию знаков < = >.",
    goals: [
      "Сформировать понимание отношений больше, меньше и равно.",
      "Связать количество, число и направление знака.",
      "Научить ребёнка самостоятельно выбирать или рисовать знак сравнения.",
    ],
    finalGoal: "Ребёнок спокойно сравнивает пары чисел или количеств и выбирает знак по смыслу, а не по угадыванию.",
    flow: [
      "Идите по режимам сверху вниз: без знака, образ знака, рисование, самостоятельная оценка.",
      "Повышайте уровень только после устойчивых ответов на текущей ступени.",
    ],
  },
  math_houses: {
    description: "Тема тренирует состав числа через домики: ребёнок видит целое число и подбирает пары частей.",
    goals: [
      "Показать число как сумму двух частей.",
      "Закрепить пары состава числа от простых к более сложным.",
      "Развить гибкость: находить недостающую часть без механического пересчёта.",
    ],
    finalGoal: "Ребёнок уверенно дополняет пары состава числа и переносит этот навык в сложение и вычитание.",
    flow: [
      "Начинайте с небольших чисел и проговаривайте целое и части.",
      "Переходите к растущему домику, когда ребёнок удерживает несколько пар подряд.",
    ],
  },
  addition_subtraction: {
    description: "Педагогическая лестница для понимания плюса и минуса: действие с фишками, изменение количества, знак, пример и результат.",
    goals: [
      "Связать плюс с действием прибавить, а минус с действием убрать.",
      "Показать изменение было-стало на наглядной модели.",
      "Подвести ребёнка к записи примера и вычислению результата.",
    ],
    finalGoal: "Ребёнок понимает смысл действия, выбирает правильный знак и считает результат с опорой или без неё.",
    flow: [
      "Начинайте со связи знак-действие и действий с фишками.",
      "Переходите к примеру и результату только после уверенного понимания было-сделали-стало.",
    ],
  },
  sentence_puzzle: {
    description: "Тема развивает фразовую речь: ребёнок собирает предложение из ролей кто, что делает, какой и что.",
    goals: [
      "Сформировать структуру простого и распространённого предложения.",
      "Закрепить порядок слов и грамматические связи.",
      "Развить слуховое удержание фразы через сборку после прослушивания.",
    ],
    finalGoal: "Ребёнок собирает осмысленное предложение и переносит структуру в самостоятельную речь.",
    flow: [
      "Сначала собирайте предложение по видимым карточкам и проговаривайте роли.",
      "Затем переходите к режиму слушания, где нужно удержать фразу и собрать её по памяти.",
    ],
  },
};

const DEFAULT_MODE_METHODOLOGY = {
  flashcards: {
    intro: {
      summary: "Первое знакомство с карточками темы.",
      text: "Логопед показывает карточку, произносит слово и помогает ребёнку связать изображение со звучанием.",
      settings: ["Без оценки и дополнительных настроек: темп задаёт специалист."],
      goal: "Ребёнок узнаёт новые понятия и спокойно реагирует на материал темы.",
      tips: ["Просите ребёнка показать, повторить или выбрать жестом, если называние пока недоступно."],
    },
    find_n: {
      summary: "Проверка понимания слова через выбор картинки.",
      text: "Ребёнок слышит или видит задание и выбирает нужную карточку среди вариантов.",
      goal: "Ребёнок находит понятие по слову без случайного перебора вариантов.",
    },
    yes_no: {
      summary: "Быстрое различение правильного и неправильного называния.",
      text: "Ребёнок сравнивает картинку и слово, затем отвечает, совпадают ли они.",
      goal: "Ребёнок замечает несоответствие картинки и слова и удерживает значение понятия.",
    },
    choose_word_by_picture: {
      summary: "Переход от картинки к письменному или устному слову.",
      text: "Ребёнок смотрит на изображение и выбирает правильное слово из вариантов.",
      goal: "Ребёнок связывает изображение с названием и начинает работать без опоры на подсказку специалиста.",
    },
    choose_all: {
      summary: "Обобщение понятия на нескольких карточках.",
      text: "Ребёнок выбирает все карточки, которые относятся к заданному понятию.",
      goal: "Ребёнок узнаёт понятие в разных вариантах и не привязывается к одной картинке.",
    },
    question_answer: {
      summary: "Активный ответ на вопрос по карточке.",
      text: "Специалист задаёт вопрос, а ребёнок отвечает устно или с подсказкой.",
      settings: ["Клавиатура оценок: можно фиксировать качество ответа от «не ответил» до «легко»."],
      goal: "Ребёнок использует слово темы в активной речи или в функциональном ответе.",
    },
  },
  reading: {
    read_text: {
      summary: "Совместное чтение текста с регулируемыми опорами.",
      text: "Специалист читает вместе с ребёнком, выбирая объём зрительных опор и способ показа текста.",
      goal: "Ребёнок проходит текст осмысленно и удерживает строку или весь фрагмент без перегрузки.",
    },
    understand_text: {
      summary: "Вопросы по смыслу с возвратом к фрагменту текста.",
      text: "Специалист задаёт вопросы и при необходимости показывает строку, где есть ответ.",
      settings: ["Без дополнительных настроек: вопросы берутся из выбранного текста."],
      goal: "Ребёнок отвечает по содержанию, а не просто повторяет прочитанные слова.",
    },
    assemble_text: {
      summary: "Сборка текста из слов или строк.",
      text: "Ребёнок восстанавливает порядок слов и строк, опираясь на смысл и память о прочитанном.",
      settings: ["Режим доступен для стихотворений, где порядок строк и слов важен для запоминания."],
      goal: "Ребёнок удерживает структуру текста и восстанавливает её без прямого чтения по образцу.",
    },
  },
  comparison: {
    compare_visual: {
      settings: [
        "Уровень задаёт диапазон и разницу чисел.",
        "Вид определяет опору: точки, точки с цифрой или только цифры.",
        "Можно включить одинаковые количества, когда больше/меньше уже освоены.",
      ],
      goal: "Ребёнок зрительно различает больше, меньше и равно без опоры на знак сравнения.",
    },
    compare_sign: {
      settings: [
        "Уровень задаёт сложность чисел.",
        "Что учим выбирает направление: больше, меньше или микс.",
      ],
      goal: "Ребёнок связывает знак с большим числом и понимает направление раскрытия знака.",
    },
    compare_draw_sign: {
      settings: [
        "Уровень задаёт сложность чисел.",
        "Что учим выбирает, какой тип сравнения закреплять.",
      ],
      goal: "Ребёнок не только выбирает, но и моторно воспроизводит правильный знак сравнения.",
    },
    compare_evaluate: {
      settings: [
        "Что учим задаёт фокус: больше, меньше, микс или оценка первого числа.",
        "Тип ответа переключает символы < = > и словесные ответы.",
        "Количество примеров на экране повышает нагрузку на внимание.",
      ],
      goal: "Ребёнок самостоятельно оценивает пару чисел и выбирает знак или словесное отношение.",
    },
  },
  math_houses: {
    math_houses_practice: {
      summary: "Отработка состава одного числа в домике.",
      text: "Ребёнок подбирает недостающую часть пары и видит, как две части дают целое число.",
      settings: ["Понятия выбираются на экране отбора: можно оставить только нужные числа."],
      goal: "Ребёнок понимает состав выбранного числа и находит недостающую часть пары.",
    },
    math_houses_grow: {
      summary: "Постепенное заполнение всех пар числа.",
      text: "Ребёнок вспоминает пары состава числа в последовательности и удерживает несколько ответов подряд.",
      settings: ["Понятия выбираются на экране отбора: используйте только числа, которые сейчас отрабатываются."],
      goal: "Ребёнок перечисляет пары состава числа без постоянной зрительной подсказки.",
    },
  },
  addition_subtraction: {
    operation_observe: {
      settings: [],
      goal: "Ребёнок наблюдает за действием и формирует зрительный образ прибавления и убирания.",
    },
    operation_name_action: {
      settings: [],
      goal: "Ребёнок называет действие — прибавили или убрали — опираясь на изменение количества.",
    },
    operation_do_action: {
      settings: ["Начинайте с изменения на 1 фишку при диапазоне до 5.", "Ноль включайте только после уверенного действия с фишками."],
      goal: "Ребёнок выполняет действие с фишками на палке и понимает телесный смысл прибавления и вычитания.",
    },
    operation_action_from_sign: {
      settings: ["Направление «Чередование» — основной режим; «Знак → Слово» проще, вводите первым."],
      goal: "Ребёнок быстро связывает плюс с «прибавить» и минус с «убрать» в обе стороны.",
    },
    operation_find_sign: {
      settings: ["Счётный помощник (🧮) доступен ребёнку по его желанию, если включён специалистом."],
      goal: "Ребёнок определяет знак операции по первому и последнему числу в примере.",
    },
    operation_result: {
      settings: ["Начинайте с вариантов ответа; клавиатуру вводите после уверенного освоения.", "Таймер используйте только на этапе закрепления."],
      goal: "Ребёнок вычисляет результат полного примера.",
    },
    operation_chain: {
      settings: ["Начинайте с maxNumber=10 и изменения на 1.", "Счётный помощник помогает удержать промежуточный результат."],
      goal: "Ребёнок считает пример из двух последовательных действий (A ± B ± C).",
    },
  },
  sentence_puzzle: {
    sentence_puzzle: {
      summary: "Сборка предложения по видимым словам.",
      text: "Ребёнок выбирает карточки ролей и собирает фразу в правильном порядке.",
      goal: "Ребёнок понимает структуру предложения и строит фразу кто + что делает, при необходимости с дополнениями.",
    },
    listen_build: {
      summary: "Сборка предложения после прослушивания.",
      text: "Ребёнок слушает фразу, удерживает её в памяти и собирает из карточек с лишними словами.",
      goal: "Ребёнок удерживает услышанное предложение и восстанавливает его структуру без зрительного образца.",
    },
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
    { id: "compare_visual",    type: "compare_visual",    evaluation: "auto", ui: { title: "1. Сравни и нажми. Без знака", instruction: "Нажми на сторону, где больше",       icon: "media/icons/comparison_visual.svg" } },
    { id: "compare_sign",      type: "compare_sign",      evaluation: "auto", ui: { title: "2. Вводим знак — Крокодил",   instruction: "Нажми на большее число",              icon: "media/icons/comparison_sign.svg" } },
    { id: "compare_draw_sign", type: "compare_draw_sign", evaluation: "auto", ui: { title: "3. Нарисуй знак",             instruction: "Нарисуй правильный знак пальцем",     icon: "media/icons/comparison_mode.svg" } },
    { id: "compare_evaluate",  type: "compare_evaluate",  evaluation: "auto", ui: { title: "4. Оцени и поставь знак",     instruction: "Поставь или выбери правильный знак",  icon: "media/icons/comparison_first_number.svg" } },
  ],
  math_houses: [
    { id: "math_houses_practice",  type: "math_houses_practice",  evaluation: "auto", ui: { title: "Домик",              instruction: "Работай с домиком числа",                   icon: "media/icons/math_houses.svg" } },
    { id: "math_houses_grow",      type: "math_houses_grow",      evaluation: "auto", ui: { title: "Растущий домик",     instruction: "Вспомни все пары числа",                    icon: "media/icons/math_houses_grow.svg" } },
  ],
  addition_subtraction: [
    {
      id: "operation_observe",
      type: "operation_observe",
      evaluation: "auto",
      ui: { title: "1. Наблюдение (скоро)", instruction: "Смотрим, как меняется количество", icon: "media/icons/operations_mode.svg" },
    },
    {
      id: "operation_name_action",
      type: "operation_name_action",
      evaluation: "auto",
      ui: { title: "2. Назови действие (скоро)", instruction: "Что сделали с предметами?", icon: "media/icons/operations_mode.svg" },
    },
    {
      id: "operation_do_action",
      type: "operation_do_action",
      evaluation: "auto",
      ui: { title: "3. Сделай действие", instruction: "Покажи на палке и назови результат", icon: "media/icons/operations_action_from_sign.svg" },
      params: {
        maxNumber: { type: "number", min: 3, max: 20, default: 5, label: { ru: "Максимальное число" } },
        changeMax: { type: "number", min: 1, max: 10, default: 1, label: { ru: "Максимальное изменение" } },
        includeZero: { type: "boolean", default: false, label: { ru: "Включить ноль" } },
      },
    },
    {
      id: "operation_action_from_sign",
      type: "operation_action_from_sign",
      evaluation: "auto",
      ui: { title: "4. Знак ↔ Действие", instruction: "Связываем знак со словом действия", icon: "media/icons/operations_action_from_sign.svg" },
      params: {
        direction: {
          type: "enum",
          values: ["alternating", "sign_to_action", "action_to_sign", "random"],
          labels: { ru: { alternating: "Чередование", sign_to_action: "Знак → Слово", action_to_sign: "Слово → Знак", random: "Случайно" } },
          default: "alternating",
          label: { ru: "Направление" },
        },
      },
    },
    {
      id: "operation_find_sign",
      type: "operation_find_sign",
      evaluation: "auto",
      ui: { title: "5. Найди знак", instruction: "Какой знак пропущен в примере?", icon: "media/icons/operations_sign_from_action.svg" },
      params: {
        maxNumber: { type: "number", min: 3, max: 20, default: 5, label: { ru: "Максимальное число" } },
        changeMax: { type: "number", min: 1, max: 10, default: 2, label: { ru: "Максимальное изменение" } },
        includeZero: { type: "boolean", default: false, label: { ru: "Включить ноль" } },
        showHelper: { type: "boolean", default: false, label: { ru: "Кнопка счётного помощника" } },
      },
    },
    {
      id: "operation_result",
      type: "operation_result",
      evaluation: "auto",
      ui: { title: "6. Сколько стало?", instruction: "Вычисли результат примера", icon: "media/icons/operations_result.svg" },
      params: {
        maxNumber: { type: "number", min: 3, max: 20, default: 5, label: { ru: "Максимальное число" } },
        changeMax: { type: "number", min: 1, max: 10, default: 2, label: { ru: "Максимальное изменение" } },
        includeZero: { type: "boolean", default: false, label: { ru: "Включить ноль" } },
        inputMode: {
          type: "enum",
          values: ["choices", "pad"],
          labels: { ru: { choices: "Варианты ответа", pad: "Числовая клавиатура" } },
          default: "choices",
          label: { ru: "Тип ввода" },
        },
        timer: { type: "number", min: 0, max: 60, default: 0, label: { ru: "Таймер (сек, 0 = выкл)" } },
        showHelper: { type: "boolean", default: false, label: { ru: "Кнопка счётного помощника" } },
      },
    },
    {
      id: "operation_chain",
      type: "operation_chain",
      evaluation: "auto",
      ui: { title: "7. Цепочка", instruction: "Посчитай пример из двух действий", icon: "media/icons/operations_missing_sign.svg" },
      params: {
        maxNumber: { type: "number", min: 5, max: 20, default: 10, label: { ru: "Максимальное число" } },
        changeMax: { type: "number", min: 1, max: 5, default: 2, label: { ru: "Максимальное изменение" } },
        includeZero: { type: "boolean", default: false, label: { ru: "Включить ноль" } },
        inputMode: {
          type: "enum",
          values: ["choices", "pad"],
          labels: { ru: { choices: "Варианты ответа", pad: "Числовая клавиатура" } },
          default: "choices",
          label: { ru: "Тип ввода" },
        },
        timer: { type: "number", min: 0, max: 60, default: 0, label: { ru: "Таймер (сек, 0 = выкл)" } },
        showHelper: { type: "boolean", default: false, label: { ru: "Кнопка счётного помощника" } },
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
  sentence_puzzle: {
    avatar: "media/avatar_sentence_puzzle.svg",
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
  sentence_puzzle: {
    default: "media/icons/sentence_puzzle_mode.svg",
  },
};

function normalizeTextValue(value, fallback = "") {
  if (value == null) return fallback;
  if (Array.isArray(value)) {
    const lines = value.map((item) => normalizeTextValue(item, "")).filter(Boolean);
    return lines.length ? lines.join("\n") : fallback;
  }
  if (typeof value === "string") return value;
  if (typeof value === "object") return normalizeTextValue(value.ru ?? value.en, fallback);
  return String(value);
}

function normalizeTextList(value, fallback = []) {
  if (value == null) return fallback;
  if (Array.isArray(value)) {
    const out = value.map((item) => normalizeTextValue(item, "")).filter(Boolean);
    return out.length ? out : fallback;
  }
  const single = normalizeTextValue(value, "");
  return single ? [single] : fallback;
}

function getParamValueLabel(def, value) {
  const labels = def?.labels?.ru ?? def?.labels ?? {};
  return normalizeTextValue(labels?.[value], String(value));
}

function describeModeParams(params = {}) {
  const rows = Object.entries(params).map(([key, def]) => {
    const label = normalizeTextValue(def?.label, key);
    const hint = normalizeTextValue(def?.hint, "");

    if (def?.type === "concept_selector") {
      return `${label || "Понятия"}: выберите карточки или понятия, которые нужны именно для этого занятия.`;
    }

    if (def?.type === "enum") {
      const values = (def.values ?? []).map((value) => getParamValueLabel(def, value)).join(" / ");
      const defaultText = def.default != null ? ` По умолчанию: ${getParamValueLabel(def, def.default)}.` : "";
      return `${label}: ${values || "варианты выбираются на экране настроек"}.${defaultText}${hint ? ` ${hint}` : ""}`;
    }

    if (def?.type === "number") {
      const range = [def.min, def.max].filter((value) => value != null).join("-");
      const defaultText = def.default != null ? ` По умолчанию: ${def.default}.` : "";
      return `${label}: ${range ? `диапазон ${range}` : "числовая настройка"}.${defaultText}${hint ? ` ${hint}` : ""}`;
    }

    if (def?.type === "boolean") {
      const defaultText = def.default != null ? ` По умолчанию: ${def.default ? "включено" : "выключено"}.` : "";
      return `${label}: включить или выключить.${defaultText}${hint ? ` ${hint}` : ""}`;
    }

    return `${label}: настройка режима.`;
  }).filter(Boolean);

  return rows.length
    ? rows
    : ["Дополнительных настроек нет: логопед работает в базовом сценарии режима."];
}

function getFallbackModeGoal(mode) {
  const title = normalizeTextValue(mode?.ui?.title, "режим");
  return `Ребёнок выполняет режим «${title}» стабильно и переносит навык в занятие без лишних подсказок.`;
}

function normalizeModeMethodology(mode, renderer) {
  const defaults = DEFAULT_MODE_METHODOLOGY[renderer]?.[mode.id] ?? {};
  const raw = { ...defaults, ...(mode.methodology ?? {}) };
  const text = normalizeTextValue(raw.text ?? raw.description ?? mode.ui?.instruction, "");
  const summary = normalizeTextValue(raw.summary, text || normalizeTextValue(mode.ui?.instruction, ""));
  const settings = normalizeTextList(raw.settings, describeModeParams(mode.params));
  const goal = normalizeTextValue(raw.goal ?? raw.finalGoal, getFallbackModeGoal(mode));
  const tips = normalizeTextList(raw.tips, []);
  const duration = normalizeTextValue(raw.duration, "");

  return {
    ...raw,
    text,
    summary,
    settings,
    goal,
    tips,
    duration,
  };
}

function normalizeTopicAbout(about, renderer) {
  const defaults = DEFAULT_TOPIC_ABOUT[renderer] ?? DEFAULT_TOPIC_ABOUT.flashcards;
  const aboutObject = about && typeof about === "object" && !Array.isArray(about) ? about : {};
  const legacyLines = normalizeTextList(
    Array.isArray(about) ? about : (aboutObject.ru ?? aboutObject.en),
    []
  );
  const raw = { ...defaults, ...aboutObject };
  const description = normalizeTextValue(raw.description ?? raw.text, legacyLines[0] ?? defaults.description);
  const goals = normalizeTextList(raw.goals, defaults.goals ?? []);
  const finalGoal = normalizeTextValue(raw.finalGoal ?? raw.goal, defaults.finalGoal);
  const flowFallback = legacyLines.length > 1 ? legacyLines.slice(1) : defaults.flow ?? [];
  const flow = normalizeTextList(raw.flow ?? raw.tips, flowFallback);
  const duration = normalizeTextValue(raw.duration, "");

  return {
    ...raw,
    description,
    text: normalizeTextValue(raw.text, description),
    goals,
    finalGoal,
    flow,
    duration,
  };
}

function normalizeModeText(mode, renderer) {
  const ui = mode.ui ?? {};
  const withUi = {
    ...mode,
    ui: {
      ...ui,
      title: normalizeTextValue(ui.title, mode.id),
      instruction: normalizeTextValue(ui.instruction, ""),
    },
  };

  return {
    ...withUi,
    methodology: normalizeModeMethodology(withUi, renderer),
  };
}

function ensureModeIcons(modes = [], renderer) {
  const normalizedModes = modes.map((mode) => normalizeModeText(mode, renderer));
  const fallback = MODE_ICON_FALLBACKS[renderer]?.default ?? null;
  if (!fallback) return normalizedModes;
  return normalizedModes.map((mode) => {
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
      methodology: { ...(def.methodology ?? {}), ...(existing.methodology ?? {}) },
    };
  });
  const customModes = existingModes.filter((mode) => !defaultIds.has(mode.id));
  return [...mergedDefaults, ...customModes];
}

// Preserves manifest mode order; only appends default modes absent from manifest
function mergeDefaultModesKeepOrder(manifestModes = [], defaultModes = []) {
  const defaultById = Object.fromEntries(defaultModes.map((m) => [m.id, m]));
  const manifestIds = new Set(manifestModes.map((m) => m.id));
  const merged = manifestModes.map((mode) => {
    const def = defaultById[mode.id];
    if (!def) return mode;
    return {
      ...def,
      ...mode,
      ui:     { ...(def.ui ?? {}), ...(mode.ui ?? {}) },
      params: { ...(def.params ?? {}), ...(mode.params ?? {}) },
      methodology: { ...(def.methodology ?? {}), ...(mode.methodology ?? {}) },
    };
  });
  const missing = defaultModes.filter((m) => !manifestIds.has(m.id));
  return [...merged, ...missing];
}

function mergeDefaultMeta(meta, renderer) {
  const merged = {
    ...(DEFAULT_META[renderer] ?? {}),
    ...meta,
  };
  return {
    ...merged,
    about: normalizeTopicAbout(merged.about, renderer),
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
  const firstRenderer = manifest.cards?.[0]?.renderer;
  const renderer = manifest.meta.renderer ?? RENDERER_MAP[firstRenderer] ?? firstRenderer ?? "comparison";
  const knownRenderer =
    !!DEFAULT_MODES[renderer]
    || !!DEFAULT_META[renderer]
    || !!DEFAULT_MODE_METHODOLOGY[renderer]
    || !!MODE_ICON_FALLBACKS[renderer];

  if (manifest.meta.cardType !== "procedural" && !knownRenderer) return manifest;

  const meta = mergeDefaultMeta({ ...manifest.meta, renderer }, renderer);

  const cards = (manifest.cards ?? []).map((card) => ({
    ...card,
    conceptId: card.conceptId ?? card.id,
    primary:   card.primary   ?? true,
  }));

  const defaultModes = DEFAULT_MODES[renderer] ?? [];
  const modes = manifest.modes?.length
    ? ensureModeIcons(mergeDefaultModesKeepOrder(manifest.modes, defaultModes), renderer)
    : ensureModeIcons(defaultModes, renderer);

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
    : ensureModeIcons(DEFAULT_MODES.reading, "reading");

  return { ...manifest, meta, cards, texts, modes };
}

function inferMimeType(filename) {
  if (filename.endsWith(".svg"))  return "image/svg+xml";
  if (filename.endsWith(".png"))  return "image/png";
  if (filename.endsWith(".jpg") || filename.endsWith(".jpeg")) return "image/jpeg";
  if (filename.endsWith(".webp")) return "image/webp";
  if (filename.endsWith(".mp3"))  return "audio/mpeg";
  if (filename.endsWith(".wav"))  return "audio/wav";
  if (filename.endsWith(".ogg"))  return "audio/ogg";
  return "application/octet-stream";
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
    const raw = await zip.files[filename].async("blob");
    const mime = raw.type || inferMimeType(filename);
    const blob = mime !== raw.type ? new Blob([raw], { type: mime }) : raw;
    await topics.saveFile(db, topicId, filename, blob);
  }

  const record = {
    id: topicId,
    meta: manifest.meta,
    modes: manifest.modes ?? [],
    cards: manifest.cards ?? [],
    texts: manifest.texts ?? undefined,
    sentences: manifest.sentences?.length ? manifest.sentences : undefined,
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
      modes: ensureModeIcons(mergeDefaultModesKeepOrder(record.modes ?? [], DEFAULT_MODES.math_houses), "math_houses"),
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
    const defaultModes = DEFAULT_MODES[record.meta.renderer] ?? [];
    let merged = mergeDefaultModesKeepOrder(record.modes ?? [], defaultModes);
    if (record.meta.renderer === "comparison") {
      const hasEvaluate = merged.some((m) => m.id === "compare_evaluate");
      if (hasEvaluate) {
        merged = merged.filter((m) => m.id !== "compare_first_number" && m.id !== "compare_put_sign");
      }
    }
    return {
      ...record,
      meta: mergeDefaultMeta({ ...record.meta }, record.meta.renderer),
      modes: ensureModeIcons(merged, record.meta.renderer),
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
