import sharp from "sharp";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, "..");

// Hair/forehead/nose/mouth/chin/neck contour from the original
// mirocard-mark path. Both open ends already sit exactly on the
// drawing-area boundary (y=0 at the top, y=440 at the bottom), so the
// shape is closed by running straight lines out to the left edge
// (x=0) instead of a separate rounded "card" — the fill runs edge to
// edge, no frame, no inset square.
const headPath =
  "M376,0 L401,5 L401,7 L388,12 L382,20 L379,17 L369,15 L342,24 L319,23 L291,29 L291,31 L297,29 L313,29 L313,31 L279,41 L229,67 L219,67 L209,61 L215,69 L233,71 L245,67 L265,55 L268,56 L247,71 L204,88 L198,96 L196,112 L200,102 L209,93 L219,91 L206,102 L199,125 L188,136 L200,132 L194,142 L193,151 L201,143 L198,156 L203,167 L206,148 L209,147 L207,151 L209,155 L216,150 L213,159 L214,200 L212,206 L196,224 L176,236 L171,245 L173,255 L191,273 L190,284 L185,289 L186,296 L197,303 L198,310 L209,311 L213,309 L215,311 L212,316 L199,317 L194,322 L195,331 L202,338 L204,344 L203,365 L205,375 L214,386 L224,390 L274,390 L294,396 L304,406 L311,421 L316,440 L0,440 L0,0 Z";

// Left of the line = silhouette fill, right = background fill. The
// original 496x440 mark is cropped to a 440x440 square, anchored left
// (drops a sliver of empty margin past the tallest hair spike on the
// right, which is background anyway).
function buildIconSvg(size, bg, fg) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 440 440">
  <rect width="440" height="440" fill="${bg}"/>
  <path d="${headPath}" fill="${fg}"/>
</svg>`;
}

async function generate(size, filename, bg, fg) {
  const svg = buildIconSvg(size, bg, fg);
  await sharp(Buffer.from(svg)).png().toFile(join(root, "public", filename));
  console.log(`Generated ${filename} (${size}x${size})`);
}

// iOS and CDN/edge layers cache icon-192.png / icon-512.png /
// apple-touch-icon.png hard (iOS home-screen icons in particular
// barely ever refresh from a same-named URL, even after reinstalling
// the app). Whenever these files change, bump the `?v=` query string
// on their references in public/manifest.json and index.html so
// clients fetch the new file under a new URL instead of serving a
// stale cached copy.

const BG = "#080f20"; // navy, same ink as the splash screen
const FG = "#ffffff";

await generate(192, "icon-192.png", BG, FG);
await generate(512, "icon-512.png", BG, FG);
await generate(180, "apple-touch-icon.png", BG, FG);

console.log("Done.");
