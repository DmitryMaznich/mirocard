/**
 * generate-finger-combos.mjs
 * «Покажи на пальцах» → «Пальцы → цифра», step 2: the same number shown with
 * different fingers (2 = thumb+index, index+pinky …). Draws the new poses in the
 * style of public/hands/hand_right_*.webp, passing the open hand and a folded pose
 * as references. Writes PNGs for review to tools/addition_subtraction/finger-combos/;
 * nothing goes into the app until the owner has approved the sheet.
 *
 *   node scripts/generate-finger-combos.mjs                 # all poses
 *   node scripts/generate-finger-combos.mjs --only=t_p      # one pose
 *   node scripts/generate-finger-combos.mjs --tries=3       # several drafts per pose
 *
 * Fingers are named t i m r p (thumb index middle ring pinky); a pose id lists the
 * raised ones. The drawings are a palm with the thumb on the LEFT of the image,
 * as the existing set (the child's own left hand, palm towards the child).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const HANDS = path.join(ROOT, "public", "hands");
const OUT = path.join(ROOT, "tools", "addition_subtraction", "finger-combos");
const MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-3-pro-image";
// The cloud sandbox's proxy injects the real key; elsewhere set GEMINI_API_KEY.
const API_KEY = process.env.GEMINI_API_KEY || "proxy-injected";

const ONLY = process.argv.find(a => a.startsWith("--only="))?.split("=")[1];
const TRIES = Number(process.argv.find(a => a.startsWith("--tries="))?.split("=")[1] ?? 1);

const NAMES = { t: "thumb", i: "index finger", m: "middle finger", r: "ring finger", p: "pinky" };

export const POSES = ["t", "p", "ti", "tp", "ip", "tim", "mrp", "timr"];

function describe(id) {
  const lines = Object.entries(NAMES).map(([f, name]) =>
    `- ${name[0].toUpperCase() + name.slice(1)}: ${id.includes(f) ? "RAISED (straight up)" : "FOLDED down into the palm"}`);
  const n = id.length;
  return `EXACTLY ${n} raised finger${n > 1 ? "s" : ""}, finger by finger (thumb is the leftmost):
${lines.join("\n")}
${id.includes("t") ? "" : "The THUMB is NOT raised and NOT spread to the side: it is bent and lies across the folded fingers, exactly like the thumb in reference 2. A thumb sticking out to the left counts as a raised finger and makes the picture wrong.\n"}Do NOT draw a familiar gesture (rock horns, "I love you", "OK", peace sign) unless it matches this list exactly.`;
}

const STYLE = `Flat digital illustration for a children's educational app.
Copy the style of the reference images EXACTLY: the same dark brown outline weight, the same flat
peach fill (#FBBF8A), no gradients, no shadows, the same palm lines, the same proportions.
The SAME hand as in the references: palm side towards the viewer, thumb on the LEFT of the image,
pinky on the RIGHT, wrist at the very bottom edge, hand centred, same size and same position.
Pure white background.`;

function prompt(id) {
  return `Reference 1: the hand with all five fingers raised. Reference 2: the same hand with two fingers
raised and the others folded — copy how folded fingers and the folded thumb look.

${STYLE}

POSE — ${describe(id)}
- Raised fingers stand straight up in exactly the place and length they have in reference 1.
- A folded finger is bent down onto the palm so only its curled tip shows; it must never look half-raised.
- A raised thumb points up-left like in reference 1; a folded thumb lies across the folded fingers like in reference 2.
- The pose must be one a child can really make with one hand.

CHECK before finishing: count the raised fingers — there must be exactly ${id.length}.`;
}

async function callGemini(parts) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": API_KEY },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { responseModalities: ["IMAGE", "TEXT"], imageConfig: { aspectRatio: "4:5" } },
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(body?.error ?? body).slice(0, 300));
  const part = (body.candidates?.[0]?.content?.parts ?? []).find(p => p?.inlineData || p?.inline_data);
  const data = (part?.inlineData ?? part?.inline_data)?.data;
  if (!data) throw new Error("no image: " + JSON.stringify(body).slice(0, 300));
  return Buffer.from(data, "base64");
}

async function refPart(file) {
  const png = await sharp(path.join(HANDS, file)).flatten({ background: "#ffffff" }).png().toBuffer();
  return { inline_data: { mime_type: "image/png", data: png.toString("base64") } };
}

fs.mkdirSync(OUT, { recursive: true });
const refs = [await refPart("hand_right_5.webp"), await refPart("hand_right_2.webp")];
const poses = ONLY ? ONLY.split(",") : POSES;
for (const id of poses) {
  for (let k = 1; k <= TRIES; k++) {
    const file = path.join(OUT, TRIES > 1 ? `hand_${id}_${k}.png` : `hand_${id}.png`);
    process.stdout.write(`▶ ${path.basename(file)} … `);
    try {
      const raw = await callGemini([...refs, { text: prompt(id) }]);
      await sharp(raw).resize({ width: 512, height: 640, fit: "contain", background: "#ffffff" }).png().toFile(file);
      console.log("✓");
    } catch (e) { console.log("✗ " + e.message); }
  }
}
