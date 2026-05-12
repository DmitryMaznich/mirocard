import JSZip from "jszip";
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const root  = join(__dir, "..", "..");

// Build the renderer IIFE bundle
console.log("Building renderer…");
execSync("npm run build:renderer", {
  cwd: root,
  env: { ...process.env, RENDERER: "comparison" },
  stdio: "inherit",
  shell: true,
});

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
zip.file("renderer",         rendererJs);

if (existsSync(rendererCssPath)) {
  zip.file("mirocard2.css", readFileSync(rendererCssPath));
}

const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
const outPath = join(__dir, "comparison.zip");
writeFileSync(outPath, buffer);
console.log("✓ Built:", outPath);
