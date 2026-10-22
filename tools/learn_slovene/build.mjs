// «Учим словенский» (learn_slovene) deck: topic.json from words.json + the
// bilingual_words renderer + the picked pictures and recordings.
// Usage: node tools/learn_slovene/build.mjs
// Then copy learn_slovene.zip to public/decks/learn_slovene_v<version>.zip and
// point public/decks/catalog.json at it (CLAUDE.md, "Deck-zip topics").
import JSZip from "jszip";
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = join(DIR, "..", "..");
const VERSION = "0.1.0";

const { words, distractors } = JSON.parse(readFileSync(join(DIR, "words.json"), "utf8"));

const cards = words.flatMap((w) => Array.from({ length: w.pictures }, (_, i) => ({
  id: `${w.id}_${i + 1}`,
  conceptId: w.id,
  primary: i === 0,
  image: `media/${w.id}_${i + 1}.webp`,
  label: `${w.sl} · ${w.ru}`,
  word: { sl: w.sl, ru: w.ru },
  audio: { ru: `audio/ru/${w.id}.mp3`, sl: `audio/sl/${w.id}.mp3` },
  group: w.group,
  ...(w.neverWith ? { neverWith: w.neverWith } : {}),
})));

const distractorCards = distractors.flatMap((d) => d.pictures.map((n) => ({
  id: `${d.id}_${n}`,
  conceptId: d.id,
  image: `media/${d.id}_${n}.webp`,
  word: { sl: d.sl },
  group: d.group,
  ...(d.neverWith ? { neverWith: d.neverWith } : {}),
})));

const taskCount = {
  type: "enum",
  label: { ru: "Заданий в занятии" },
  values: [4, 6, 10],
  labels: { ru: { 4: "4", 6: "6", 10: "10" } },
  default: 6,
  hint: { ru: "Мотивация невысокая — лучше короткое занятие, чем брошенное на середине." },
};
const promptDelay = {
  type: "enum",
  label: { ru: "Подсказка через" },
  values: [3, 5, 8],
  labels: { ru: { 3: "3 с", 5: "5 с", 8: "8 с" } },
  default: 5,
  hint: { ru: "Сколько ждать ответа перед каждой следующей подсказкой: повтор → русское слово → выделение картинки." },
};

const findMode = (id, title, audioOrder, optionCount, methodology, params) => ({
  id,
  type: "bw_find",
  evaluation: "instant",
  finite: true,
  audioOrder,
  optionCount,
  distractors: distractorCards,
  paramsScope: "mode",
  ui: { title, instruction: "Послушай и найди картинку" },
  methodology,
  params,
});

const topic = {
  meta: {
    id: "learn_slovene",
    version: VERSION,
    renderer: "bilingual_words",
    title: { ru: "Учим словенский", en: "Learning Slovenian" },
    avatar: "media/avatar.svg",
    questionKey: "Найди",
    about: {
      description: "Второй язык для ребёнка, который говорит по-русски: одна вещь — два слова. Дома (оранжевая рамка слева) слово звучит по-русски, в школе (синяя рамка справа) — по-словенски. Русское слово сначала звучит всегда, потом становится подсказкой и уходит. Отвечать — выбором картинки, говорить не нужно. Первый набор — школьный перекус (malica).",
      goals: [
        "Понять, что у одной вещи есть домашнее и школьное название.",
        "Узнавать на слух словенские слова школьного дня, сначала с опорой на русское.",
      ],
      finalGoal: "По словенскому слову ребёнок сам находит картинку среди трёх, без русской подсказки.",
      flow: [
        "1 → 2 → 3 → 4. Переходите дальше, когда ребёнок уверенно справляется сам.",
        "2 → 3: два занятия подряд выбирает уверенно, без случайных нажатий. 3 → 4: около 80% заданий сам.",
        "Слова выбираются в «Изменить» под точками: снимите те, которых ребёнок не понимает по-русски.",
        "Носитель языка проверяет записи в режиме «Прослушать все слова».",
      ],
    },
  },
  cards,
  modes: [
    {
      id: "ls_pair",
      type: "bw_pair",
      evaluation: "none",
      ui: { title: "1. Показ пары", instruction: "Послушай: дома — по-русски, в школе — по-словенски" },
      methodology: {
        summary: "Картинка, слово по-русски («дом»), затем по-словенски («школа»).",
        text: "Звучит русское слово, светится рамка дома слева; через паузу — словенское, светится рамка школы справа. Ребёнок касается картинки — следующая. Ошибиться нельзя. Можно нажать на дом или школу, чтобы услышать слово ещё раз.",
        goal: "Ребёнок связывает одну вещь с двумя названиями и с двумя местами.",
        duration: "1–2 минуты",
        tips: [
          "Покажите настоящий предмет, если он под рукой: «Сок. В школе — sok».",
          "Говорите по-русски, как обычно; словенское слово звучит из приложения.",
        ],
      },
    },
    findMode("ls_find_both", "2. Найди: оба слова", "ru_sl", 2, {
      summary: "Звучат оба слова, ребёнок выбирает одну из двух картинок.",
      text: "Русское слово (дом) → словенское (школа) → выбор из двух картинок. Вторая картинка — из другой темы (не еда рядом с едой). Учим само действие «выбрать». После ответа звучит пара «voda — вода».",
      goal: "Ребёнок выбирает картинку по слову.",
      duration: "2–3 минуты",
      tips: ["Если ребёнок нажимает подряд одну и ту же сторону, вернитесь к режиму 1."],
    }, { taskCount }),
    findMode("ls_find_sl", "3. Найди по-словенски", "sl", 2, {
      summary: "Только словенское слово; русское — подсказка при затруднении.",
      text: "Звучит словенское слово, две картинки. Если ребёнок молчит: повтор словенского → русское слово (рамка дома) → нужная картинка увеличивается. Неверное нажатие: картинка бледнеет, без резкого звука, звучит пара, ребёнок нажимает правильную. Ответ после русской подсказки, выделения или ошибки считается ответом «с помощью».",
      goal: "Ребёнок узнаёт словенское слово, опираясь на русское всё реже.",
      duration: "2–3 минуты",
      tips: [
        "Рамка дома здесь пунктирная: русский — только подсказка. Ребёнок может нажать на неё сам — это тоже помощь.",
        "Если больше половины ответов «с помощью», вернитесь к режиму 2.",
      ],
    }, { taskCount, promptDelay }),
    findMode("ls_find_sl3", "4. Три картинки", "sl", 3, {
      summary: "Только словенское слово, три картинки.",
      text: "Как режим 3, но картинок три. Слово освоено, когда ребёнок три занятия подряд находит его сам.",
      goal: "Ребёнок по словенскому слову находит картинку среди трёх без русской подсказки.",
      duration: "2–3 минуты",
      tips: ["Проверьте слово в жизни: на перекусе дайте выбрать между двумя предметами по словенскому слову."],
    }, { taskCount, promptDelay }),
    {
      id: "ls_listen_all",
      type: "bw_listen_all",
      evaluation: "none",
      ui: { title: "Прослушать все слова", instruction: "Для взрослого и для проверки произношения" },
      methodology: {
        summary: "Список слов с записями на обоих языках — для взрослого и носителя языка.",
        text: "Каждое слово: SL — словенская запись, RU — русская, RU → SL — пара, как в занятии. Носитель языка проверяет словенские записи здесь же, в приложении.",
        goal: "Проверить произношение до занятий с ребёнком.",
        duration: "по необходимости",
        tips: ["Отмечайте слова, где ударение или звук не так, — их перезапишем."],
      },
    },
  ],
};

// Every referenced file must exist before anything is packed.
const files = new Set(["media/avatar.svg"]);
for (const card of [...cards, ...distractorCards]) files.add(card.image);
for (const card of cards) { files.add(card.audio.ru); files.add(card.audio.sl); }
const missing = [...files].filter((f) => !existsSync(join(DIR, f)));
if (missing.length) throw new Error(`missing files:\n  ${missing.join("\n  ")}`);

writeFileSync(join(DIR, "topic.json"), `${JSON.stringify(topic, null, 2)}\n`);

console.log("Building renderer…");
execSync("npm run build:renderer", { cwd: ROOT, env: { ...process.env, RENDERER: "bilingual_words" }, stdio: "inherit", shell: true });
const dist = join(ROOT, "tools", "bilingual_words", "dist");

const zip = new JSZip();
zip.file("topic.json", readFileSync(join(DIR, "topic.json"), "utf8"));
zip.file("renderer", readFileSync(join(dist, "renderer")));
if (existsSync(join(dist, "mirocard2.css"))) zip.file("mirocard2.css", readFileSync(join(dist, "mirocard2.css")));
for (const f of files) zip.file(f, readFileSync(join(DIR, f)));

const out = join(DIR, "learn_slovene.zip");
writeFileSync(out, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
console.log(`✓ ${out} — v${VERSION}, ${cards.length} cards, ${distractorCards.length} distractors, ${files.size} files`);
