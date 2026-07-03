import sharp from "sharp";
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const handsDir  = path.resolve(__dirname, "../public/hands");

const pngs = readdirSync(handsDir).filter(f => f.endsWith(".png") && f.startsWith("hand_"));

let totalPng  = 0;
let totalWebp = 0;

for (const file of pngs) {
  const src  = path.join(handsDir, file);
  const dest = path.join(handsDir, file.replace(".png", ".webp"));

  const info = await sharp(src)
    .webp({ quality: 90, lossless: false })
    .toFile(dest);

  const pngSize  = (await import("node:fs")).statSync(src).size;
  const webpSize = info.size;
  totalPng  += pngSize;
  totalWebp += webpSize;

  console.log(
    `${file.padEnd(22)} → ${file.replace(".png",".webp").padEnd(23)}`
    + `  PNG: ${(pngSize/1024).toFixed(1)} KB  WebP: ${(webpSize/1024).toFixed(1)} KB`
    + `  (−${Math.round((1 - webpSize/pngSize)*100)}%)`
  );
}

console.log(
  `\nTotal: PNG ${(totalPng/1024).toFixed(0)} KB → WebP ${(totalWebp/1024).toFixed(0)} KB`
  + `  (−${Math.round((1 - totalWebp/totalPng)*100)}%)`
);
