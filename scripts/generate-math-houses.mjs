import JSZip from "jszip";
import { writeFileSync, readFileSync } from "node:fs";

const VERSION = "1.2.0";

// One color per house so numbers 2-10 read as distinct houses on the street.
// The roof stays blue (hardcoded in the renderer's SVG) regardless of this —
// only the house body uses --house-color. Kept clear of green/red/amber,
// which are reserved for correct/wrong/focus feedback.
const HOUSE_COLORS = {
  2: "#7c6fd6",  // violet
  3: "#d1637f",  // rose
  4: "#c97a3d",  // burnt orange
  5: "#2f9e8f",  // teal
  6: "#a756b0",  // orchid
  7: "#a97449",  // clay
  8: "#2f8f9e",  // cyan-teal
  9: "#8c3d5e",  // mulberry
  10: "#5b4d9e", // indigo
};

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
    params: { number: n, color: HOUSE_COLORS[n] },
  })),
  modes: [
    {
      id: "math_houses_practice",
      type: "math_houses_practice",
      evaluation: "auto",
      ui: {
        title: "Домик",
        instruction: "Работай с домиком числа",
        icon: "media/icons/math_houses.svg",
      },
      params: {
        subtype: {
          type: "enum",
          values: ["fill", "read", "recall", "selective"],
          labels: {
            ru: {
              fill:      "Дополняю",
              read:      "Читаю",
              recall:    "Вспоминаю",
              selective: "Выборочно",
            },
          },
          default: "fill",
          label: { ru: "Задание" },
        },
        hiddenWindows: {
          type: "number",
          min: 1,
          max: 6,
          default: 1,
          label: { ru: "Скрытых окон" },
          showWhen: { subtype: "selective" },
        },
        shufflePairs: {
          type: "boolean",
          default: false,
          label: { ru: "Перемешивать пары" },
          hint: { ru: "Не показывать пары подряд по порядку" },
          showWhen: { subtype: "selective" },
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

// Copy SVG assets from the previous ZIP
const oldBuf = readFileSync("public/decks/math_houses_v1.1.0.zip");
const oldZip = await JSZip.loadAsync(oldBuf);

const zip = new JSZip();
zip.file("topic.json", JSON.stringify(manifest, null, 2));

const assetFiles = [
  "media/avatar.svg",
  "media/icons/math_houses.svg",
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
