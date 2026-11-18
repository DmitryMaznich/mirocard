// «Буквы и звуки» (phonetic_analysis) deck — docs/letters-and-sounds.md.
// Cards are letters; words with pictures come from words.json (built from
// words.src.py). Pictures: media/<word>.webp when generated, emoji until then.
// Usage: node tools/phonetic_analysis/build.mjs
// Then copy phonetic_analysis.zip to public/decks/phonetic_analysis_v<version>.zip
// and point public/decks/catalog.json at it (CLAUDE.md, "Deck-zip topics").
import JSZip from "jszip";
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = join(DIR, "..", "..");
const VERSION = "2.4.0";

const words = JSON.parse(readFileSync(join(DIR, "words.json"), "utf8")).words.map((w) => {
  const image = `media/${w.id}.webp`;
  const audio = `audio/${w.id}.mp3`;
  return { ...w, image: existsSync(join(DIR, image)) ? image : undefined, audio: existsSync(join(DIR, audio)) ? audio : undefined };
});

const GROUPS = [
  { id: "vowels", title: "Гласные", letters: "А О У И Ы Э" },
  { id: "iot", title: "Е Ё Ю Я", letters: "Е Ё Ю Я" },
  { id: "consonants", title: "Согласные", letters: "Б В Г Д Ж З Й К Л М Н П Р С Т Ф Х Ц Ч Ш Щ" },
];
const cards = GROUPS.flatMap((g) => g.letters.split(" ").map((L) => ({
  id: `letter_${L}`, conceptId: L, letter: L, label: L, group: g.id, primary: true,
})));

const taskCount = {
  type: "enum",
  label: { ru: "Заданий в занятии" },
  values: [6, 10, 15],
  labels: { ru: { 6: "6", 10: "10", 15: "15" } },
  default: 10,
};
const mode = (id, title, methodology, extra = {}) => ({
  id, type: id, evaluation: "instant", finite: true, paramsScope: "mode",
  ui: { title }, methodology, params: { taskCount }, ...extra,
});
const withWords = { words };

const topic = {
  meta: {
    id: "phonetic_analysis",
    version: VERSION,
    renderer: "phonetic_analysis",
    numberedModes: true, // mode titles carry their numbers; the mode list shows them (owner, 2026-11-18)
    title: { ru: "Буквы и звуки", en: "Letters and Sounds" },
    avatar: "media/avatar.svg",
    groups: Object.fromEntries(GROUPS.map((g) => [g.id, { ru: g.title }])),
    about: {
      description: "Повторение пройденных букв и звуков. Узнать букву, найти её среди других; услышать звук в слове и показать, где он: в начале, в конце, в середине. Под картинкой — звуковая схема: одна клетка = один звук.",
      goals: [
        "Узнавать пройденные буквы среди похожих.",
        "Слышать звук в начале, в конце и в середине слова.",
        "Знать, с какой буквы начинается и какой кончается слово (основа диктанта).",
      ],
      finalGoal: "Ребёнок слышит, где в слове звук, и знает, какая это буква.",
      flow: [
        "В «Изменить» отметьте пройденные буквы — все задания строятся только из них.",
        "1 — повтор букв. 2 «Где звук?»: В начале → В конце → Везде. 3 «Лото» — первая буква. 4 «Буквы в клетки»: Последняя буква → Всё слово.",
        "Слово звучит само; нажать на картинку — ещё раз.",
      ],
    },
  },
  cards,
  modes: [
    mode("pa_find_letter", "1. Найди букву", {
      summary: "Буква показана — найти её: среди 3, среди 6 или все на поле.",
      text: "Сверху буква. «Легко» — найти среди 3 непохожих букв. «Средне» — среди 6, есть похожие по звучанию и написанию. «Трудно» — поле 5×5, найти все такие буквы; кружки сверху показывают, сколько осталось. Неверная буква вздрагивает и бледнеет, верная зеленеет.",
      goal: "Узнавать пройденные буквы и различать похожие.",
      duration: "2–3 минуты",
    }, { params: { taskCount, difficulty: { type: "enum", label: { ru: "Сложность" }, values: ["easy", "medium", "hard"], labels: { ru: { easy: "Легко", medium: "Средне", hard: "Трудно" } }, default: "easy" } } }),
    mode("pa_where", "2. Где звук?", {
      summary: "Положить фишку туда, где в слове звук: в начале, в конце или в любом месте.",
      text: "Слово звучит само (нажать на картинку — ещё раз). «В начале»: под картинкой клетка и полоса — фишка в клетку, если слово начинается с этого звука, или в полосу, если звук дальше. «В конце»: полоса и клетка — то же для конца слова. «Везде»: клетка на каждый звук, фишка в начало, середину или конец; половина слов — со звуком внутри. После ответа в клетках появляется слово: видно, где эта буква. Ошибка — палец показывает, где звук, ребёнок сам переставляет фишку.",
      goal: "Слышать, где в слове звук: начало, конец, середина.",
      duration: "2–3 минуты",
    }, { ...withWords, params: { taskCount, position: { type: "enum", label: { ru: "Где искать" }, values: ["start", "end", "all"], labels: { ru: { start: "В начале", end: "В конце", all: "Везде" } }, default: "start" } } }),
    mode("pa_lotto", "3. Лото", {
      summary: "Буквы на картинки или картинки на буквы — направление выбирается перед занятием.",
      text: "Как настольное лото: поле 3×3 закрывается целиком. «Буквы на картинки»: 9 картинок на поле и по букве на каждую — букву кладут на картинку, которая с неё начинается. «Картинки на буквы»: 9 букв на поле и 9 картинок — картинку кладут на её первую букву. Если пройдено мало букв, буква повторяется: любая «М» подходит к любой картинке на М. Нажать на картинку — услышать слово. Три поля за занятие.",
      goal: "Сравнивать первые звуки слов и находить слово на заданную букву.",
      duration: "3 минуты",
    }, { ...withWords, params: { direction: { type: "enum", label: { ru: "Направление" }, values: ["letters", "pictures"], labels: { ru: { letters: "Буквы на картинки", pictures: "Картинки на буквы" } }, default: "letters" } } }),
    mode("pa_all_letters", "4. Буквы в клетки", {
      summary: "Перетащить буквы в клетки звуковой схемы: последнюю букву или всё слово.",
      text: "«Последняя буква»: клетка на каждый звук, внутренние закрыты — перетащить последнюю букву в последнюю клетку; только слова, где последний звук совпадает с буквой (без «дуб» — там слышится [п]). «Всё слово»: короткие слова только из пройденных букв, плюс 1–2 лишние буквы; можно нажимать на буквы по порядку или перетаскивать в нужную клетку.",
      goal: "Слышать звук и знать его букву — от последнего звука к полному анализу слова.",
      duration: "3 минуты",
    }, { ...withWords, params: { taskCount, scope: { type: "enum", label: { ru: "Что вставлять" }, values: ["last", "word"], labels: { ru: { last: "Последняя буква", word: "Всё слово" } }, default: "last" } } }),
  ],
};

const files = new Set(["media/avatar.svg", ...words.flatMap((w) => [w.image, w.audio].filter(Boolean))]);
writeFileSync(join(DIR, "topic.json"), `${JSON.stringify(topic, null, 2)}\n`);

console.log("Building renderer…");
execSync("npm run build:renderer", { cwd: ROOT, env: { ...process.env, RENDERER: "phonetic_analysis" }, stdio: "inherit", shell: true });
const dist = join(DIR, "dist");

const zip = new JSZip();
zip.file("topic.json", readFileSync(join(DIR, "topic.json"), "utf8"));
zip.file("renderer", readFileSync(join(dist, "renderer")));
if (existsSync(join(dist, "mirocard2.css"))) zip.file("mirocard2.css", readFileSync(join(dist, "mirocard2.css")));
for (const f of files) zip.file(f, readFileSync(join(DIR, f)));

const out = join(DIR, "phonetic_analysis.zip");
writeFileSync(out, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
console.log(`✓ ${out} — v${VERSION}, ${cards.length} letters, ${words.length} words, ${files.size} files`);
