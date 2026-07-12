/**
 * Regenerates item_leto_shorty.webp (white bg) and item_leto_nebo.webp (sky scene).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";
import JSZip from "jszip";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DECKS = path.join(__dirname, "..", "public", "decks");
const API_KEY = "AIzaSyAfKpjiMTIMGugV-WYRN_Rhk7vRKyXl-_k";
const MODEL = "gemini-3.1-flash-image";

const ITEMS = [
  {
    key: "item_leto_shorty",
    prompt:
      "soft children's book illustration, " +
      "a pair of bright blue denim shorts for kids, lying flat or shown straight-on, " +
      "PURE WHITE BACKGROUND, no scene, no ground, no horizon, no shadow, no texture behind the shorts, " +
      "single isolated object centered in square, flat simple style, no people wearing them, " +
      "square 1:1 composition, child-friendly",
  },
  {
    key: "item_leto_nebo",
    prompt:
      "soft children's book illustration, " +
      "a view of bright summer sky with big fluffy white clouds and a cheerful yellow sun with rays, " +
      "sky-blue color fills the entire background, three large puffy white clouds in the foreground, " +
      "sun in upper corner with short golden rays, the clouds are the main subject — large and clearly visible, " +
      "flat simple style, no ground, no horizon line, no people, no text, " +
      "square 1:1 composition, child-friendly, warm summer feeling",
  },
];

async function generateImage(prompt) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": API_KEY },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { imageConfig: { aspectRatio: "1:1", imageSize: "1K" } },
      }),
    }
  );
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error?.message);
  const imgPart = body?.candidates?.[0]?.content?.parts?.find(
    (p) => p.inlineData?.mimeType?.startsWith("image/")
  );
  if (!imgPart) throw new Error("No image in response");
  return Buffer.from(imgPart.inlineData.data, "base64");
}

// Find latest ZIP (numeric semver sort)
const zips = fs
  .readdirSync(DECKS)
  .filter((f) => f.startsWith("word_formation_soup_v") && f.endsWith(".zip"))
  .sort((a, b) => {
    const v = (s) => s.match(/v(\d+)\.(\d+)\.(\d+)/)?.slice(1).map(Number) ?? [0, 0, 0];
    const [a1, a2, a3] = v(a), [b1, b2, b3] = v(b);
    return a1 - b1 || a2 - b2 || a3 - b3;
  });
const srcName = zips[zips.length - 1];
console.log(`Source: ${srcName}`);

const zip = await JSZip.loadAsync(fs.readFileSync(path.join(DECKS, srcName)));
const data = JSON.parse(await zip.file("topic.json").async("text"));

for (const item of ITEMS) {
  process.stdout.write(`  ${item.key}.webp ... `);
  const raw = await generateImage(item.prompt);
  const webp = await sharp(raw)
    .resize(512, 512, { fit: "cover" })
    .webp({ quality: 87, effort: 5 })
    .toBuffer();
  zip.file(`media/${item.key}.webp`, webp);
  console.log(`✓ ${Math.round(webp.length / 1024)} KB`);
}

const [maj, min, pat] = data.version.split(".").map(Number);
const newVer = `${maj}.${min}.${pat + 1}`;
data.version = newVer;
data.meta.version = newVer;
zip.file("topic.json", JSON.stringify(data, null, 2));

const outName = `word_formation_soup_v${newVer}.zip`;
const outBuf = await zip.generateAsync({
  type: "nodebuffer",
  compression: "DEFLATE",
  compressionOptions: { level: 6 },
});
fs.writeFileSync(path.join(DECKS, outName), outBuf);
fs.unlinkSync(path.join(DECKS, srcName));

const catPath = path.join(DECKS, "catalog.json");
const catalog = JSON.parse(fs.readFileSync(catPath, "utf8"));
const entry = catalog.decks.find((d) => d.id === "word_formation_soup");
entry.version = newVer;
entry.file = outName;
entry.url = `/decks/${outName}`;
entry.zipUrl = `/decks/${outName}`;
fs.writeFileSync(catPath, JSON.stringify(catalog, null, 2));

console.log(`Done → ${outName} (v${newVer})`);
