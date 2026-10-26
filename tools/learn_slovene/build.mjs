// «Учим словенский» (learn_slovene) deck: Slovenian capitals learned through
// the Russian letter with the same sound (docs/learn-slovene.md, section 9).
// topic.json is built from letters.json; the renderer is letter_bridge.
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
const VERSION = "0.2.2";

const data = JSON.parse(readFileSync(join(DIR, "letters.json"), "utf8"));

// One card per letter pair. Only the first group is `primary`, so a new
// student starts with the six «друзья»; the rest are added in «Изменить».
// soundRu / soundSl: the letter's sound (not its name) in the home and school
// voices, audio/letters/{ru,sl}/<key>.mp3 with Š → SH, Č → CH, Ž → ZH.
const soundKey = (sl) => ({ "Š": "SH", "Č": "CH", "Ž": "ZH" })[sl] ?? sl;
const cards = data.groups.flatMap((g) => g.pairs.split(" ").map((p) => {
  const [sl, ru] = p.split(":");
  return {
    id: `letter_${sl}`, conceptId: sl, primary: g.id === "g1", sl, ru, label: `${sl} = ${ru}`, group: g.id,
    soundRu: `audio/letters/ru/${soundKey(sl)}.mp3`, soundSl: `audio/letters/sl/${soundKey(sl)}.mp3`,
  };
}));
const words = data.words.map((w) => ({ ...w, image: `media/${w.id}_1.webp`, audio: `audio/sl/${w.id}.mp3` }));

const taskCount = {
  type: "enum",
  label: { ru: "Заданий в занятии" },
  values: [6, 10, 15],
  labels: { ru: { 6: "6", 10: "10", 15: "15" } },
  default: 6,
};
const direction = {
  type: "enum",
  label: { ru: "Направление" },
  values: ["sl_ru", "ru_sl", "mix"],
  labels: { ru: { sl_ru: "S → С", ru_sl: "С → S", mix: "Вперемешку" } },
  default: "sl_ru",
  hint: { ru: "S → С: видна словенская буква, выбрать русскую. С → S — наоборот." },
};
const hint = {
  type: "enum",
  label: { ru: "Подсказка кириллицей" },
  values: ["auto", "bright", "faint", "none"],
  labels: { ru: { auto: "Сама", bright: "Ярко", faint: "Бледно", none: "Нет" } },
  default: "auto",
  hint: { ru: "«Сама»: ярко, после двух прочтений слова без ошибки — бледно, после четырёх — нет." },
};

const graded = (id, type, title, methodology, params, extra = {}) => ({
  id, type, evaluation: "instant", finite: true, paramsScope: "mode", ui: { title }, methodology, params, ...extra,
});

const topic = {
  meta: {
    id: "learn_slovene",
    version: VERSION,
    renderer: "letter_bridge",
    title: { ru: "Учим словенский", en: "Learning Slovenian" },
    avatar: "media/avatar.svg",
    groups: Object.fromEntries(data.groups.map((g) => [g.id, { ru: g.title }])),
    about: {
      description: "Словенские печатные заглавные буквы для ребёнка, который читает по-русски. Каждая словенская буква учится рядом с русской, у которой тот же звук: S = С, Č = Ч. Выучив 25 пар, ребёнок читает словенские слова: SOK = СОК. Ответ — выбором, говорить не нужно.",
      goals: [
        "Знать 25 пар «словенская буква — русская буква с тем же звуком».",
        "Не путать ловушки: B = Б, C = Ц, H = Х, P = П.",
        "Читать словенские слоги и слова, сначала с подсказкой кириллицей.",
      ],
      finalGoal: "Ребёнок читает короткие словенские слова без подсказки и собирает их из латинских букв.",
      flow: [
        "Буквы выбираются в «Изменить» под точками, по группам: сначала «Друзья» (A E K M O T), потом «Звук тот же» по 3 буквы, потом «Шапочки», «Ловушки» — в конце.",
        "Новые буквы: режим 1, потом 2. Ловушки — режим 3. Когда букв достаточно — слоги (4), слова (5), сборка слова (6).",
        "Буква знакома, когда её точка стала зелёной: несколько занятий подряд без ошибок.",
      ],
    },
  },
  cards,
  modes: [
    {
      id: "lb_pair", type: "lb_pair", evaluation: "none", ui: { title: "1. Пара букв" },
      twins: data.twins,
      methodology: {
        summary: "Русская буква и рядом словенская с тем же звуком.",
        text: "Слева «Дома — по-русски»: русская буква, её ребёнок читает сам. Справа «В школе — по-словенски»: словенская буква с тем же звуком. Касание буквы — её звук: русская голосом папы, словенская школьным голосом. Касание словенской буквы — звук и следующая пара. Пары каждый раз в новом порядке. Ловушки обведены жёлтым пунктиром. Ошибиться нельзя. Маленькая «Дальше» внизу — для взрослого.",
        goal: "Связать новую букву со знакомой русской.",
        duration: "1–2 минуты",
        tips: ["Новые буквы — по 3 за раз, остальные — уже знакомые.", "Попросите прочитать русскую букву вслух, если ребёнок может."],
      },
    },
    graded("lb_find", "lb_find", "2. Найди пару", {
      summary: "Видна буква — найти её пару среди трёх.",
      text: "S → С: словенская буква, выбрать русскую. С → S — наоборот. Неверный вариант бледнеет без резкого звука, правильный подсвечивается; ответ после этого считается «с помощью».",
      goal: "Узнавать каждую словенскую букву без подсказки.",
      duration: "2–3 минуты",
      tips: ["Начните с S → С: читать русскую ребёнку проще."],
    }, { taskCount, direction }),
    graded("lb_trap", "lb_trap", "3. Ловушки", {
      summary: "B C H P против русских двойников В С Н Р.",
      text: "Словенская буква-ловушка и два варианта: двойник (похож на вид) и настоящая пара (тот же звук). Ребёнок, читающий по-русски, на автомате прочтёт P как «Р» — поэтому отдельный тренажёр.",
      goal: "B = Б, C = Ц, H = Х, P = П — без ошибок.",
      duration: "1–2 минуты",
      tips: ["Режим работает и без выбора группы «Ловушки»: в нём всегда четыре ловушки."],
    }, { taskCount }, { twins: data.twins }),
    graded("lb_syll", "lb_syll", "4. Слоги", {
      summary: "Прочитать словенский слог, выбрать русский.",
      text: "Слоги собираются из выбранных букв: MA, SO, ŠU. Неверные варианты отличаются одной похожей буквой (SO / ŠO / ZO).",
      goal: "Читать слоги из новых букв.",
      duration: "2–3 минуты",
      tips: ["Нужны и гласные, и согласные — хотя бы «Друзья»."],
    }, { taskCount }, { vowels: data.vowels, near: data.near }),
    graded("lb_word", "lb_word", "5. Слова", {
      summary: "Прочитать словенское слово, выбрать картинку.",
      text: "Под словом — подсказка кириллицей (VODA — ВОДА); она бледнеет и исчезает, когда ребёнок читает слово сам. После ответа слово звучит так, как его говорят в школе.",
      goal: "Читать короткие словенские слова без подсказки.",
      duration: "2–3 минуты",
      tips: ["Слова появляются, только когда выбраны все их буквы: с одной группой «Друзья» слов нет."],
    }, { taskCount, hint }, { words }),
    graded("lb_build", "lb_build", "6. Собери слово", {
      summary: "Собрать словенское слово из латинских плиток.",
      text: "Картинка и русское слово (СОК) → собрать SOK. Среди плиток 1–2 похожие лишние. Неверная плитка вздрагивает и остаётся на месте.",
      goal: "Писать короткие словенские слова — пока без моторики.",
      duration: "2–3 минуты",
      tips: ["Потом то же слово можно написать в тетради печатными буквами."],
    }, { taskCount }, { words, near: data.near }),
  ],
};

const files = new Set(["media/avatar.svg", ...words.flatMap((w) => [w.image, w.audio]), ...cards.flatMap((c) => [c.soundRu, c.soundSl])]);
const missing = [...files].filter((f) => !existsSync(join(DIR, f)));
if (missing.length) throw new Error(`missing files:\n  ${missing.join("\n  ")}`);

writeFileSync(join(DIR, "topic.json"), `${JSON.stringify(topic, null, 2)}\n`);

console.log("Building renderer…");
execSync("npm run build:renderer", { cwd: ROOT, env: { ...process.env, RENDERER: "letter_bridge" }, stdio: "inherit", shell: true });
const dist = join(ROOT, "tools", "letter_bridge", "dist");

const zip = new JSZip();
zip.file("topic.json", readFileSync(join(DIR, "topic.json"), "utf8"));
zip.file("renderer", readFileSync(join(dist, "renderer")));
if (existsSync(join(dist, "mirocard2.css"))) zip.file("mirocard2.css", readFileSync(join(dist, "mirocard2.css")));
for (const f of files) zip.file(f, readFileSync(join(DIR, f)));

const out = join(DIR, "learn_slovene.zip");
writeFileSync(out, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
console.log(`✓ ${out} — v${VERSION}, ${cards.length} letters, ${words.length} words, ${files.size} files`);
