/**
 * Regenerates item_leto_nebo.webp with a blue sky background.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";
import JSZip from "jszip";
import { getGeminiApiKey } from "./lib/gemini-key.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DECKS = path.join(__dirname, "..", "public", "decks");
const API_KEY = getGeminiApiKey();
const MODEL = "gemini-3.1-flash-image";

const PROMPT =
  "soft children's book illustration, sky-blue background filling the whole square, " +
  "a small cheerful sun with short golden rays tucked in the upper right corner, " +
  "two or three small puffy white clouds scattered across the blue, " +
  "flat simple style, no ground, no horizon line, no people, no text, " +
  "square 1:1 composition, child-friendly, warm summer feeling";

const res = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": API_KEY },
    body: JSON.stringify({
      contents: [{ parts: [{ text: PROMPT }] }],
      generationConfig: { imageConfig: { aspectRatio: "1:1", imageSize: "1K" } },
    }),
  }
);
const body = await res.json();
if (!res.ok) throw new Error(body?.error?.message);
const imgPart = body?.candidates?.[0]?.content?.parts?.find(p => p.inlineData?.mimeType?.startsWith("image/"));
if (!imgPart) throw new Error("No image");

const imgBuf = await sharp(Buffer.from(imgPart.inlineData.data, "base64"))
  .resize(512, 512, { fit: "cover" })
  .webp({ quality: 87, effort: 5 })
  .toBuffer();
console.log(`Generated: ${Math.round(imgBuf.length / 1024)} KB`);

// Find latest ZIP
const zips = fs.readdirSync(DECKS)
  .filter(f => f.startsWith("word_formation_soup_v") && f.endsWith(".zip"))
  .sort((a, b) => {
    const v = s => s.match(/v(\d+)\.(\d+)\.(\d+)/)?.slice(1).map(Number) ?? [0,0,0];
    const [a1,a2,a3] = v(a), [b1,b2,b3] = v(b);
    return a1-b1 || a2-b2 || a3-b3;
  });
const srcName = zips[zips.length - 1];
console.log(`Patching ${srcName}`);

const zip = await JSZip.loadAsync(fs.readFileSync(path.join(DECKS, srcName)));
const data = JSON.parse(await zip.file("topic.json").async("text"));
const [maj, min, pat] = data.version.split(".").map(Number);
const newVer = `${maj}.${min}.${pat + 1}`;
data.version = newVer;
data.meta.version = newVer;
zip.file("topic.json", JSON.stringify(data, null, 2));
zip.file("media/item_leto_nebo.webp", imgBuf);

const outName = `word_formation_soup_v${newVer}.zip`;
const outBuf = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
fs.writeFileSync(path.join(DECKS, outName), outBuf);
fs.unlinkSync(path.join(DECKS, srcName));

const catPath = path.join(DECKS, "catalog.json");
const catalog = JSON.parse(fs.readFileSync(catPath, "utf8"));
const entry = catalog.decks.find(d => d.id === "word_formation_soup");
entry.version = newVer; entry.file = outName;
entry.url = `/decks/${outName}`; entry.zipUrl = `/decks/${outName}`;
fs.writeFileSync(catPath, JSON.stringify(catalog, null, 2));

console.log(`Done → ${outName} (v${newVer})`);
