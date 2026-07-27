import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");

function loadEnvFile(f) {
  if (!fs.existsSync(f)) return;
  for (const line of fs.readFileSync(f, "utf8").split(/\r?\n/)) {
    const l = line.trim();
    if (!l || l.startsWith("#")) continue;
    const sep = l.indexOf("=");
    if (sep <= 0) continue;
    const key = l.slice(0, sep).trim();
    let val = l.slice(sep + 1).trim();
    if (/^['"].*['"]$/.test(val)) val = val.slice(1, -1);
    if (!(key in process.env)) process.env[key] = val;
  }
}

let loaded = false;

/** Reads GEMINI_API_KEY from .env/.env.local, exiting with an error if unset. */
export function getGeminiApiKey() {
  if (!loaded) {
    loadEnvFile(path.join(ROOT, ".env"));
    loadEnvFile(path.join(ROOT, ".env.local"));
    // Fallback to the older sibling project, matching existing scripts (e.g. generate-finger-hands.mjs).
    loadEnvFile("C:/Users/dmazn/Projects/Mirocard/.env");
    loadEnvFile("C:/Users/dmazn/Projects/Mirocard/.env.local");
    loaded = true;
  }
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    console.error("GEMINI_API_KEY not found. Set it in .env (see .env.example).");
    process.exit(1);
  }
  return key;
}
