import JSZip from "jszip";
import { writeFileSync, readFileSync } from "node:fs";

const VERSION = "1.0.1";

const manifest = {
  meta: {
    id: "math_houses",
    version: VERSION,
    cardType: "procedural",
    title: { ru: "Домики чисел", en: "Number Houses" },
    about: "Состав чисел от 2 до 10. Ребёнок изучает, как каждое число раскладывается на два слагаемых.",
    conceptCount: 9,
    avatar: "media/avatar.svg",
  },
  cards: [2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => ({
    id: `house_${n}`,
    renderer: "math_houses",
    conceptId: `house_${n}`,
    primary: true,
    label: `Домик ${n}`,
    params: { number: n },
  })),
  modes: [
    {
      id: "math_houses_read",
      type: "math_houses_read",
      evaluation: "auto",
      ui: {
        title: "Читаю",
        instruction: "Собери пример по активному этажу",
        icon: "media/icons/math_houses_read.svg",
      },
    },
    {
      id: "math_houses",
      type: "math_houses",
      evaluation: "auto",
      ui: {
        title: "Дополняю",
        instruction: "Заполни состав числа по этажам",
        icon: "media/icons/math_houses.svg",
      },
    },
    {
      id: "math_houses_recall",
      type: "math_houses_recall",
      evaluation: "auto",
      ui: {
        title: "Вспоминаю",
        instruction: "Вспомни обе части числа",
        icon: "media/icons/math_houses_recall.svg",
      },
    },
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
    {
      id: "math_houses_grow",
      type: "math_houses_grow",
      evaluation: "auto",
      ui: {
        title: "Растущий домик",
        instruction: "Вспомни все пары числа",
        icon: "media/icons/math_houses_grow.svg",
      },
    },
  ],
};

// Copy SVG assets from the old ZIP
const oldBuf = readFileSync("public/decks/math_houses_v1.0.0.zip");
const oldZip = await JSZip.loadAsync(oldBuf);

const zip = new JSZip();
zip.file("topic.json", JSON.stringify(manifest, null, 2));

const assetFiles = [
  "media/avatar.svg",
  "media/icons/math_houses_read.svg",
  "media/icons/math_houses.svg",
  "media/icons/math_houses_recall.svg",
  "media/icons/math_houses_selective.svg",
  "media/icons/math_houses_grow.svg",
];

for (const path of assetFiles) {
  const data = await oldZip.file(path)?.async("uint8array");
  if (data) zip.file(path, data);
  else console.warn(`⚠ not found in old ZIP: ${path}`);
}

const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
const outPath = `public/decks/math_houses_v${VERSION}.zip`;
writeFileSync(outPath, buffer);
console.log(`✓ ${outPath} (${(buffer.length / 1024).toFixed(1)} KB)`);
