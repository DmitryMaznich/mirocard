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
const VERSION  = "2.0.0";
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
      id: "soup",
      items: [
        { id: "soup_pour", phrase: "Чем наливают суп?",  answer: "Суп наливают половником"  },
        { id: "soup_eat",  phrase: "Чем едят суп?",       answer: "Суп едят ложкой"          },
        { id: "soup_cook", phrase: "В чём варят суп?",    answer: "Суп варят в кастрюле"     },
      ],
    },
    {
      id: "cut",
      items: [
        { id: "cut_bread", phrase: "Чем режут хлеб?",   answer: "Хлеб режут ножом"       },
        { id: "cut_paper", phrase: "Чем режут бумагу?", answer: "Бумагу режут ножницами" },
        { id: "cut_nails", phrase: "Чем режут ногти?",  answer: "Ногти режут щипчиками"  },
      ],
    },
    {
      id: "transport",
      items: [
        { id: "transp_road", phrase: "На чём едут по дороге?", answer: "По дороге едут на автобусе" },
        { id: "transp_sky",  phrase: "На чём летят по небу?",  answer: "По небу летят на самолёте"  },
        { id: "transp_sea",  phrase: "На чём плывут по морю?", answer: "По морю плывут на корабле"  },
      ],
    },
    {
      id: "clothing",
      items: [
        { id: "cloth_wash", phrase: "Чем стирают одежду?", answer: "Одежду стирают в машине"  },
        { id: "cloth_iron", phrase: "Чем гладят одежду?",  answer: "Одежду гладят утюгом"     },
        { id: "cloth_dry",  phrase: "Где сушат одежду?",   answer: "Одежду сушат на верёвке"  },
      ],
    },
    {
      id: "play",
      items: [
        { id: "play_with",  phrase: "С кем играет девочка?",  answer: "Девочка играет с подругой"  },
        { id: "play_where", phrase: "Где играет девочка?",    answer: "Девочка играет на площадке" },
        { id: "play_what",  phrase: "Во что играет девочка?", answer: "Девочка играет в мяч"       },
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
  description: { ru: "5 групп похожих фраз. Перетащи ответ к нужному вопросу." },
};
const idx = catalog.decks.findIndex(d => d.id === TOPIC_ID);
if (idx >= 0) catalog.decks[idx] = entry; else catalog.decks.push(entry);
fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2));
console.log("✓ catalog.json updated");
console.log("\nDone. Run 'npm run deploy:prod' to publish.");
