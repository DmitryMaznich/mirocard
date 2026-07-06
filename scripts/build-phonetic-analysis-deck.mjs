import JSZip from "jszip";
import { readFileSync, writeFileSync } from "node:fs";

const TOPIC_ID = "phonetic_analysis";
const VERSION  = "1.0.0";
const ZIP_PATH = `public/decks/${TOPIC_ID}_v${VERSION}.zip`;

const PALETTE = [
  "#2196F3", "#F44336", "#4CAF50", "#FF9800", "#9C27B0",
  "#795548", "#009688", "#E91E63", "#3F51B5", "#607D8B",
];

// word            — слово (нижний регистр, без стечений согласных)
// emoji           — плейсхолдер-иллюстрация
// targetLetterFirst — первый звук/буква (всегда однозначен в этом банке)
// targetLetterLast  — последний звук/буква; ОТСУТСТВУЕТ, если последний звук
//                      оглушается или гласная безударна (см. спеку)
// positionWords   — согласные, встречающиеся в слове один раз, с позицией
// blanks          — { blankIndex, targetLetter } для режима missing_letter
const WORDS = [
  { word: "кот",  emoji: "🐱", targetLetterFirst: "к", targetLetterLast: "т",
    positionWords: [{ targetLetter: "к", position: "start" }, { targetLetter: "т", position: "end" }],
    blanks: [{ blankIndex: 2, targetLetter: "т" }], difficultyTier: 1 },
  { word: "дом",  emoji: "🏠", targetLetterFirst: "д", targetLetterLast: "м",
    positionWords: [{ targetLetter: "д", position: "start" }, { targetLetter: "м", position: "end" }],
    blanks: [{ blankIndex: 2, targetLetter: "м" }], difficultyTier: 1 },
  { word: "сом",  emoji: "🐟", targetLetterFirst: "с", targetLetterLast: "м",
    positionWords: [{ targetLetter: "с", position: "start" }, { targetLetter: "м", position: "end" }],
    blanks: [{ blankIndex: 0, targetLetter: "с" }], difficultyTier: 1 },
  { word: "лук",  emoji: "🧅", targetLetterFirst: "л", targetLetterLast: "к",
    positionWords: [{ targetLetter: "л", position: "start" }, { targetLetter: "к", position: "end" }],
    blanks: [{ blankIndex: 0, targetLetter: "л" }], difficultyTier: 1 },
  { word: "жук",  emoji: "🪲", targetLetterFirst: "ж", targetLetterLast: "к",
    positionWords: [{ targetLetter: "ж", position: "start" }, { targetLetter: "к", position: "end" }],
    blanks: [{ blankIndex: 2, targetLetter: "к" }], difficultyTier: 1 },
  { word: "мак",  emoji: "🌺", targetLetterFirst: "м", targetLetterLast: "к",
    positionWords: [{ targetLetter: "м", position: "start" }, { targetLetter: "к", position: "end" }],
    blanks: [{ blankIndex: 0, targetLetter: "м" }], difficultyTier: 1 },
  { word: "рак",  emoji: "🦞", targetLetterFirst: "р", targetLetterLast: "к",
    positionWords: [{ targetLetter: "р", position: "start" }, { targetLetter: "к", position: "end" }],
    blanks: [{ blankIndex: 2, targetLetter: "к" }], difficultyTier: 1 },
  { word: "бак",  emoji: "🛢️", targetLetterFirst: "б", targetLetterLast: "к",
    positionWords: [{ targetLetter: "б", position: "start" }, { targetLetter: "к", position: "end" }],
    blanks: [{ blankIndex: 0, targetLetter: "б" }], difficultyTier: 1 },
  { word: "шар",  emoji: "🎈", targetLetterFirst: "ш", targetLetterLast: "р",
    positionWords: [{ targetLetter: "ш", position: "start" }, { targetLetter: "р", position: "end" }],
    blanks: [{ blankIndex: 0, targetLetter: "ш" }], difficultyTier: 1 },
  { word: "сыр",  emoji: "🧀", targetLetterFirst: "с", targetLetterLast: "р",
    positionWords: [{ targetLetter: "с", position: "start" }, { targetLetter: "р", position: "end" }],
    blanks: [{ blankIndex: 2, targetLetter: "р" }], difficultyTier: 1 },
  { word: "кит",  emoji: "🐳", targetLetterFirst: "к", targetLetterLast: "т",
    positionWords: [{ targetLetter: "к", position: "start" }, { targetLetter: "т", position: "end" }],
    blanks: [{ blankIndex: 0, targetLetter: "к" }], difficultyTier: 1 },
  { word: "пух",  emoji: "🪶", targetLetterFirst: "п", targetLetterLast: "х",
    positionWords: [{ targetLetter: "п", position: "start" }, { targetLetter: "х", position: "end" }],
    blanks: [{ blankIndex: 2, targetLetter: "х" }], difficultyTier: 1 },
  { word: "мох",  emoji: "🌿", targetLetterFirst: "м", targetLetterLast: "х",
    positionWords: [{ targetLetter: "м", position: "start" }, { targetLetter: "х", position: "end" }],
    blanks: [{ blankIndex: 0, targetLetter: "м" }], difficultyTier: 1 },
  { word: "лес",  emoji: "🌲", targetLetterFirst: "л", targetLetterLast: "с",
    positionWords: [{ targetLetter: "л", position: "start" }, { targetLetter: "с", position: "end" }],
    blanks: [{ blankIndex: 2, targetLetter: "с" }], difficultyTier: 1 },
  { word: "нос",  emoji: "👃", targetLetterFirst: "н", targetLetterLast: "с",
    positionWords: [{ targetLetter: "н", position: "start" }, { targetLetter: "с", position: "end" }],
    blanks: [{ blankIndex: 0, targetLetter: "н" }], difficultyTier: 1 },
  { word: "туча", emoji: "☁️", targetLetterFirst: "т", // безударное конечное "а" — targetLetterLast не задаём
    positionWords: [{ targetLetter: "т", position: "start" }, { targetLetter: "ч", position: "middle" }],
    blanks: [{ blankIndex: 2, targetLetter: "ч" }], difficultyTier: 1 },
  { word: "суп",  emoji: "🍲", targetLetterFirst: "с", targetLetterLast: "п",
    positionWords: [{ targetLetter: "с", position: "start" }, { targetLetter: "п", position: "end" }],
    blanks: [{ blankIndex: 2, targetLetter: "п" }], difficultyTier: 1 },
  { word: "губы", emoji: "👄", targetLetterFirst: "г", // безударное "гУбы" — targetLetterLast не задаём
    positionWords: [{ targetLetter: "г", position: "start" }, { targetLetter: "б", position: "middle" }],
    blanks: [{ blankIndex: 2, targetLetter: "б" }], difficultyTier: 1 },
  { word: "нога", emoji: "🦵", targetLetterFirst: "н", targetLetterLast: "а", // ударное "ногА"
    positionWords: [{ targetLetter: "н", position: "start" }, { targetLetter: "г", position: "middle" }],
    blanks: [{ blankIndex: 2, targetLetter: "г" }], difficultyTier: 1 },
  { word: "вода", emoji: "💧", targetLetterFirst: "в", targetLetterLast: "а", // ударное "водА"
    positionWords: [{ targetLetter: "в", position: "start" }, { targetLetter: "д", position: "middle" }],
    blanks: [{ blankIndex: 2, targetLetter: "д" }], difficultyTier: 1 },
  { word: "вата", emoji: "🧻", targetLetterFirst: "в", // безударное "вАта" — targetLetterLast не задаём
    positionWords: [{ targetLetter: "в", position: "start" }, { targetLetter: "т", position: "middle" }],
    blanks: [{ blankIndex: 2, targetLetter: "т" }], difficultyTier: 1 },
  { word: "ваза", emoji: "🏺", targetLetterFirst: "в", // безударное "вАза" — targetLetterLast не задаём
    positionWords: [{ targetLetter: "в", position: "start" }, { targetLetter: "з", position: "middle" }],
    blanks: [{ blankIndex: 2, targetLetter: "з" }], difficultyTier: 1 },
  { word: "коза", emoji: "🐐", targetLetterFirst: "к", targetLetterLast: "а", // ударное "козА"
    positionWords: [{ targetLetter: "к", position: "start" }, { targetLetter: "з", position: "middle" }],
    blanks: [{ blankIndex: 2, targetLetter: "з" }], difficultyTier: 1 },
  { word: "лиса", emoji: "🦊", targetLetterFirst: "л", targetLetterLast: "а", // ударное "лисА"
    positionWords: [{ targetLetter: "л", position: "start" }, { targetLetter: "с", position: "middle" }],
    blanks: [{ blankIndex: 2, targetLetter: "с" }], difficultyTier: 1 },
  { word: "чай",  emoji: "🍵", targetLetterFirst: "ч", targetLetterLast: "й",
    positionWords: [{ targetLetter: "ч", position: "start" }],
    blanks: [{ blankIndex: 0, targetLetter: "ч" }], difficultyTier: 1 },
  { word: "лицо", emoji: "😊", targetLetterFirst: "л", targetLetterLast: "о", // ударное "лицО"
    positionWords: [{ targetLetter: "л", position: "start" }, { targetLetter: "ц", position: "middle" }],
    blanks: [{ blankIndex: 2, targetLetter: "ц" }], difficultyTier: 1 },
];

function makeSvg({ word, emoji, color }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
  <rect width="400" height="400" rx="32" fill="${color}"/>
  <rect x="12" y="12" width="376" height="376" rx="24" fill="rgba(0,0,0,0.12)"/>
  <text x="200" y="190" font-family="sans-serif" font-size="140" text-anchor="middle" dominant-baseline="middle">${emoji}</text>
  <text x="200" y="320" font-family="sans-serif" font-size="52" font-weight="bold" fill="white" text-anchor="middle">${word}</text>
</svg>`;
}

const cards = WORDS.map((w) => {
  const card = {
    id: `word_${w.word}`,
    word: w.word,
    emoji: w.emoji,
    image: `media/word_${w.word}.svg`,
    targetLetterFirst: w.targetLetterFirst,
    positionWords: w.positionWords,
    blanks: w.blanks,
    difficultyTier: w.difficultyTier,
  };
  if (w.targetLetterLast) card.targetLetterLast = w.targetLetterLast;
  return card;
});

const topic = {
  meta: {
    id: TOPIC_ID,
    renderer: "phonetic_analysis",
    version: VERSION,
    title: { ru: "Звуки и буквы" },
    avatar: "media/avatar.svg",
    about: {
      description: "Тема тренирует фонематический анализ слова по картинке: выделение первого и последнего звука, определение позиции звука в слове, вставку пропущенной буквы.",
      goals: [
        "Научить ребёнка выделять первый и последний звук слова на слух.",
        "Научить определять положение заданного звука в слове (начало / середина / конец).",
        "Закрепить соответствие звука и буквы через вставку пропущенной буквы в написанном слове.",
      ],
      finalGoal: "Ребёнок уверенно анализирует звуковой состав простого слова и соотносит звуки с буквами.",
      flow: [
        "Начинайте с «Первый звук слова».",
        "Переходите к «Последний звук слова», затем к «Где спрятался звук».",
        "«Пропущенная буква» — завершающий, уже орфографический режим.",
      ],
    },
  },
  modes: [
    { id: "first_sound", type: "first_sound", evaluation: "auto",
      ui: { title: { ru: "Первый звук слова" }, instruction: { ru: "Назови слово и выбери первую букву" } } },
    { id: "last_sound", type: "last_sound", evaluation: "auto",
      ui: { title: { ru: "Последний звук слова" }, instruction: { ru: "Назови слово и выбери последнюю букву" } } },
    { id: "sound_position", type: "sound_position", evaluation: "auto",
      ui: { title: { ru: "Где спрятался звук" }, instruction: { ru: "Найди, где в слове звучит эта буква" } } },
    { id: "missing_letter", type: "missing_letter", evaluation: "auto",
      ui: { title: { ru: "Пропущенная буква" }, instruction: { ru: "Вставь пропущенную букву" } } },
  ],
  cards,
};

const zip = new JSZip();
zip.file("topic.json", JSON.stringify(topic, null, 2));

WORDS.forEach((w, i) => {
  const color = PALETTE[i % PALETTE.length];
  zip.file(`media/word_${w.word}.svg`, makeSvg({ ...w, color }));
});

const buffer = await zip.generateAsync({ type: "nodebuffer" });
writeFileSync(ZIP_PATH, buffer);
console.log(`✓ ${ZIP_PATH} (${(buffer.length / 1024).toFixed(1)} KB, ${WORDS.length} слов)`);

const catalog = JSON.parse(readFileSync("public/decks/catalog.json", "utf-8"));
const idx = catalog.decks.findIndex((d) => d.id === TOPIC_ID);
const entry = {
  id: TOPIC_ID,
  version: VERSION,
  url: `./decks/${TOPIC_ID}_v${VERSION}.zip`,
  zipUrl: `${TOPIC_ID}_v${VERSION}.zip`,
  title: { ru: "Звуки и буквы", en: "Sounds and Letters" },
  renderer: "phonetic_analysis",
};
if (idx >= 0) { catalog.decks[idx] = entry; } else { catalog.decks.push(entry); }
writeFileSync("public/decks/catalog.json", JSON.stringify(catalog, null, 2));
console.log("✓ catalog.json updated");
