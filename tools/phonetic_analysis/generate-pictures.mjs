// Picture candidates for «Буквы и звуки» via Gemini, the same way as
// tools/learn_slovene/generate-photos.mjs: a realistic photo of one thing on a
// plain light background, several variants per word; the owner picks one per
// word on the contact sheet (candidates/sheet.html), pick-pictures.mjs copies
// the picks to media/<word>.webp, and build.mjs uses them instead of emoji.
// The key: GEMINI_API_KEY, or the cloud proxy's network secret for
// generativelanguage.googleapis.com (then any placeholder value is replaced).
// In a cloud session run with NODE_USE_ENV_PROXY=1, otherwise Node's fetch bypasses
// the proxy and the key is not injected ("API key not valid").
// Usage: NODE_USE_ENV_PROXY=1 node tools/phonetic_analysis/generate-pictures.mjs [--words=кот,дом] [--n=2] [--force]
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const DIR = dirname(fileURLToPath(import.meta.url));
const OUT = join(DIR, "candidates");
const API_KEY = process.env.GEMINI_API_KEY || "via-proxy";
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash-image";
const args = process.argv.slice(2);
const arg = (name) => args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
const ONLY = arg("words") ? new Set(arg("words").split(",")) : null;
const N = Number(arg("n") || 2);
const FORCE = args.includes("--force");

// Unambiguous for a child who will name it in one word: one thing, nothing else.
const STYLE = "realistic photograph for a children's speech-therapy picture card, one single subject centered and "
  + "filling about two thirds of a square frame, plain very light neutral background, soft even daylight, sharp focus, "
  + "typical everyday look a young child in Russia would recognise at once, "
  + "no text, no letters, no logos, no labels, no other objects";
const VARIANT = ["", "a different typical example, different colour and angle than usual"];

const words = JSON.parse(readFileSync(join(DIR, "words.json"), "utf8")).words
  .filter((w) => !ONLY || ONLY.has(w.id));

async function generate(prompt) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": API_KEY },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { imageConfig: { aspectRatio: "1:1" } } }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error?.message || `HTTP ${res.status}`);
  const part = (body.candidates?.[0]?.content?.parts ?? []).find((p) => p?.inlineData || p?.inline_data);
  const data = (part?.inlineData ?? part?.inline_data)?.data;
  if (!data) throw new Error("no image returned");
  return Buffer.from(data, "base64");
}

mkdirSync(OUT, { recursive: true });
const jobs = words.flatMap((w) => Array.from({ length: N }, (_, i) => ({ w, n: i + 1 })))
  .filter((j) => FORCE || !existsSync(join(OUT, `${j.w.id}_${j.n}.webp`)));
console.log(`${jobs.length} pictures to generate`);

let next = 0;
async function worker() {
  while (next < jobs.length) {
    const { w, n } = jobs[next++];
    const prompt = `${STYLE}. Subject: ${w.pic} (Russian word «${w.word}»). ${VARIANT[n - 1] ?? VARIANT[1]}`;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const png = await generate(prompt);
        writeFileSync(join(OUT, `${w.id}_${n}.webp`), await sharp(png).resize(512, 512, { fit: "cover" }).webp({ quality: 82 }).toBuffer());
        console.log(`ok   ${w.id}_${n}`);
        break;
      } catch (err) {
        console.log(`fail ${w.id}_${n} (${attempt}): ${err.message}`);
        if (attempt < 3) await new Promise((r) => setTimeout(r, 3000 * attempt));
      }
    }
  }
}
await Promise.all(Array.from({ length: 4 }, worker));

// Contact sheet: every word with its candidates; the current pick is outlined.
const all = JSON.parse(readFileSync(join(DIR, "words.json"), "utf8")).words;
const files = new Set(readdirSync(OUT));
const rows = all.map((w) => {
  const imgs = [...Array(4).keys()].map((i) => `${w.id}_${i + 1}.webp`).filter((f) => files.has(f));
  const picked = existsSync(join(DIR, "media", `${w.id}.webp`));
  return `<div class="w${picked ? " picked" : ""}"><b>${w.word}</b> <small>${w.pic}</small><div>${imgs.map((f) => `<figure><img src="${f}"><figcaption>${f.replace(".webp", "").split("_")[1]}</figcaption></figure>`).join("") || "<i>нет</i>"}</div></div>`;
}).join("\n");
writeFileSync(join(OUT, "sheet.html"), `<!DOCTYPE html><meta charset="utf-8"><title>Буквы и звуки — картинки</title>
<style>body{font-family:sans-serif;background:#f3f1ea;margin:16px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:10px}
.w{background:#fff;border-radius:10px;padding:8px}.w.picked{outline:3px solid #22c55e}.w b{font-size:20px}.w small{color:#6b7280}
.w div{display:flex;gap:6px;margin-top:6px}figure{margin:0;text-align:center}img{width:140px;height:140px;border-radius:8px;object-fit:cover}
figcaption{font-weight:700}</style><div class="grid">${rows}</div>`);
console.log("sheet:", join(OUT, "sheet.html"));
