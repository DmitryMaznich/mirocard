/**
 * Generates real photos and audio for word_formation_soup deck.
 * Output: public/decks/word_formation_soup_v1.0.1.zip
 *
 * Credentials:
 *   GEMINI_API_KEY — from c:/Users/dmazn/Projects/Mirocard/.env.local
 *   Google TTS SA  — c:/Users/dmazn/Projects/Mirocard/cardgen-studio/credentials/google-tts-sa.json
 */

import { createSign } from "node:crypto";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import JSZip from "jszip";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, "..");
const CACHE_DIR = path.join(ROOT, ".cache", "word_formation_soup");

const TOPIC_ID  = "word_formation_soup";
const VERSION   = "1.0.12";
const ZIP_PATH  = path.join(ROOT, "public", "decks", `${TOPIC_ID}_v${VERSION}.zip`);
// Old ZIP cleaned up automatically in catalog update below

const GEMINI_KEY   = "AIzaSyAfKpjiMTIMGugV-WYRN_Rhk7vRKyXl-_k";
const GEMINI_MODEL = "gemini-2.5-flash-image";

const TTS_SA_PATH = "c:/Users/dmazn/Projects/Mirocard/cardgen-studio/credentials/google-tts-sa.json";
const TTS_VOICE   = "ru-RU-Wavenet-D";
const TTS_RATE    = 0.9;

const Q_SOUP  = "какой?";
const Q_JUICE = "какой?";
const Q_JAM   = "какое?";

const POT_PROMPT    = "a large stainless steel cooking pot on a gas stove with blue flame burning underneath, steam rising from the pot, kitchen setting, warm natural lighting, top-down 3/4 view, clean white background, square composition, no text, no watermark, photorealistic educational photo";
const JUICER_PROMPT = "a modern electric centrifugal juicer machine alone on a clean kitchen counter, NO glass of juice and NO fruit nearby, just the appliance by itself, white and stainless steel, bright natural lighting, square 1:1 composition, no text, no watermark, child-friendly educational photo";
const BASIN_PROMPT  = "a wide traditional enamel basin or preserving pan filled with boiling red berry jam, foam and bubbles on the surface, steam rising, classic Russian jam-making style, warm kitchen lighting, top-down 3/4 view, square composition, no text, no watermark, child-friendly educational photo";

const AVATAR_TOPIC_PROMPT      = "a simple flat cartoon icon: a whole fish on the left, a bold arrow pointing right, a steaming bowl of soup on the right, bright cheerful colors, thick outlines, white background, square 1:1 composition, no text, no letters, child-friendly educational icon";
const AVATAR_PAIR_INTRO_PROMPT = "a simple flat cartoon icon: two square flashcards side by side, left card shows a fish illustration, right card shows bold text-like marks suggesting a word, a small arrow pointing from left to right between them, bright cheerful colors, thick outlines, white background, square 1:1 composition, no text, no letters";
const AVATAR_PICK_FORM_PROMPT  = "a simple flat cartoon icon: a fish illustration at the top, below it four rounded rectangular buttons in a 2x2 grid, one button highlighted in green, the others in light grey, bright cheerful colors, thick outlines, white background, square 1:1 composition, no text, no letters, child-friendly";

// each concept must have: category, vesselImage, questionText, audioQuestion
const CONCEPTS = [
  // ── супы ────────────────────────────────────────────────────────────────────
  { id: "ryba",     noun: "рыба",     nounPhrase: "суп из рыбы",          adjPhrase: "рыбный суп",          difficulty: "easy",   color: "#2196F3", category: "soup", wrongForms: ["рыбовый суп", "рыбяной суп", "рыбский суп"],
    imgPrompt: "a steaming bowl of fish soup, clear broth with pieces of white fish and vegetables, rustic wooden table, warm natural lighting, top-down view, square composition, no text, no watermark",
    ingredientPrompt: "a fresh whole raw fish, lying on a rustic wooden table, warm natural lighting, top-down view, square composition, no text, no watermark, child-friendly educational photo" },
  { id: "myaso",    noun: "мясо",     nounPhrase: "суп из мяса",          adjPhrase: "мясной суп",          difficulty: "easy",   color: "#F44336", category: "soup", wrongForms: ["мясовый суп", "мяский суп", "мясяной суп"],
    imgPrompt: "a steaming bowl of meat soup, rich broth with chunks of tender beef, carrots, potatoes, rustic setting, warm natural lighting, top-down view, square composition, no text, no watermark",
    ingredientPrompt: "a piece of fresh raw beef meat, on a rustic wooden table, warm natural lighting, top-down view, square composition, no text, no watermark, child-friendly educational photo" },
  { id: "grib",     noun: "гриб",     nounPhrase: "суп из грибов",        adjPhrase: "грибной суп",         difficulty: "easy",   color: "#795548", category: "soup", wrongForms: ["грибовый суп", "грибовной суп", "грибяной суп"],
    imgPrompt: "a steaming bowl of mushroom soup, creamy or clear broth with sliced mushrooms and herbs, rustic wooden bowl, warm natural lighting, top-down view, square composition, no text, no watermark",
    ingredientPrompt: "a small pile of fresh whole champignon mushrooms, on a rustic wooden table, warm natural lighting, top-down view, square composition, no text, no watermark, child-friendly educational photo" },
  { id: "kapusta",  noun: "капуста",  nounPhrase: "суп из капусты",       adjPhrase: "капустный суп",       difficulty: "easy",   color: "#4CAF50", category: "soup", wrongForms: ["капустовый суп", "капустяной суп", "капустинный суп"],
    imgPrompt: "a steaming bowl of cabbage soup, clear broth with shredded cabbage and vegetables, rustic ceramic bowl, warm natural lighting, top-down view, square composition, no text, no watermark",
    ingredientPrompt: "a whole fresh white cabbage head, on a rustic wooden table, warm natural lighting, top-down view, square composition, no text, no watermark, child-friendly educational photo" },
  { id: "kuritsa",  noun: "курица",   nounPhrase: "суп из курицы",        adjPhrase: "куриный суп",         difficulty: "medium", color: "#FF9800", category: "soup", wrongForms: ["курочный суп", "курицовый суп", "куриской суп"],
    imgPrompt: "a steaming bowl of chicken soup, golden clear broth with chicken pieces, carrots, noodles, rustic setting, warm natural lighting, top-down view, square composition, no text, no watermark",
    ingredientPrompt: "a whole fresh raw chicken, on a rustic wooden table, warm natural lighting, top-down view, square composition, no text, no watermark, child-friendly educational photo" },
  { id: "goroh",    noun: "горох",    nounPhrase: "суп из гороха",        adjPhrase: "гороховый суп",       difficulty: "medium", color: "#8BC34A", category: "soup", wrongForms: ["горохный суп", "горошный суп", "горохистый суп"],
    imgPrompt: "a steaming bowl of pea soup, thick creamy green soup with split peas, rustic ceramic bowl, warm natural lighting, top-down view, square composition, no text, no watermark",
    ingredientPrompt: "fresh green peas in pods, a small pile, on a rustic wooden table, warm natural lighting, top-down view, square composition, no text, no watermark, child-friendly educational photo" },
  { id: "luk",      noun: "лук",      nounPhrase: "суп из лука",          adjPhrase: "луковый суп",         difficulty: "medium", color: "#9C27B0", category: "soup", wrongForms: ["лучный суп", "луковной суп", "луковист��й суп"],
    imgPrompt: "a steaming bowl of French onion soup, rich brown broth with caramelized onions and melted cheese crouton on top, rustic ceramic bowl, warm natural lighting, top-down view, square composition, no text, no watermark",
    ingredientPrompt: "a few whole onions, one peeled, on a rustic wooden table, warm natural lighting, top-down view, square composition, no text, no watermark, child-friendly educational photo" },
  { id: "ovoschi",  noun: "овощи",    nounPhrase: "суп из овощей",        adjPhrase: "овощной суп",         difficulty: "medium", color: "#009688", category: "soup", wrongForms: ["овощевый суп", "овощинный суп", "овощеской суп"],
    imgPrompt: "a steaming bowl of vegetable soup, colorful clear broth with carrots, peas, zucchini, tomatoes, rustic ceramic bowl, warm natural lighting, top-down view, square composition, no text, no watermark",
    ingredientPrompt: "a colorful mix of fresh vegetables: carrot, zucchini, tomato, bell pepper, arranged together on a rustic wooden table, warm natural lighting, top-down view, square composition, no text, no watermark, child-friendly educational photo" },
  { id: "fasolj",   noun: "фасоль",   nounPhrase: "суп из фасоли",        adjPhrase: "фасолевый суп",       difficulty: "hard",   color: "#E91E63", category: "soup", wrongForms: ["фасольный суп", "фасолинный суп", "фасоляной суп"],
    imgPrompt: "a steaming bowl of bean soup, thick soup with red and white beans, tomatoes and herbs, rustic ceramic bowl, warm natural lighting, top-down view, square composition, no text, no watermark",
    ingredientPrompt: "a small pile of dry red and white beans, on a rustic wooden table, warm natural lighting, top-down view, square composition, no text, no watermark, child-friendly educational photo" },
  { id: "tikva",    noun: "тыква",    nounPhrase: "суп из тыквы",         adjPhrase: "тыквенный суп",       difficulty: "hard",   color: "#FF6F00", category: "soup", wrongForms: ["тыквовый суп", "тыквяной суп", "тыквиный суп"],
    imgPrompt: "a steaming bowl of pumpkin soup, smooth bright orange creamy soup, rustic ceramic bowl with a swirl of cream and pumpkin seeds on top, warm natural lighting, top-down view, square composition, no text, no watermark",
    ingredientPrompt: "a small bright orange pumpkin and a slice showing the orange flesh, on a rustic wooden table, warm natural lighting, top-down view, square composition, no text, no watermark, child-friendly educational photo" },

  // ── соки ────────────────────────────────────────────────────────────────────
  { id: "yabloko",  noun: "яблоко",   nounPhrase: "сок из яблок",         adjPhrase: "яблочный сок",        difficulty: "easy",   color: "#8BC34A", category: "juice", wrongForms: ["яблоковый сок", "яблоньный сок", "яблочаный сок"],
    imgPrompt: "a tall clear glass of fresh apple juice, bright golden-yellow juice, a whole green apple beside the glass, white background, bright natural lighting, square composition, no text, no watermark",
    ingredientPrompt: "two fresh whole green apples, one whole and one cut in half showing the white flesh, on a white background, bright natural lighting, square composition, no text, no watermark, child-friendly educational photo" },
  { id: "morkov",   noun: "морковь",  nounPhrase: "сок из моркови",       adjPhrase: "морковный сок",       difficulty: "easy",   color: "#FF9800", category: "juice", wrongForms: ["морковочный сок", "морковистый сок", "морковяной сок"],
    imgPrompt: "a tall clear glass of fresh carrot juice, bright orange juice, a whole carrot beside the glass, white background, bright natural lighting, square composition, no text, no watermark",
    ingredientPrompt: "two fresh whole bright orange carrots with green tops, on a white background, bright natural lighting, square composition, no text, no watermark, child-friendly educational photo" },
  { id: "vinograd", noun: "виноград", nounPhrase: "сок из винограда",     adjPhrase: "виноградный сок",     difficulty: "medium", color: "#9C27B0", category: "juice", wrongForms: ["виноградовый сок", "виноградинный сок", "виноградской сок"],
    imgPrompt: "a tall clear glass of fresh grape juice, deep purple juice, a small bunch of dark purple grapes beside the glass, white background, bright natural lighting, square composition, no text, no watermark",
    ingredientPrompt: "a small bunch of dark purple grapes, glistening with freshness, on a white background, bright natural lighting, square composition, no text, no watermark, child-friendly educational photo" },
  { id: "apelsin",  noun: "апельсин", nounPhrase: "сок из апельсинов",    adjPhrase: "апельсиновый сок",    difficulty: "medium", color: "#FF5722", category: "juice", wrongForms: ["апельсинный сок", "апельсинской сок", "апельсинёный сок"],
    imgPrompt: "a tall clear glass of fresh orange juice, bright vivid orange juice with pulp, a whole orange and a halved orange beside the glass, white background, bright natural lighting, square composition, no text, no watermark",
    ingredientPrompt: "two fresh whole oranges and one halved orange showing the bright orange flesh, on a white background, bright natural lighting, square composition, no text, no watermark, child-friendly educational photo" },
  { id: "vishnya",  noun: "вишня",    nounPhrase: "сок из вишни",         adjPhrase: "вишнёвый сок",        difficulty: "hard",   color: "#E91E63", category: "juice", wrongForms: ["вишняной сок", "вишнинный сок", "вишневской сок"],
    imgPrompt: "a tall clear glass of fresh cherry juice, deep red cherry juice, a handful of dark red cherries with stems beside the glass, white background, bright natural lighting, square composition, no text, no watermark",
    ingredientPrompt: "a small pile of fresh dark red cherries with green stems, on a white background, bright natural lighting, square composition, no text, no watermark, child-friendly educational photo" },

  // ── варенье ─────────────────────────────────────────────────────────────────
  { id: "klubnika", noun: "клубника", nounPhrase: "варенье из клубники",  adjPhrase: "клубничное варенье",  difficulty: "easy",   color: "#E91E63", category: "jam", wrongForms: ["клубниковое варенье", "клубничаное варенье", "клубничковое варенье"],
    imgPrompt: "a glass jar of homemade strawberry jam, bright red jam with whole strawberry pieces, open jar with a wooden spoon, white background, bright natural lighting, square composition, no text, no watermark",
    ingredientPrompt: "a small pile of fresh ripe red strawberries, glistening and juicy, on a white background, bright natural lighting, square composition, no text, no watermark, child-friendly educational photo" },
  { id: "malina",   noun: "малина",   nounPhrase: "варенье из малины",    adjPhrase: "малиновое варенье",   difficulty: "easy",   color: "#F06292", category: "jam", wrongForms: ["м��линное варенье", "малиновное варенье", "малинистое варенье"],
    imgPrompt: "a glass jar of homemade raspberry jam, deep red-pink jam with raspberry pieces, open jar with a wooden spoon, white background, bright natural lighting, square composition, no text, no watermark",
    ingredientPrompt: "a small pile of fresh ripe red raspberries, on a white background, bright natural lighting, square composition, no text, no watermark, child-friendly educational photo" },
  { id: "sliva",    noun: "слива",    nounPhrase: "варенье из слив",      adjPhrase: "сливовое варенье",    difficulty: "medium", color: "#7B1FA2", category: "jam", wrongForms: ["сливное варенье", "сливяное варенье", "сливиновое варенье"],
    imgPrompt: "a glass jar of homemade plum jam, deep dark purple jam with plum pieces, open jar with a wooden spoon, white background, bright natural lighting, square composition, no text, no watermark",
    ingredientPrompt: "a few fresh whole dark purple plums, one cut in half showing the yellow flesh and stone, on a white background, bright natural lighting, square composition, no text, no watermark, child-friendly educational photo" },
  { id: "abrikos",  noun: "абрикос",  nounPhrase: "варенье из абрикосов", adjPhrase: "абрикосовое варенье", difficulty: "medium", color: "#FF9800", category: "jam", wrongForms: ["абрикосное варенье", "абрикосяное варенье", "абрикосинное варенье"],
    imgPrompt: "a glass jar of homemade apricot jam, bright golden-orange jam with apricot pieces, open jar with a wooden spoon, white background, bright natural lighting, square composition, no text, no watermark",
    ingredientPrompt: "a few fresh whole ripe orange apricots, one cut in half showing the stone, on a white background, bright natural lighting, square composition, no text, no watermark, child-friendly educational photo" },
  { id: "chernika", noun: "черника",  nounPhrase: "варенье из черники",   adjPhrase: "черничное варенье",   difficulty: "hard",   color: "#3F51B5", category: "jam", wrongForms: ["черниковое варенье", "черничаное варенье", "черничковое варенье"],
    imgPrompt: "a glass jar of homemade blueberry jam, deep dark blue-purple jam, open jar with a wooden spoon, white background, bright natural lighting, square composition, no text, no watermark",
    ingredientPrompt: "a small pile of fresh dark blue blueberries, on a white background, bright natural lighting, square composition, no text, no watermark, child-friendly educational photo" },
];

// ─── helpers ────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function ensureDir(p) { mkdirSync(p, { recursive: true }); }

function cached(name) { return path.join(CACHE_DIR, name); }

function isCached(name) { return existsSync(cached(name)); }

// ─── Gemini Imagen ───────────────────────────────────────────────────────────

async function generateImageFromPrompt(filename, prompt, label) {
  if (isCached(filename)) {
    console.log(`  [cache] image ${filename}`);
    return readFileSync(cached(filename));
  }

  process.stdout.write(`  [img]  ${label}: generating ... `);

  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { imageConfig: { aspectRatio: "1:1", imageSize: "1K" } },
      }),
    }
  );

  const body = await resp.json();
  if (!resp.ok) throw new Error(`Gemini ${resp.status}: ${body?.error?.message}`);

  const parts = body.candidates?.[0]?.content?.parts ?? [];
  const imgPart = parts.find(p => p.inlineData || p.inline_data);
  const inlineData = imgPart?.inlineData || imgPart?.inline_data;
  if (!inlineData?.data) throw new Error(`No image in response for ${label}`);

  const raw = Buffer.from(inlineData.data, "base64");
  const webp = await sharp(raw).resize(512, 512, { fit: "cover", position: "centre" }).webp({ quality: 82 }).toBuffer();

  writeFileSync(cached(filename), webp);
  console.log(`OK (${Math.round(webp.length / 1024)} KB)`);
  await sleep(500);
  return webp;
}

function generateSoupImage(concept) {
  return generateImageFromPrompt(`${concept.id}.webp`, concept.imgPrompt, concept.id);
}

function generateIngredientImage(concept) {
  return generateImageFromPrompt(`${concept.id}_ingredient.webp`, concept.ingredientPrompt, `${concept.id} (ingredient)`);
}

function generatePotImage() {
  return generateImageFromPrompt("pot.webp", POT_PROMPT, "pot");
}

// ─── Google Cloud TTS ────────────────────────────────────────────────────────

let _token = null, _tokenExp = 0;

async function getTtsToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  if (_token && now < _tokenExp - 60) return _token;

  const hdr = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const pay = Buffer.from(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: "https://oauth2.googleapis.com/token",
    iat: now, exp: now + 3600,
  })).toString("base64url");

  const signer = createSign("RSA-SHA256");
  signer.update(hdr + "." + pay);
  const jwt = hdr + "." + pay + "." + signer.sign(sa.private_key, "base64url");

  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=" + jwt,
  });
  const b = await r.json();
  if (!b.access_token) throw new Error("TTS token error: " + JSON.stringify(b));
  _token = b.access_token;
  _tokenExp = now + (b.expires_in || 3600);
  return _token;
}

async function tts(sa, text) {
  const token = await getTtsToken(sa);
  const r = await fetch("https://texttospeech.googleapis.com/v1/text:synthesize", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    body: JSON.stringify({
      input: { text },
      voice: { languageCode: "ru-RU", name: TTS_VOICE },
      audioConfig: { audioEncoding: "MP3", speakingRate: TTS_RATE },
    }),
  });
  const b = await r.json();
  if (!r.ok) throw new Error(`TTS ${r.status}: ${b?.error?.message}`);
  return Buffer.from(b.audioContent, "base64");
}

async function generateAudio(sa, concept, kind) {
  // kind: "prep" (Готовим суп из X) | "adj" (Рыбный суп)
  const text     = kind === "prep" ? `Готовим ${concept.nounPhrase}` : concept.adjPhrase;
  const filename = `${concept.id}_${kind}.mp3`;
  if (isCached(filename)) {
    console.log(`  [cache] audio ${filename}`);
    return readFileSync(cached(filename));
  }
  process.stdout.write(`  [tts]  ${filename}: "${text}" ... `);
  const buf = await tts(sa, text);
  writeFileSync(cached(filename), buf);
  console.log(`OK (${Math.round(buf.length / 1024)} KB)`);
  await sleep(200);
  return buf;
}

async function generateQuestionAudio(sa, text, filename) {
  if (isCached(filename)) {
    console.log(`  [cache] audio ${filename}`);
    return readFileSync(cached(filename));
  }
  process.stdout.write(`  [tts]  ${filename}: "${text}" ... `);
  const buf = await tts(sa, text);
  writeFileSync(cached(filename), buf);
  console.log(`OK (${Math.round(buf.length / 1024)} KB)`);
  await sleep(200);
  return buf;
}

const VESSEL = {
  soup:  { image: "media/pot.webp",    question: Q_SOUP,  audio: "audio/question_soup.mp3"  },
  juice: { image: "media/juicer.webp", question: Q_JUICE, audio: "audio/question_juice.mp3" },
  jam:   { image: "media/basin.webp",  question: Q_JAM,   audio: "audio/question_jam.mp3"   },
};

// ─── Build topic.json ────────────────────────────────────────────────────────

function buildTopic() {
  const cards = CONCEPTS.map(c => ({
    id:              c.id,
    category:        c.category,
    noun:            c.noun,
    nounPhrase:      c.nounPhrase,
    adjPhrase:       c.adjPhrase,
    difficulty:      c.difficulty,
    color:           c.color,
    image:           `media/${c.id}.webp`,
    ingredientImage: `media/${c.id}_ingredient.webp`,
    audioPrepPhrase: `audio/${c.id}_prep.mp3`,
    audioAdjPhrase:  `audio/${c.id}_adj.mp3`,
    vesselImage:     VESSEL[c.category].image,
    questionText:    VESSEL[c.category].question,
    audioQuestion:   VESSEL[c.category].audio,
    wrongForms:      c.wrongForms ?? [],
  }));

  return {
    meta: {
      id: TOPIC_ID, renderer: "word_formation", version: VERSION,
      title: { ru: "Словообразование" }, language: "ru",
      avatar: "media/avatar_topic.webp",
    },
    modes: [
      { id: "pair_intro", type: "pair_intro", evaluation: "none", requirePin: false,
        ui: { title: { ru: "Знакомство с парами" }, instruction: { ru: "Листайте пары: суп из … → … суп" }, icon: "media/avatar_pair_intro.webp" },
        params: {
          category:      { type: "enum", label: { ru: "Категория" }, values: ["soup", "juice", "jam", "all"], labels: { ru: { soup: "Суп", juice: "Сок", jam: "Варенье", all: "Все" } }, default: "soup" },
          exerciseAudio: { type: "boolean", label: { ru: "Проговаривать слова" }, default: true },
        },
      },
      { id: "pick_form", type: "pick_form", evaluation: "auto", requirePin: false,
        ui: { title: { ru: "Выбери правильную форму" }, instruction: { ru: "Нажми на правильное слово" }, icon: "media/avatar_pick_form.webp" },
        params: {
          category:      { type: "enum", label: { ru: "Категория" }, values: ["soup", "juice", "jam", "all"], labels: { ru: { soup: "Суп", juice: "Сок", jam: "Варенье", all: "Все" } }, default: "soup" },
          exerciseAudio: { type: "boolean", label: { ru: "Проговаривать слова" }, default: true },
          difficulty:    { type: "enum",    label: { ru: "Сложность дистракторов" }, values: ["easy", "hard"], labels: { ru: { easy: "Лёгкий: слова из разных пар", hard: "Сложный: похожие формы одного корня" } }, default: "easy" },
        },
      },
    ],
    cards,
  };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  ensureDir(CACHE_DIR);

  const sa = JSON.parse(readFileSync(TTS_SA_PATH, "utf8"));

  console.log("\n=== Генерация аватарок ===");
  const avatarTopic     = await generateImageFromPrompt("avatar_topic.webp",      AVATAR_TOPIC_PROMPT,      "avatar_topic");
  const avatarPairIntro = await generateImageFromPrompt("avatar_pair_intro.webp", AVATAR_PAIR_INTRO_PROMPT, "avatar_pair_intro");
  const avatarPickForm  = await generateImageFromPrompt("avatar_pick_form.webp",  AVATAR_PICK_FORM_PROMPT,  "avatar_pick_form");

  console.log("\n=== Генерация изображений ===");
  const vessels = {
    "media/pot.webp":    await generateImageFromPrompt("pot.webp",    POT_PROMPT,    "pot"),
    "media/juicer.webp": await generateImageFromPrompt("juicer.webp", JUICER_PROMPT, "juicer"),
    "media/basin.webp":  await generateImageFromPrompt("basin.webp",  BASIN_PROMPT,  "basin"),
  };
  const resultImages = {};
  const ingredientImages = {};
  for (const c of CONCEPTS) {
    resultImages[c.id]     = await generateImageFromPrompt(`${c.id}.webp`,            c.imgPrompt,        c.id);
    ingredientImages[c.id] = await generateImageFromPrompt(`${c.id}_ingredient.webp`, c.ingredientPrompt, `${c.id} (ingredient)`);
  }

  console.log("\n=== Генерация аудио ===");
  const questionAudios = {
    "audio/question_soup.mp3":  await generateQuestionAudio(sa, Q_SOUP,  "question_soup.mp3"),
    "audio/question_juice.mp3": await generateQuestionAudio(sa, Q_JUICE, "question_juice.mp3"),
    "audio/question_jam.mp3":   await generateQuestionAudio(sa, Q_JAM,   "question_jam.mp3"),
  };
  const audio = {};
  for (const c of CONCEPTS) {
    audio[`${c.id}_prep`] = await generateAudio(sa, c, "prep");
    audio[`${c.id}_adj`]  = await generateAudio(sa, c, "adj");
  }

  console.log("\n=== Упаковка ZIP ===");
  const topic = buildTopic();
  const zip = new JSZip();
  zip.file("topic.json", JSON.stringify(topic, null, 2));
  zip.file("media/avatar_topic.webp",      avatarTopic);
  zip.file("media/avatar_pair_intro.webp", avatarPairIntro);
  zip.file("media/avatar_pick_form.webp",  avatarPickForm);
  for (const [path, buf] of Object.entries(vessels))       zip.file(path, buf);
  for (const [path, buf] of Object.entries(questionAudios)) zip.file(path, buf);
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
  // Remove old versions of this deck AND the separate juice/jam decks
  catalog.decks = catalog.decks.filter(
    d => d.id !== TOPIC_ID && d.id !== "word_formation_juice" && d.id !== "word_formation_jam"
  );
  catalog.decks.push({
    id: TOPIC_ID, version: VERSION,
    url: `./decks/${TOPIC_ID}_v${VERSION}.zip`,
    zipUrl: `${TOPIC_ID}_v${VERSION}.zip`,
    title: { ru: "Словообразование" },
    renderer: "word_formation",
  });
  writeFileSync(catalogPath, JSON.stringify(catalog, null, 2));
  console.log("✓ catalog.json updated");
}

main().catch(e => { console.error(e); process.exit(1); });
