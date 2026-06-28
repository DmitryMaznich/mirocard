import JSZip from "jszip";
import { writeFileSync } from "node:fs";

const avatarSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240">
  <circle cx="120" cy="120" r="116" fill="#eef4ff" stroke="#c4d8f8" stroke-width="3"/>
  <circle cx="120" cy="66" r="22" fill="#f5c896"/>
  <rect x="106" y="90" width="28" height="50" rx="8" fill="#4a7fd4"/>
  <line x1="106" y1="100" x2="72" y2="64" stroke="#f5c896" stroke-width="14" stroke-linecap="round"/>
  <line x1="134" y1="100" x2="156" y2="136" stroke="#f5c896" stroke-width="14" stroke-linecap="round"/>
  <line x1="114" y1="140" x2="102" y2="190" stroke="#2d5ca8" stroke-width="14" stroke-linecap="round"/>
  <line x1="126" y1="140" x2="138" y2="190" stroke="#2d5ca8" stroke-width="14" stroke-linecap="round"/>
  <circle cx="68" cy="60" r="10" fill="#f5c896"/>
</svg>`;

// group "basic"  — знакомые действия без право/лево
// group "spatial" — пространственная ориентация (право/лево)
const SENTENCES = [
  // ── BASIC: Руки ──────────────────────────────────────────────
  { group: "basic",   text: "Хлопни в ладоши два раза." },
  { group: "basic",   text: "Хлопни в ладоши три раза." },
  { group: "basic",   text: "Хлопни в ладоши четыре раза.", therapist: true },
  { group: "basic",   text: "Подними обе руки вверх и потянись." },
  { group: "basic",   text: "Подними обе руки и посчитай до трёх.", therapist: true },
  { group: "basic",   text: "Скрести руки на груди." },
  { group: "basic",   text: "Положи обе руки на колени." },
  { group: "basic",   text: "Сожми руки в кулаки и медленно разожми." },

  // ── BASIC: Тело ──────────────────────────────────────────────
  { group: "basic",   text: "Встань прямо и опусти руки вниз." },
  { group: "basic",   text: "Встань со стула и попрыгай на месте.", therapist: true },
  { group: "basic",   text: "Встань, хлопни один раз и сядь." },
  { group: "basic",   text: "Сядь ровно и положи руки на стол." },

  // ── BASIC: Голова ────────────────────────────────────────────
  { group: "basic",   text: "Кивни головой три раза." },
  { group: "basic",   text: "Покачай головой: нет-нет-нет." },
  { group: "basic",   text: "Закрой глаза и посчитай до трёх." },
  { group: "basic",   text: "Закрой рот и подержи так три секунды." },

  // ── BASIC: Общение ───────────────────────────────────────────
  { group: "basic",   text: "Обними папу.", therapist: true },
  { group: "basic",   text: "Дай пять.", therapist: true },
  { group: "basic",   text: "Скажи «до свидания» и помаши рукой." },
  { group: "basic",   text: "Попроси планшет.", therapist: true },
  { group: "basic",   text: "Выпей стакан воды.", therapist: true },

  // ── BASIC: Речь ──────────────────────────────────────────────
  { group: "basic",   text: "Скажи своё имя громко." },
  { group: "basic",   text: "Скажи своё имя тихо." },
  { group: "basic",   text: "Назови три цвета." },
  { group: "basic",   text: "Назови три животных." },
  { group: "basic",   text: "Назови буквы, которые помнишь.", therapist: true },

  // ── BASIC: Пространство вокруг (от логопеда) ─────────────────
  { group: "basic",   text: "Расскажи, что у тебя находится справа.", therapist: true },
  { group: "basic",   text: "Расскажи, что у тебя находится слева.", therapist: true },
  { group: "basic",   text: "Положи карандаш справа от коробки и скажи, где он лежит.", therapist: true },
  { group: "basic",   text: "Положи карандаш слева от коробки и скажи, где он лежит.", therapist: true },
  { group: "basic",   text: "Положи карандаш в коробку и скажи, где он лежит.", therapist: true },

  // ── SPATIAL: Тело — сторона ──────────────────────────────────
  { group: "spatial", text: "Подними правую руку вверх." },
  { group: "spatial", text: "Подними левую руку вверх." },
  { group: "spatial", text: "Топни правой ногой два раза." },
  { group: "spatial", text: "Топни левой ногой три раза." },
  { group: "spatial", text: "Повернись на стуле направо." },
  { group: "spatial", text: "Повернись на стуле налево." },
  { group: "spatial", text: "Наклони голову вправо, потом влево." },

  // ── SPATIAL: Перекрёстная схема тела ─────────────────────────
  { group: "spatial", text: "Дотронься правой рукой до левого уха." },
  { group: "spatial", text: "Дотронься левой рукой до правого плеча." },
];

const manifest = {
  meta: {
    id: "reading_dad_instructions",
    version: "1.0.4",
    minAppVersion: "1.0.2",
    language: "ru",
    renderer: "reading",
    avatar: "media/avatar.svg",
    title: { ru: "Чтение. Инструкции", en: "Reading: Instructions" },
    description: {
      ru: "Читаем предложение и выполняем задание.",
      en: "Read the sentence and follow the instruction.",
    },
    about: {
      ru: [
        "Тема предназначена для работы логопеда с ребёнком.",
        "Каждый день — новый набор из 10 предложений.",
        "Ребёнок читает предложение, отвечает на вопрос «что ты должен сделать?» и выполняет действие.",
      ],
      en: ["Designed for therapist-led sessions."],
    },
    conceptCount: 10,
    sessionConfig: { maxSize: 10 },
  },
  modes: [
    {
      id: "daily_sentences",
      type: "daily_sentences",
      group: "basic",
      ui: {
        title: { ru: "Читаем и выполняем", en: "Read and do" },
        instruction: { ru: "Прочитай предложение и выполни задание", en: "Read and follow the instruction" },
      },
    },
    {
      id: "daily_sentences_spatial",
      type: "daily_sentences",
      group: "spatial",
      ui: {
        title: { ru: "Право и лево", en: "Left and right" },
        instruction: { ru: "Прочитай инструкцию и выполни — определи, где право и лево", en: "Read and follow the spatial instruction" },
      },
    },
  ],
  cards: [],
  texts: [
    {
      id: "pool",
      kind: "sentence_pool",
      dailySize: 10,
      title: { ru: "Ежедневные инструкции", en: "Daily Instructions" },
      lines: SENTENCES.map((s, i) => ({ id: `s${i + 1}`, group: s.group, text: s.text, ...(s.therapist ? { therapist: true } : {}) })),
    },
  ],
};

const zip = new JSZip();
zip.file("topic.json", JSON.stringify(manifest, null, 2));
zip.file("media/avatar.svg", avatarSvg);
const buffer = await zip.generateAsync({ type: "nodebuffer" });
writeFileSync("public/decks/reading_dad_instructions_v1.0.4.zip", buffer);
const basic = SENTENCES.filter((s) => s.group === "basic").length;
const spatial = SENTENCES.filter((s) => s.group === "spatial").length;
console.log(`✓ reading_dad_instructions_v1.0.4.zip (${buffer.length} bytes, ${basic} basic + ${spatial} spatial)`);
