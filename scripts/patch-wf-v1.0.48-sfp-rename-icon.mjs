/**
 * Renames season_form_pick mode title to "Выбери окончание (времена года)"
 * and adds an SVG pictogram icon for it.
 *
 * Usage: node scripts/patch-wf-v1.0.48-sfp-rename-icon.mjs
 */
import fs from "fs";
import path from "path";
import JSZip from "jszip";

const ROOT      = "C:/Users/dmazn/Projects/Mirocard2";
const DECKS_DIR = path.join(ROOT, "public/decks");
const CATALOG   = path.join(DECKS_DIR, "catalog.json");
const SRC_ZIP   = "word_formation_soup_v1.0.47.zip";
const NEW_VER   = "1.0.48";
const DST_ZIP   = `word_formation_soup_v${NEW_VER}.zip`;
const ICON_PATH = "icons/season_form_pick.svg";

// SVG pictogram: 2×2 grid of adjective-ending buttons, one highlighted orange,
// with a small leaf silhouette to signal "seasons" context.
const ICON_SVG = `<svg viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- Background -->
  <rect width="52" height="52" rx="12" fill="#FBF4E8"/>

  <!-- Small autumn leaf at top-right -->
  <ellipse cx="40" cy="10" rx="7" ry="5" fill="#D4854A" opacity="0.85" transform="rotate(-35 40 10)"/>
  <line x1="40" y1="13" x2="38" y2="17" stroke="#B05518" stroke-width="1.2" stroke-linecap="round"/>

  <!-- Noun label bar -->
  <rect x="7" y="7" width="26" height="10" rx="5" fill="#E5D4B8"/>
  <rect x="11" y="10" width="14" height="3" rx="1.5" fill="#9B7B5A" opacity="0.55"/>
  <text x="28" y="15" font-family="sans-serif" font-size="5.5" font-weight="700"
        fill="#C06A20" text-anchor="start" dominant-baseline="middle">?</text>

  <!-- 2×2 button grid -->
  <!-- top-left: dim -->
  <rect x="7" y="22" width="17" height="12" rx="5" fill="#EDE0CA"/>
  <text x="15.5" y="29" font-family="sans-serif" font-size="5" font-weight="700"
        fill="#9B7B5A" text-anchor="middle" dominant-baseline="middle">ий</text>

  <!-- top-right: highlighted (correct) -->
  <rect x="28" y="22" width="17" height="12" rx="5" fill="#C06A20"/>
  <text x="36.5" y="29" font-family="sans-serif" font-size="5" font-weight="700"
        fill="#fff" text-anchor="middle" dominant-baseline="middle">ое</text>

  <!-- bottom-left: dim -->
  <rect x="7" y="37" width="17" height="12" rx="5" fill="#EDE0CA"/>
  <text x="15.5" y="44" font-family="sans-serif" font-size="5" font-weight="700"
        fill="#9B7B5A" text-anchor="middle" dominant-baseline="middle">яя</text>

  <!-- bottom-right: dim -->
  <rect x="28" y="37" width="17" height="12" rx="5" fill="#EDE0CA"/>
  <text x="36.5" y="44" font-family="sans-serif" font-size="5" font-weight="700"
        fill="#9B7B5A" text-anchor="middle" dominant-baseline="middle">ие</text>
</svg>`;

const srcZip   = await JSZip.loadAsync(fs.readFileSync(path.join(DECKS_DIR, SRC_ZIP)));
const srcTopic = JSON.parse(await srcZip.file("topic.json").async("string"));

// Add icon file to ZIP
srcZip.file(ICON_PATH, ICON_SVG);

// Update season_form_pick: rename title + set icon path
const updatedModes = srcTopic.modes.map(mode => {
  if (mode.id !== "season_form_pick") return mode;
  return {
    ...mode,
    ui: {
      ...mode.ui,
      title:       "Выбери окончание (времена года)",
      icon:        ICON_PATH,
    },
  };
});

const newTopic = {
  ...srcTopic,
  version: NEW_VER,
  meta: { ...srcTopic.meta, version: NEW_VER },
  modes: updatedModes,
};

srcZip.file("topic.json", JSON.stringify(newTopic, null, 2));

const buf = await srcZip.generateAsync({
  type: "nodebuffer",
  compression: "DEFLATE",
  compressionOptions: { level: 6 },
});
fs.writeFileSync(path.join(DECKS_DIR, DST_ZIP), buf);
console.log(`Wrote ${DST_ZIP} (${Math.round(buf.length / 1024)} KB)`);

const catalog = JSON.parse(fs.readFileSync(CATALOG, "utf8"));
const entry   = catalog.decks?.find(d => d.id === "word_formation_soup");
if (!entry) { console.error("word_formation_soup not found in catalog"); process.exit(1); }
entry.version = NEW_VER;
entry.url     = `./decks/${DST_ZIP}`;
if ("zipUrl" in entry) entry.zipUrl = DST_ZIP;
if ("file"   in entry) entry.file   = DST_ZIP;
fs.writeFileSync(CATALOG, JSON.stringify(catalog, null, 2) + "\n", "utf8");
console.log(`Updated catalog.json -> ${DST_ZIP} v${NEW_VER}`);

// Verify
const check = JSON.parse(await srcZip.file("topic.json").async("string"));
const sfp   = check.modes.find(m => m.id === "season_form_pick");
console.log("title:", sfp.ui.title);
console.log("icon: ", sfp.ui.icon);
console.log("icon file size:", ICON_SVG.length, "bytes");
