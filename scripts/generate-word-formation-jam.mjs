/**
 * Generates photos and audio for word_formation_jam deck.
 * Output: public/decks/word_formation_jam_v1.0.0.zip
 */

import { createSign } from "node:crypto";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import JSZip from "jszip";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, "..");
const CACHE_DIR = path.join(ROOT, ".cache", "word_formation_jam");

const TOPIC_ID  = "word_formation_jam";
const VERSION   = "1.0.0";
const ZIP_PATH  = path.join(ROOT, "public", "decks", `${TOPIC_ID}_v${VERSION}.zip`);

const GEMINI_KEY   = "AIzaSyAfKpjiMTIMGugV-WYRN_Rhk7vRKyXl-_k";
const GEMINI_MODEL = "gemini-2.5-flash-image";

const TTS_SA_PATH = "c:/Users/dmazn/Projects/Mirocard/cardgen-studio/credentials/google-tts-sa.json";
const TTS_VOICE   = "ru-RU-Wavenet-D";
const TTS_RATE    = 0.9;

const QUESTION_TEXT = "Какое варенье получится?";
const VESSEL_IMAGE  = "media/basin.webp";

const BASIN_PROMPT = "a wide traditional enamel basin or preserving pan filled with boiling red berry jam, foam and bubbles on the surface, steam rising, classic Russian jam-making style, warm kitchen lighting, top-down 3/4 view, square composition, no text, no watermark, child-friendly educational photo";

const CONCEPTS = [
  { id: "klubnika",  noun: "клубника",  nounPhrase: "варенье из клубники",  adjPhrase: "клубничное варенье",  difficulty: "easy",   color: "#E91E63",
    imgPrompt: "a glass jar of homemade strawberry jam, bright red jam with whole strawberry pieces, open jar with a wooden spoon, white background, bright natural lighting, square composition, no text, no watermark",
    ingredientPrompt: "a small pile of fresh ripe red strawberries, glistening and juicy, on a white background, bright natural lighting, square composition, no text, no watermark, child-friendly educational photo" },
  { id: "malina",    noun: "малина",    nounPhrase: "варенье из малины",    adjPhrase: "малиновое варенье",   difficulty: "easy",   color: "#E91E63",
    imgPrompt: "a glass jar of homemade raspberry jam, deep red-pink jam with raspberry pieces, open jar with a wooden spoon, white background, bright natural lighting, square composition, no text, no watermark",
    ingredientPrompt: "a small pile of fresh ripe red raspberries, on a white background, bright natural lighting, square composition, no text, no watermark, child-friendly educational photo" },
  { id: "sliva",     noun: "слива",     nounPhrase: "варенье из слив",      adjPhrase: "сливовое варенье",    difficulty: "medium", color: "#9C27B0",
    imgPrompt: "a glass jar of homemade plum jam, deep dark purple jam with plum pieces, open jar with a wooden spoon, white background, bright natural lighting, square composition, no text, no watermark",
    ingredientPrompt: "a few fresh whole dark purple plums, one cut in half showing the yellow flesh and stone, on a white background, bright natural lighting, square composition, no text, no watermark, child-friendly educational photo" },
  { id: "abrikos",   noun: "абрикос",   nounPhrase: "варенье из абрикосов", adjPhrase: "абрикосовое варенье", difficulty: "medium", color: "#FF9800",
    imgPrompt: "a glass jar of homemade apricot jam, bright golden-orange jam with apricot pieces, open jar with a wooden spoon, white background, bright natural lighting, square composition, no text, no watermark",
    ingredientPrompt: "a few fresh whole ripe orange apricots, one cut in half showing the stone, on a white background, bright natural lighting, square composition, no text, no watermark, child-friendly educational photo" },
  { id: "chernika",  noun: "черника",   nounPhrase: "варенье из черники",   adjPhrase: "черничное варенье",   difficulty: "hard",   color: "#3F51B5",
    imgPrompt: "a glass jar of homemade blueberry jam, deep dark blue-purple jam, open jar with a wooden spoon, white background, bright natural lighting, square composition, no text, no watermark",
    ingredientPrompt: "a small pile of fresh dark blue blueberries, some on a small branch, on a white background, bright natural lighting, square composition, no text, no watermark, child-friendly educational photo" },
];

// ─── helpers ────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function ensureDir(p) { mkdirSync(p, { recursive: true }); }
function cached(name) { return path.join(CACHE_DIR, name); }
function isCached(name) { return existsSync(cached(name)); }

// ─── Gemini Imagen ───────────────────────────────────────────────────────────

async function generateImageFromPrompt(filename, prompt, label) {
  if (isCached(filename)) { console.log(`  [cache] image ${filename}`); return readFileSync(cached(filename)); }
  process.stdout.write(`  [img]  ${label}: generating ... `);
  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`,
    { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { imageConfig: { aspectRatio: "1:1", imageSize: "1K" } } }) }
  );
  const body = await resp.json();
  if (!resp.ok) throw new Error(`Gemini ${resp.status}: ${body?.error?.message}`);
  const parts = body.candidates?.[0]?.content?.parts ?? [];
  const imgPart = parts.find(p => p.inlineData || p.inline_data);
  const inlineData = imgPart?.inlineData || imgPart?.inline_data;
  if (!inlineData?.data) throw new Error(`No image for ${label}`);
  const raw  = Buffer.from(inlineData.data, "base64");
  const webp = await sharp(raw).resize(512, 512, { fit: "cover", position: "centre" }).webp({ quality: 82 }).toBuffer();
  writeFileSync(cached(filename), webp);
  console.log(`OK (${Math.round(webp.length / 1024)} KB)`);
  await sleep(500);
  return webp;
}

// ─── Google Cloud TTS ────────────────────────────────────────────────────────

let _token = null, _tokenExp = 0;

async function getTtsToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  if (_token && now < _tokenExp - 60) return _token;
  const hdr = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const pay = Buffer.from(JSON.stringify({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/cloud-platform", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 })).toString("base64url");
  const signer = createSign("RSA-SHA256");
  signer.update(hdr + "." + pay);
  const jwt = hdr + "." + pay + "." + signer.sign(sa.private_key, "base64url");
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=" + jwt });
  const b = await r.json();
  if (!b.access_token) throw new Error("TTS token error: " + JSON.stringify(b));
  _token = b.access_token; _tokenExp = now + (b.expires_in || 3600);
  return _token;
}

async function tts(sa, text) {
  const token = await getTtsToken(sa);
  const r = await fetch("https://texttospeech.googleapis.com/v1/text:synthesize", {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    body: JSON.stringify({ input: { text }, voice: { languageCode: "ru-RU", name: TTS_VOICE }, audioConfig: { audioEncoding: "MP3", speakingRate: TTS_RATE } }),
  });
  const b = await r.json();
  if (!r.ok) throw new Error(`TTS ${r.status}: ${b?.error?.message}`);
  return Buffer.from(b.audioContent, "base64");
}

async function generateAudio(sa, concept, kind) {
  const text     = kind === "prep" ? `Готовим ${concept.nounPhrase}` : concept.adjPhrase;
  const filename = `${concept.id}_${kind}.mp3`;
  if (isCached(filename)) { console.log(`  [cache] audio ${filename}`); return readFileSync(cached(filename)); }
  process.stdout.write(`  [tts]  ${filename}: "${text}" ... `);
  const buf = await tts(sa, text);
  writeFileSync(cached(filename), buf);
  console.log(`OK (${Math.round(buf.length / 1024)} KB)`);
  await sleep(200);
  return buf;
}

async function generateQuestionAudio(sa) {
  const filename = "question.mp3";
  if (isCached(filename)) { console.log(`  [cache] audio ${filename}`); return readFileSync(cached(filename)); }
  process.stdout.write(`  [tts]  ${filename}: "${QUESTION_TEXT}" ... `);
  const buf = await tts(sa, QUESTION_TEXT);
  writeFileSync(cached(filename), buf);
  console.log(`OK (${Math.round(buf.length / 1024)} KB)`);
  await sleep(200);
  return buf;
}

// ─── Build topic.json ────────────────────────────────────────────────────────

function buildTopic() {
  const cards = CONCEPTS.map(c => ({
    id:              c.id,
    noun:            c.noun,
    nounPhrase:      c.nounPhrase,
    adjPhrase:       c.adjPhrase,
    difficulty:      c.difficulty,
    color:           c.color,
    image:           `media/${c.id}.webp`,
    ingredientImage: `media/${c.id}_ingredient.webp`,
    audioPrepPhrase: `audio/${c.id}_prep.mp3`,
    audioAdjPhrase:  `audio/${c.id}_adj.mp3`,
    vesselImage:     VESSEL_IMAGE,
    questionText:    QUESTION_TEXT,
  }));

  return {
    meta: {
      id: TOPIC_ID, renderer: "word_formation", version: VERSION,
      title: { ru: "Варенье: словообразование", en: "Jam: word formation" }, language: "ru",
      vesselImage:   VESSEL_IMAGE,
      questionAudio: "audio/question.mp3",
      questionText:  QUESTION_TEXT,
    },
    modes: [
      { id: "pair_intro",   type: "pair_intro",   evaluation: "none", requirePin: false,
        ui: { title: { ru: "Знакомство с парами" }, instruction: { ru: "Листайте пары: варенье из … → … варенье" } } },
      { id: "form_it",      type: "form_it",      evaluation: "auto", requirePin: false,
        ui: { title: { ru: "Образуй прилагательное" }, instruction: { ru: "Нажми на правильное слово" } },
        params: { stimulus: { type: "enum", label: { ru: "Стимул" }, values: ["phrase","image","mixed"], default: "mixed" }, optionCount: { type: "enum", label: { ru: "Вариантов" }, values: [2,3,4], default: 4 } },
      },
      { id: "yes_no",       type: "yes_no",       evaluation: "auto", requirePin: false,
        ui: { title: { ru: "Правильно / Нет?" }, instruction: { ru: "Это правильное словосочетание?" } },
        params: { repsPerConcept: { type: "number", label: { ru: "Повторений" }, default: 1, min: 1, max: 5 } },
      },
      { id: "question_ask", type: "question_ask", evaluation: "none", requirePin: true,
        ui: { title: { ru: "Назови варенье" }, instruction: { ru: "Логопед задаёт вопрос устно" } },
      },
    ],
    cards,
  };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  ensureDir(CACHE_DIR);
  const sa = JSON.parse(readFileSync(TTS_SA_PATH, "utf8"));

  console.log("\n=== Генерация изображений ===");
  const basinImage = await generateImageFromPrompt("basin.webp", BASIN_PROMPT, "basin");
  const resultImages = {};
  const ingredientImages = {};
  for (const c of CONCEPTS) {
    resultImages[c.id]     = await generateImageFromPrompt(`${c.id}.webp`,            c.imgPrompt,        c.id);
    ingredientImages[c.id] = await generateImageFromPrompt(`${c.id}_ingredient.webp`, c.ingredientPrompt, `${c.id} (ingredient)`);
  }

  console.log("\n=== Генерация аудио ===");
  const questionAudio = await generateQuestionAudio(sa);
  const audio = {};
  for (const c of CONCEPTS) {
    audio[`${c.id}_prep`] = await generateAudio(sa, c, "prep");
    audio[`${c.id}_adj`]  = await generateAudio(sa, c, "adj");
  }

  console.log("\n=== Упаковка ZIP ===");
  const topic = buildTopic();
  const zip = new JSZip();
  zip.file("topic.json", JSON.stringify(topic, null, 2));
  zip.file(VESSEL_IMAGE, basinImage);
  zip.file("audio/question.mp3", questionAudio);
  for (const c of CONCEPTS) {
    zip.file(`media/${c.id}.webp`,            resultImages[c.id]);
    zip.file(`media/${c.id}_ingredient.webp`, ingredientImages[c.id]);
    zip.file(`audio/${c.id}_prep.mp3`,        audio[`${c.id}_prep`]);
    zip.file(`audio/${c.id}_adj.mp3`,         audio[`${c.id}_adj`]);
  }

  const buf = await zip.generateAsync({ type: "nodebuffer" });
  writeFileSync(ZIP_PATH, buf);
  console.log(`✓ ${ZIP_PATH} (${(buf.length / 1024).toFixed(0)} KB)`);

  const catalogPath = path.join(ROOT, "public", "decks", "catalog.json");
  const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
  catalog.decks = catalog.decks.filter(d => d.id !== TOPIC_ID);
  catalog.decks.push({
    id: TOPIC_ID, version: VERSION,
    url: `./decks/${TOPIC_ID}_v${VERSION}.zip`,
    zipUrl: `${TOPIC_ID}_v${VERSION}.zip`,
    title: { ru: "Варенье: словообразование", en: "Jam: word formation" },
    renderer: "word_formation",
  });
  writeFileSync(catalogPath, JSON.stringify(catalog, null, 2));
  console.log("✓ catalog.json updated");
}

main().catch(e => { console.error(e); process.exit(1); });
