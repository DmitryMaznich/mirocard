import fs from "fs";
import sharp from "sharp";
import { getGeminiApiKey } from "./lib/gemini-key.mjs";

const API_KEY = getGeminiApiKey();
const MODEL   = "gemini-3.1-flash-image";

const PROMPT =
  "soft children's book illustration, a cheerful cartoon fish on the left " +
  "with a red arrow pointing right to a steaming bowl of colorful soup, " +
  "warm natural colors, gentle shading, clean outlines, white background, " +
  "no border, no frame, no rounded rectangle, no dark outline around the whole image, " +
  "child-friendly, square 1:1 composition, easily recognizable at small size";

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
if (!res.ok) { console.error(body?.error); process.exit(1); }
const parts = body?.candidates?.[0]?.content?.parts ?? [];
const imgPart = parts.find(p => p.inlineData?.mimeType?.startsWith("image/"));
if (!imgPart) { console.error("No image in response", JSON.stringify(parts).slice(0, 300)); process.exit(1); }

const buf  = Buffer.from(imgPart.inlineData.data, "base64");
const webp = await sharp(buf).resize(512, 512, { fit: "cover" }).webp({ quality: 90 }).toBuffer();
const OUT = "scripts/avatar_topic_new.webp";
fs.writeFileSync(OUT, webp);
console.log("saved", OUT, webp.length, "bytes");
