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

const SENTENCES = [
  "Подними правую руку вверх.",
  "Подними левую руку вверх.",
  "Хлопни в ладоши два раза.",
  "Хлопни в ладоши три раза.",
  "Топни правой ногой два раза.",
  "Топни левой ногой три раза.",
  "Дотронься правой рукой до левого уха.",
  "Дотронься левой рукой до правого плеча.",
  "Положи обе руки на колени.",
  "Скрести руки на груди.",
  "Потяни обе руки вверх и потянись.",
  "Кивни головой три раза.",
  "Покачай головой: нет-нет-нет.",
  "Закрой глаза и посчитай до трёх.",
  "Встань, хлопни один раз и сядь.",
  "Возьми карандаш и нарисуй круг.",
  "Возьми синий карандаш и нарисуй квадрат.",
  "Возьми красный карандаш и нарисуй треугольник.",
  "Возьми ручку и напиши заглавную букву А.",
  "Возьми ручку и напиши своё имя.",
  "Нарисуй солнце.",
  "Нарисуй домик.",
  "Нарисуй смайлик.",
  "Положи карандаш справа от тетради.",
  "Положи карандаш слева от книги.",
  "Открой тетрадь на первой странице.",
  "Закрой тетрадь и положи её на стол.",
  "Возьми два карандаша и покажи их.",
  "Поставь точку в середине листа.",
  "Скажи своё имя громко.",
  "Скажи своё имя тихо.",
  "Назови три цвета.",
  "Назови три животных.",
  "Назови три предмета в комнате.",
  "Скажи «Я умею читать» громко.",
  "Скажи что ты ел на завтрак.",
  "Спой одну строчку любой песни.",
  "Скажи «мама» три раза.",
  "Скажи «до свидания» и помаши рукой.",
  "Сядь ровно и положи руки на стол.",
  "Встань прямо и опусти руки вниз.",
  "Повернись на стуле направо.",
  "Повернись на стуле налево.",
  "Наклони голову вправо, потом влево.",
  "Закрой рот и подержи так три секунды.",
  "Сожми руки в кулаки и медленно разожми.",
  "Посмотри в окно и скажи что видишь.",
];

const manifest = {
  meta: {
    id: "reading_dad_instructions",
    version: "1.0.0",
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
      ui: {
        title: { ru: "Читаем и выполняем", en: "Read and do" },
        instruction: { ru: "Прочитай предложение и выполни задание", en: "Read and follow the instruction" },
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
      lines: SENTENCES.map((text, i) => ({ id: `s${i + 1}`, text })),
    },
  ],
};

const zip = new JSZip();
zip.file("topic.json", JSON.stringify(manifest, null, 2));
zip.file("media/avatar.svg", avatarSvg);
const buffer = await zip.generateAsync({ type: "nodebuffer" });
writeFileSync("public/decks/reading_dad_instructions_v1.0.0.zip", buffer);
console.log(`✓ reading_dad_instructions_v1.0.0.zip written (${buffer.length} bytes, ${SENTENCES.length} sentences)`);
