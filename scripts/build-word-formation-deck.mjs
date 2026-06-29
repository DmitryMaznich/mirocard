import JSZip from "jszip";
import { readFileSync, writeFileSync } from "node:fs";

const TOPIC_ID = "word_formation_soup";
const VERSION  = "1.0.0";
const ZIP_PATH = `public/decks/${TOPIC_ID}_v${VERSION}.zip`;

const CONCEPTS = [
  { id: "ryba",    noun: "рыба",    nounPhrase: "суп из рыбы",    adjPhrase: "рыбный суп",    difficulty: "easy",   color: "#2196F3", emoji: "🐟" },
  { id: "myaso",   noun: "мясо",    nounPhrase: "суп из мяса",    adjPhrase: "мясной суп",    difficulty: "easy",   color: "#F44336", emoji: "🥩" },
  { id: "grib",    noun: "гриб",    nounPhrase: "суп из грибов",  adjPhrase: "грибной суп",   difficulty: "easy",   color: "#795548", emoji: "🍄" },
  { id: "kapusta", noun: "капуста", nounPhrase: "суп из капусты", adjPhrase: "капустный суп", difficulty: "easy",   color: "#4CAF50", emoji: "🥬" },
  { id: "kuritsa", noun: "курица",  nounPhrase: "суп из курицы",  adjPhrase: "куриный суп",   difficulty: "medium", color: "#FF9800", emoji: "🍗" },
  { id: "goroh",   noun: "горох",   nounPhrase: "суп из гороха",  adjPhrase: "гороховый суп", difficulty: "medium", color: "#8BC34A", emoji: "🟢" },
  { id: "luk",     noun: "лук",     nounPhrase: "суп из лука",    adjPhrase: "луковый суп",   difficulty: "medium", color: "#9C27B0", emoji: "🧅" },
  { id: "ovoschi", noun: "овощи",   nounPhrase: "суп из овощей",  adjPhrase: "овощной суп",   difficulty: "medium", color: "#009688", emoji: "🥕" },
  { id: "fasolj",  noun: "фасоль",  nounPhrase: "суп из фасоли",  adjPhrase: "фасолевый суп", difficulty: "hard",   color: "#E91E63", emoji: "🫘" },
  { id: "tomat",   noun: "томат",   nounPhrase: "суп из томата",  adjPhrase: "томатный суп",  difficulty: "hard",   color: "#FF5722", emoji: "🍅" },
];

function makeSvg(concept) {
  const bg   = concept.color;
  const dark = "rgba(0,0,0,0.18)";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
  <rect width="400" height="400" rx="32" fill="${bg}"/>
  <rect x="12" y="12" width="376" height="376" rx="24" fill="${dark}"/>
  <text x="200" y="160" font-family="sans-serif" font-size="90" text-anchor="middle" dominant-baseline="middle">${concept.emoji}</text>
  <text x="200" y="262" font-family="sans-serif" font-size="36" font-weight="bold" fill="white" text-anchor="middle">${concept.noun}</text>
  <text x="200" y="308" font-family="sans-serif" font-size="22" fill="rgba(255,255,255,0.85)" text-anchor="middle">${concept.nounPhrase}</text>
</svg>`;
}

const cards = CONCEPTS.map(c => ({
  id:             c.id,
  noun:           c.noun,
  nounPhrase:     c.nounPhrase,
  adjPhrase:      c.adjPhrase,
  difficulty:     c.difficulty,
  color:          c.color,
  image:          `media/${c.id}.svg`,
  audioNounPhrase: `audio/${c.id}_noun.mp3`,
  audioAdjPhrase:  `audio/${c.id}_adj.mp3`,
}));

const topic = {
  meta: {
    id:       TOPIC_ID,
    renderer: "word_formation",
    version:  VERSION,
    title:    { ru: "Суп: словообразование", en: "Soup: word formation" },
    language: "ru",
  },
  modes: [
    {
      id:          "pair_intro",
      type:        "pair_intro",
      evaluation:  "none",
      requirePin:  false,
      ui: {
        title:       { ru: "Знакомство с парами" },
        instruction: { ru: "Листайте пары: суп из … → … суп" },
      },
    },
    {
      id:          "form_it",
      type:        "form_it",
      evaluation:  "auto",
      requirePin:  false,
      ui: {
        title:       { ru: "Образуй прилагательное" },
        instruction: { ru: "Нажми на правильное слово" },
      },
      params: {
        stimulus: {
          type: "enum", label: { ru: "Стимул" },
          values: ["phrase", "image", "mixed"], default: "mixed",
        },
        optionCount: {
          type: "enum", label: { ru: "Вариантов" },
          values: [2, 3, 4], default: 4,
        },
      },
    },
    {
      id:          "yes_no",
      type:        "yes_no",
      evaluation:  "auto",
      requirePin:  false,
      ui: {
        title:       { ru: "Правильно / Нет?" },
        instruction: { ru: "Это правильное словосочетание?" },
      },
      params: {
        repsPerConcept: {
          type: "number", label: { ru: "Повторений" },
          default: 1, min: 1, max: 5,
        },
      },
    },
    {
      id:          "question_ask",
      type:        "question_ask",
      evaluation:  "none",
      requirePin:  true,
      ui: {
        title:       { ru: "Назови суп" },
        instruction: { ru: "Логопед задаёт вопрос устно" },
      },
    },
  ],
  cards,
};

const zip = new JSZip();
zip.file("topic.json", JSON.stringify(topic, null, 2));

for (const c of CONCEPTS) {
  zip.file(`media/${c.id}.svg`, makeSvg(c));
}

const buffer = await zip.generateAsync({ type: "nodebuffer" });
writeFileSync(ZIP_PATH, buffer);
console.log(`✓ ${ZIP_PATH} (${(buffer.length / 1024).toFixed(1)} KB)`);

const catalog = JSON.parse(readFileSync("public/decks/catalog.json", "utf-8"));
const idx = catalog.decks.findIndex(d => d.id === TOPIC_ID);
const entry = {
  id:       TOPIC_ID,
  version:  VERSION,
  url:      `./decks/${TOPIC_ID}_v${VERSION}.zip`,
  zipUrl:   `${TOPIC_ID}_v${VERSION}.zip`,
  title:    { ru: "Суп: словообразование", en: "Soup: word formation" },
  renderer: "word_formation",
};
if (idx >= 0) { catalog.decks[idx] = entry; } else { catalog.decks.push(entry); }
writeFileSync("public/decks/catalog.json", JSON.stringify(catalog, null, 2));
console.log("✓ catalog.json updated");
