/**
 * generate-phrase-match-pilot.mjs
 * Builds phrase_match_pilot ZIP deck (text-only, no images).
 *
 * Usage:
 *   node scripts/generate-phrase-match-pilot.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import JSZip from "jszip";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT     = path.resolve(__dirname, "..");
const TOPIC_ID = "phrase_match_pilot";
const VERSION  = "2.1.0";
const ZIP_PATH = path.join(ROOT, "public", "decks", `${TOPIC_ID}_v${VERSION}.zip`);

// ── deck.json ─────────────────────────────────────────────────────────────────
const deck = {
  meta: {
    id: TOPIC_ID,
    version: VERSION,
    renderer: "phrase_match",
    title: { ru: "Точное чтение" },
    language: "ru",
    minAppVersion: "1.0.0",
  },
  modes: [
    {
      id: "match",
      type: "match",
      evaluation: "instant",
      ui: {
        title: { ru: "Сопоставить" },
        instruction: { ru: "Перетащи ответ к нужному вопросу" },
      },
    },
  ],
  groups: [
    {
      id: "prefix_cut",
      items: [
        { id: "cut_razrezat", phrase: "Что делают с листом, чтобы получить две части?", answer: "Лист разрезают пополам"    },
        { id: "cut_vyrezat",  phrase: "Что делают с бумагой, чтобы получить круг?",     answer: "Круг вырезают из бумаги"  },
        { id: "cut_rezat",    phrase: "Что делают с хлебом ножом перед едой?",           answer: "Хлеб режут на куски"      },
      ],
    },
    {
      id: "prefix_press",
      items: [
        { id: "press_vyzhimat", phrase: "Что делают с педалью, чтобы затормозить?",       answer: "Педаль выжимают ногой"    },
        { id: "press_otzhimat", phrase: "Что делают с тряпкой, чтобы убрать воду?",       answer: "Тряпку отжимают"          },
        { id: "press_zazhimat", phrase: "Что делают с носом при неприятном запахе?",       answer: "Нос зажимают пальцами"    },
      ],
    },
    {
      id: "prefix_close",
      items: [
        { id: "close_zakryvat",    phrase: "Что делают с банкой, накрывая её крышкой?",    answer: "Банку закрывают крышкой" },
        { id: "close_zakruchivat", phrase: "Что делают с крышкой, вращая её по кругу?",    answer: "Крышку закручивают"      },
        { id: "close_zapirat",     phrase: "Что делают с дверью, вставив ключ в замок?",   answer: "Дверь запирают на ключ"  },
      ],
    },
    {
      id: "prefix_lift",
      items: [
        { id: "lift_chemod",   phrase: "Что делают с тяжёлым чемоданом?",                 answer: "Чемодан поднимают"          },
        { id: "lift_stairs",   phrase: "Что делают, чтобы оказаться на верхнем этаже?",   answer: "Поднимаются по лестнице"    },
        { id: "lift_ruku",     phrase: "Что делают на уроке, чтобы ответить?",            answer: "Поднимают руку"             },
      ],
    },
    {
      id: "prefix_push",
      items: [
        { id: "push_vysovyvat",  phrase: "Что делают с головой в открытое окно?",          answer: "Голову высовывают в окно"       },
        { id: "push_zasovyvat",  phrase: "Что делают с ключом в замочную скважину?",       answer: "Ключ засовывают в замок"        },
        { id: "push_prosovyvat", phrase: "Что делают с ниткой в ушко иголки?",             answer: "Нитку просовывают в иголку"    },
      ],
    },
    {
      id: "prefix_fold",
      items: [
        { id: "fold_skladyvat",    phrase: "Что делают с чистым бельём после сушки?",      answer: "Бельё складывают"                     },
        { id: "fold_raskla",       phrase: "Что делают с вещами, убирая их в шкаф?",       answer: "Вещи раскладывают по полкам"          },
        { id: "fold_perekladyvat", phrase: "Что делают с вещами, меняя их местами?",       answer: "Вещи перекладывают с места на место"  },
      ],
    },
    {
      id: "po_physical",
      items: [
        { id: "po_postuchat", phrase: "Что делают кулаком перед тем, как войти?",          answer: "В дверь постучали"    },
        { id: "po_polomat",   phrase: "Что делают с сухой веткой, ломая её?",              answer: "Ветку поломали"       },
        { id: "po_pokrosit",  phrase: "Что делают с хлебом, измельчая его для птиц?",      answer: "Хлеб покрошили"       },
      ],
    },
    {
      id: "po_actions",
      items: [
        { id: "po_posolit",   phrase: "Что делают с едой, добавляя соль?",                 answer: "Еду посолили"       },
        { id: "po_pozvonit",  phrase: "Что делают, чтобы поговорить по телефону?",         answer: "Другу позвонили"    },
        { id: "po_poschitat", phrase: "Что делают с числами, чтобы узнать сумму?",         answer: "Числа посчитали"    },
      ],
    },
  ],
};

// ── Build ZIP ─────────────────────────────────────────────────────────────────
const zip = new JSZip();
zip.file("topic.json", JSON.stringify(deck, null, 2));

const zipBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
fs.writeFileSync(ZIP_PATH, zipBuffer);
console.log(`✓ ZIP saved: ${ZIP_PATH} (${(zipBuffer.length / 1024).toFixed(0)} KB)`);

// ── Update catalog.json ───────────────────────────────────────────────────────
const catalogPath = path.join(ROOT, "public", "decks", "catalog.json");
const catalog     = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
const entry = {
  id:       TOPIC_ID,
  version:  VERSION,
  renderer: "phrase_match",
  url:      `./decks/${TOPIC_ID}_v${VERSION}.zip`,
  title:       { ru: "Точное чтение" },
  description: { ru: "8 групп на глагольные приставки. Перетащи ответ к нужному вопросу." },
};
const idx = catalog.decks.findIndex(d => d.id === TOPIC_ID);
if (idx >= 0) catalog.decks[idx] = entry; else catalog.decks.push(entry);
fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2));
console.log("✓ catalog.json updated");
console.log("\nDone. Run 'npm run deploy:prod' to publish.");
