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
        { id: "cut_razrezat", phrase: "Что разрезают, чтобы получить два куска?",  answer: "Лист разрезают пополам"   },
        { id: "cut_vyrezat",  phrase: "Что вырезают из бумаги?",                   answer: "Круг вырезают из бумаги"  },
        { id: "cut_rezat",    phrase: "Что режут ножом перед едой?",               answer: "Хлеб режут на куски"      },
      ],
    },
    {
      id: "prefix_press",
      items: [
        { id: "press_vyzhimat", phrase: "Что выжимают ногой при торможении?",     answer: "Педаль выжимают ногой"  },
        { id: "press_otzhimat", phrase: "Что отжимают после мытья полов?",        answer: "Тряпку отжимают"        },
        { id: "press_zazhimat", phrase: "Что зажимают при неприятном запахе?",    answer: "Нос зажимают пальцами"  },
      ],
    },
    {
      id: "prefix_close",
      items: [
        { id: "close_zakryvat",    phrase: "Что закрывают, опустив крышку сверху?",         answer: "Банку закрывают крышкой" },
        { id: "close_zakruchivat", phrase: "Что закручивают по часовой стрелке?",            answer: "Крышку закручивают"      },
        { id: "close_zapirat",     phrase: "Что запирают на ключ?",                          answer: "Дверь запирают на ключ"  },
      ],
    },
    {
      id: "prefix_lift",
      items: [
        { id: "lift_chemod",  phrase: "Что поднимают, когда едут в отпуск?",              answer: "Чемодан поднимают"       },
        { id: "lift_stairs",  phrase: "По чему поднимаются на верхний этаж?",             answer: "Поднимаются по лестнице" },
        { id: "lift_ruku",    phrase: "Что поднимают на уроке, чтобы ответить?",          answer: "Поднимают руку"          },
      ],
    },
    {
      id: "prefix_push",
      items: [
        { id: "push_vysovyvat",  phrase: "Что высовывают в открытое окно?",         answer: "Голову высовывают в окно"    },
        { id: "push_zasovyvat",  phrase: "Что засовывают в замочную скважину?",     answer: "Ключ засовывают в замок"     },
        { id: "push_prosovyvat", phrase: "Что просовывают в ушко иголки?",          answer: "Нитку просовывают в иголку"  },
      ],
    },
    {
      id: "prefix_fold",
      items: [
        { id: "fold_skladyvat",    phrase: "Что складывают после сушки?",                 answer: "Бельё складывают"                    },
        { id: "fold_raskla",       phrase: "Что раскладывают по полкам в шкафу?",         answer: "Вещи раскладывают по полкам"         },
        { id: "fold_perekladyvat", phrase: "Что перекладывают, меняя местами?",           answer: "Вещи перекладывают с места на место" },
      ],
    },
    {
      id: "po_physical",
      items: [
        { id: "po_postuchat", phrase: "Во что постучали перед входом?",             answer: "В дверь постучали" },
        { id: "po_polomat",   phrase: "Что поломали пополам?",                      answer: "Ветку поломали"    },
        { id: "po_pokrosit",  phrase: "Что покрошили для птиц?",                    answer: "Хлеб покрошили"    },
      ],
    },
    {
      id: "po_actions",
      items: [
        { id: "po_posolit",   phrase: "Что посолили на обед?",                      answer: "Еду посолили"    },
        { id: "po_pozvonit",  phrase: "Кому позвонили по телефону?",                answer: "Другу позвонили" },
        { id: "po_poschitat", phrase: "Что посчитали, чтобы узнать сумму?",         answer: "Числа посчитали" },
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
