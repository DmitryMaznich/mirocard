// «Буквы и звуки» (phonetic_analysis) deck — docs/letters-and-sounds.md.
// Cards are letters; words with pictures come from words.json (built from
// words.src.py). Pictures: media/<word>.webp when generated, emoji until then.
// Usage: node tools/phonetic_analysis/build.mjs
// Then copy phonetic_analysis.zip to public/decks/phonetic_analysis_v<version>.zip
// and point public/decks/catalog.json at it (CLAUDE.md, "Deck-zip topics").
import JSZip from "jszip";
import { allSyllables } from "../../src/topics/renderers/phonetic_analysis/syllables.js";
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = join(DIR, "..", "..");
const VERSION = "2.9.2";

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

// Mode icons (owner, 2026-11-18): src/topics/renderers/phonetic_analysis/media/icons/<mode id>.svg.
const ICONS = join(ROOT, "src/topics/renderers/phonetic_analysis/media/icons");
const iconOf = (id) => (existsSync(join(ICONS, `${id}.svg`)) ? `media/icons/${id}.svg` : undefined);
const mode = (id, title, methodology, extra = {}) => ({
  // No `finite` and no «Заданий в занятии»: the lesson goes round until the adult
  // ends it, as in the other topics (owner, 2026-11-18).
  id, type: id, evaluation: "instant", paramsScope: "mode",
  ui: { title, ...(iconOf(id) ? { icon: iconOf(id) } : {}) }, methodology, params: {}, ...extra,
});
const withWords = { words };
// Letter sounds for «Где звук?» (sounds/<letter>.mp3). Vowels are cut from the
// «Диктант» clips (lo_<letter>.mp3 «Строчная а» → «а», owner 2026-11-18);
// consonants wait for the owner's own recording — synthesis says the letter's
// name or adds a vowel. A letter without a file: only the word is voiced.
// Syllable voice (syllables/<слог>.mp3, generate-syllables.mjs) for «Найди букву» and «Что пропало?».
const syllableSounds = Object.fromEntries(allSyllables()
  .map((S) => [S, `syllables/${S.toLowerCase()}.mp3`]).filter(([, f]) => existsSync(join(DIR, f))));
const UNIT = (label) => ({ type: "enum", label: { ru: label }, values: ["letters", "syllables"], labels: { ru: { letters: "Буквы", syllables: "Слоги" } }, default: "letters" });
const sounds = Object.fromEntries([..."АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЫЭЮЯ"]
  .map((L) => [L, `sounds/${L.toLowerCase()}.mp3`]).filter(([, f]) => existsSync(join(DIR, f))));

const topic = {
  meta: {
    id: "phonetic_analysis",
    version: VERSION,
    renderer: "phonetic_analysis",
    showSelectedConcepts: true, // the launch screen shows the chosen letters themselves, not progress dots (2026-11-19)
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
        "1 — повтор букв и слогов, 5 «Что пропало?» — тоже. 2 «Где звук?»: Начало или конец → Везде. 3 «Лото» — первая буква. 4 «Буквы в клетки»: Последняя буква → Всё слово.",
        "Слово звучит само; нажать на картинку — ещё раз. В «Где звук?» перед словом звучит сам звук (пока у гласных), нажать на букву в вопросе — ещё раз.",
      ],
    },
  },
  cards,
  modes: [
    mode("pa_find_letter", "1. Найди букву", {
      summary: "Буква или слог показаны — найти такие же: среди 3, среди 6 или все на поле.",
      text: "«Что искать»: буквы или слоги (слоги собираются сами из пройденных букв: согласная + гласная — МА, МО, СУ…). Сверху образец, он звучит (нажать — ещё раз). «Легко» — найти среди 3 непохожих. «Средне» — среди 6, есть похожие: для букв — по звучанию и написанию, для слогов — перевёртыш (АМ), та же согласная (МО), та же гласная (НА). «Трудно» — поле, найти все такие; кружки сверху показывают, сколько осталось. Неверная карточка вздрагивает и бледнеет, верная зеленеет.",
      goal: "Узнавать пройденные буквы и слоги целиком, различать похожие.",
      duration: "2–3 минуты",
    }, { sounds, syllableSounds, params: { unit: UNIT("Что искать"), difficulty: { type: "enum", label: { ru: "Сложность" }, values: ["easy", "medium", "hard"], labels: { ru: { easy: "Легко", medium: "Средне", hard: "Трудно" } }, default: "easy" } } }),
    mode("pa_where", "2. Где звук?", {
      summary: "Нажать на клетку, где в слове звук.",
      text: "Сначала звучит звук, потом слово (нажать на букву в вопросе — звук ещё раз, на картинку — слово). Под картинкой клетка на каждый звук слова, все открыты; ребёнок нажимает на клетку, где звук, — там появляется фишка. «Начало или конец»: звук первый или последний, поровну. «Везде»: ещё и в середине, половина слов — со звуком внутри. После ответа в клетках появляется слово: видно, где эта буква. Ошибка — палец показывает, где звук, ребёнок нажимает ещё раз.",
      goal: "Слышать, где в слове звук: начало, конец, середина.",
      duration: "2–3 минуты",
    }, { ...withWords, sounds, params: { position: { type: "enum", label: { ru: "Где искать" }, values: ["edges", "all"], labels: { ru: { edges: "Начало или конец", all: "Везде" } }, default: "edges" } } }),
    mode("pa_lotto", "3. Лото", {
      summary: "Буквы на картинки или картинки на буквы — направление выбирается перед занятием.",
      text: "Как настольное лото: поле 3×3 закрывается целиком. «Буквы на картинки»: 9 картинок на поле и по букве на каждую — букву кладут на картинку, которая с неё начинается. «Картинки на буквы»: 9 букв на поле и 9 картинок — картинку кладут на её первую букву. Если пройдено мало букв, буква повторяется: любая «М» подходит к любой картинке на М. Нажать на картинку — услышать слово. Поле за полем, пока взрослый не закончит занятие.",
      goal: "Сравнивать первые звуки слов и находить слово на заданную букву.",
      duration: "3 минуты",
    }, { ...withWords, params: { direction: { type: "enum", label: { ru: "Направление" }, values: ["letters", "pictures"], labels: { ru: { letters: "Буквы на картинки", pictures: "Картинки на буквы" } }, default: "letters" } } }),
    mode("pa_all_letters", "4. Буквы в клетки", {
      summary: "Перетащить буквы в клетки звуковой схемы: последнюю букву или всё слово.",
      text: "«Последняя буква»: клетка на каждый звук, внутренние закрыты — перетащить последнюю букву в последнюю клетку; только слова, где последний звук совпадает с буквой (без «дуб» — там слышится [п]). «Всё слово»: короткие слова только из пройденных букв, плюс 1–2 лишние буквы; можно нажимать на буквы по порядку или перетаскивать в нужную клетку.",
      goal: "Слышать звук и знать его букву — от последнего звука к полному анализу слова.",
      duration: "3 минуты",
    }, { ...withWords, params: { scope: { type: "enum", label: { ru: "Что вставлять" }, values: ["last", "word"], labels: { ru: { last: "Последняя буква", word: "Всё слово" } }, default: "last" } } }),
    mode("pa_missing", "5. Что пропало?", {
      summary: "Запомнить ряд карточек — одна пропадёт, найти её среди трёх.",
      text: "Буквы или слоги из пройденных. Ряд карточек звучит по очереди, через несколько секунд карточки переворачиваются, и одна исчезает. Ребёнок выбирает пропавшую из трёх вариантов (два других похожи на неё и в ряду не было). Ошибка — вариант вздрагивает и бледнеет; после двух ошибок ряд на секунду открывается снова. «Легко» — 3 карточки, «Средне» — 4, «Трудно» — 5.",
      goal: "Узнавать букву и слог целиком и удерживать в памяти ряд из 3–5 карточек.",
      duration: "3 минуты",
    }, { sounds, syllableSounds, params: { unit: UNIT("Что"), difficulty: { type: "enum", label: { ru: "Сложность" }, values: ["easy", "medium", "hard"], labels: { ru: { easy: "Легко — 3", medium: "Средне — 4", hard: "Трудно — 5" } }, default: "easy" } } }),
  ],
};

const files = new Set(["media/avatar.svg", ...words.flatMap((w) => [w.image, w.audio].filter(Boolean)), ...Object.values(sounds), ...Object.values(syllableSounds)]);
writeFileSync(join(DIR, "topic.json"), `${JSON.stringify(topic, null, 2)}\n`);

console.log("Building renderer…");
execSync("npm run build:renderer", { cwd: ROOT, env: { ...process.env, RENDERER: "phonetic_analysis" }, stdio: "inherit", shell: true });
const dist = join(DIR, "dist");

const zip = new JSZip();
zip.file("topic.json", readFileSync(join(DIR, "topic.json"), "utf8"));
zip.file("renderer", readFileSync(join(dist, "renderer")));
if (existsSync(join(dist, "mirocard2.css"))) zip.file("mirocard2.css", readFileSync(join(dist, "mirocard2.css")));
for (const f of files) zip.file(f, readFileSync(join(DIR, f)));
for (const m of topic.modes) if (m.ui.icon) zip.file(m.ui.icon, readFileSync(join(ICONS, m.ui.icon.replace("media/icons/", ""))));

const out = join(DIR, "phonetic_analysis.zip");
writeFileSync(out, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
console.log(`✓ ${out} — v${VERSION}, ${cards.length} letters, ${words.length} words, ${files.size} files`);
