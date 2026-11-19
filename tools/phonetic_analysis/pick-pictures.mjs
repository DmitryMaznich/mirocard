// Copies the owner's picks from candidates/ to media/<word>.webp.
// Usage: node tools/phonetic_analysis/pick-pictures.mjs кот=2 дом=1 ...
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const DIR = dirname(fileURLToPath(import.meta.url));
mkdirSync(join(DIR, "media"), { recursive: true });
for (const a of process.argv.slice(2)) {
  const [id, n] = a.split("=");
  copyFileSync(join(DIR, "candidates", `${id}_${n}.webp`), join(DIR, "media", `${id}.webp`));
  console.log(`media/${id}.webp ← ${id}_${n}`);
}
