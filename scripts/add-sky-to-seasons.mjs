/**
 * Generates sky images for all 4 seasons and patches the deck ZIP:
 * - replaces "осенняя куртка" → "осеннее небо"
 * - replaces "зимняя куртка"  → "зимнее небо"
 * - replaces "весенняя куртка" → "весеннее небо"
 * - replaces "летние цветы"   → "летнее небо"
 * Usage: node scripts/add-sky-to-seasons.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";
import JSZip from "jszip";
import { getGeminiApiKey } from "./lib/gemini-key.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = path.join(__dirname, "..");
const DECKS_DIR = path.join(PROJECT, "public", "decks");

const API_KEY = getGeminiApiKey();
const MODEL = "gemini-3.1-flash-image";

const S =
  "soft children's book illustration, warm natural colors, gentle shading and subtle depth, " +
  "clean outlines but not flat, no text, no people, child-friendly, " +
  "main subject large and centered filling most of the frame, " +
  "easily recognizable at small size, square 1:1 composition";

const SKY_ITEMS = [
  {
    file: "item_osen_nebo.webp",
    adjPhrase: "осеннее небо",
    id: "item_osen_nebo",
    replaces: "item_osen_kurtka",
    season: "osen",
    prompt: `${S}, overcast autumn sky viewed from below — layers of soft gray-blue clouds tinged warm gold at the edges, a handful of golden-yellow autumn leaves drifting upward into the sky, melancholy yet cosy autumn mood`,
  },
  {
    file: "item_zima_nebo.webp",
    adjPhrase: "зимнее небо",
    id: "item_zima_nebo",
    replaces: "item_zima_kurtka",
    season: "zima",
    prompt: `${S}, crisp winter sky viewed from below — deep midnight blue fading to pale icy blue near the horizon, soft white snowflakes of various sizes drifting down, a pale full moon peeking through thin clouds, serene and cold`,
  },
  {
    file: "item_vesna_nebo.webp",
    adjPhrase: "весеннее небо",
    id: "item_vesna_nebo",
    replaces: "item_vesna_kurtka",
    season: "vesna",
    prompt: `${S}, bright cheerful spring sky viewed from below — vivid sky-blue with several large fluffy white cumulus clouds, a couple of small birds flying high, fresh and optimistic spring mood`,
  },
  {
    file: "item_leto_nebo.webp",
    adjPhrase: "летнее небо",
    id: "item_leto_nebo",
    replaces: "item_leto_cvety",
    season: "leto",
    prompt: `${S}, dazzling summer sky viewed from below — intense bright blue sky, a bold radiant sun with sharp golden rays in the upper corner, two or three small white clouds, hot vivid summer feeling`,
  },
];

async function callGemini(prompt) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": API_KEY },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { imageConfig: { aspectRatio: "1:1", imageSize: "1K" } },
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error?.message || `HTTP ${res.status}`);
  const parts = body?.candidates?.[0]?.content?.parts ?? [];
  const imgPart = parts.find((p) => p.inlineData?.mimeType?.startsWith("image/"));
  if (!imgPart) throw new Error("No image in response");
  return imgPart.inlineData.data;
}

async function generateSkyImage(item) {
  console.log(`  Generating ${item.file} ...`);
  const data = await callGemini(item.prompt);
  const buf = Buffer.from(data, "base64");
  const webp = await sharp(buf)
    .resize(512, 512, { fit: "cover", position: "center" })
    .webp({ quality: 87, effort: 5 })
    .toBuffer();
  console.log(`    ✓ ${Math.round(webp.length / 1024)} KB`);
  return webp;
}

function bumpVersion(v) {
  const parts = v.split(".");
  parts[2] = String(Number(parts[2]) + 1);
  return parts.join(".");
}

async function main() {
  // Find current ZIP
  const zips = fs.readdirSync(DECKS_DIR)
    .filter(f => f.startsWith("word_formation_soup_v") && f.endsWith(".zip"))
    .sort();
  if (!zips.length) throw new Error("No deck ZIP found");
  const currentZip = zips[zips.length - 1];
  console.log(`\nFound deck: ${currentZip}`);

  // Load ZIP
  const raw = fs.readFileSync(path.join(DECKS_DIR, currentZip));
  const zip = await JSZip.loadAsync(raw);
  const topicJson = await zip.file("topic.json").async("text");
  const data = JSON.parse(topicJson);

  // Bump version
  const oldVersion = data.version ?? "1.0.34";
  const newVersion = bumpVersion(oldVersion);
  data.version = newVersion;

  console.log(`\n=== Generating sky images ===`);
  const skyBuffers = {};
  for (const item of SKY_ITEMS) {
    try {
      skyBuffers[item.file] = await generateSkyImage(item);
      await new Promise(r => setTimeout(r, 1200));
    } catch (e) {
      console.error(`    ✗ ${item.file}: ${e.message}`);
      process.exit(1);
    }
  }

  console.log(`\n=== Patching topic.json ===`);
  // Patch each overview card
  for (const item of SKY_ITEMS) {
    const seasonId = `sea_${item.season}_overview`;
    const card = data.cards.find(c => c.id === seasonId);
    if (!card) { console.error(`Card not found: ${seasonId}`); continue; }

    const idx = card.items.findIndex(it => it.id === item.replaces);
    if (idx === -1) { console.error(`Item not found: ${item.replaces} in ${seasonId}`); continue; }

    const oldItem = card.items[idx];
    card.items[idx] = {
      id: item.id,
      adjPhrase: item.adjPhrase,
      image: `media/${item.file}`,
    };
    console.log(`  ${seasonId}: replaced ${oldItem.adjPhrase} → ${item.adjPhrase}`);
  }

  // Write patched topic.json
  zip.file("topic.json", JSON.stringify(data, null, 2));

  // Add sky images to ZIP
  console.log(`\n=== Adding images to ZIP ===`);
  for (const item of SKY_ITEMS) {
    zip.file(`media/${item.file}`, skyBuffers[item.file]);
    console.log(`  Added media/${item.file}`);
  }

  // Write new ZIP
  const newZipName = `word_formation_soup_v${newVersion}.zip`;
  const newZipPath = path.join(DECKS_DIR, newZipName);
  const newZipBuf = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
  fs.writeFileSync(newZipPath, newZipBuf);
  console.log(`\nWrote ${newZipName} (${Math.round(newZipBuf.length / 1024)} KB)`);

  // Update catalog.json
  const catalogPath = path.join(DECKS_DIR, "catalog.json");
  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  const entry = catalog.decks.find(d => d.id === "word_formation_soup");
  if (entry) {
    entry.version = newVersion;
    entry.file = newZipName;
    entry.url = `/decks/${newZipName}`;
    entry.zipUrl = `/decks/${newZipName}`;
    fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2));
    console.log(`Updated catalog.json → v${newVersion}`);
  }

  // Remove old ZIP
  const oldZipPath = path.join(DECKS_DIR, currentZip);
  if (fs.existsSync(oldZipPath)) {
    fs.unlinkSync(oldZipPath);
    console.log(`Removed old ZIP: ${currentZip}`);
  }

  console.log(`\nDone! word_formation_soup v${newVersion}`);
}

main().catch(e => { console.error(e); process.exit(1); });
