import { copyFileSync } from "node:fs";

const SRC = "tools/letter_capture/handwriting_capture.html";
const DEST = "public/letter_capture.html";

copyFileSync(SRC, DEST);
console.log(`✓ synced ${SRC} -> ${DEST}`);
