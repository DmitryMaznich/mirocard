import JSZip from "jszip";
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const root  = join(__dir, "..", "..");

// Build the renderer IIFE bundle
console.log("Building renderer…");
execSync("npm run build:renderer", {
  cwd: root,
  env: { ...process.env, RENDERER: "sentence_puzzle" },
  stdio: "inherit",
  shell: true,
});

// Vite IIFE lib builds output without extension when fileName is a function
const rendererJsPath  = join(__dir, "dist", "renderer");
const rendererCssPath = join(__dir, "dist", "mirocard2.css");

if (!existsSync(rendererJsPath)) {
  throw new Error(`renderer not found at ${rendererJsPath}`);
}

const topicJson  = readFileSync(join(__dir, "topic.json"), "utf-8");
const avatarSvg  = readFileSync(join(__dir, "media", "avatar.svg"));
const rendererJs = readFileSync(rendererJsPath);

const zip = new JSZip();
zip.file("topic.json",       topicJson);
zip.file("media/avatar.svg", avatarSvg);
zip.file("renderer",         rendererJs);   // loaded by rendererLoader.js

if (existsSync(rendererCssPath)) {
  zip.file("mirocard2.css", readFileSync(rendererCssPath));
}

// Pack all card images from media/cards/
const cardsDir = join(__dir, "media", "cards");
if (existsSync(cardsDir)) {
  for (const file of readdirSync(cardsDir)) {
    zip.file(`media/cards/${file}`, readFileSync(join(cardsDir, file)));
  }
}

const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
const outPath = join(__dir, "sentence_puzzle.zip");
writeFileSync(outPath, buffer);
console.log("✓ Built:", outPath);
