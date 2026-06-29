/**
 * analyze-finger-positions.mjs
 *
 * Computes precise X positions of "removed" fingers for each (startCount → endCount)
 * transition by diffing alpha channels of hand_right_N.png images.
 *
 * Pixels opaque in START but transparent in END = regions that disappear → put arrows there.
 *
 * Strategy:
 *   1. Diff alpha channels (top 55% of image = finger region).
 *   2. Find clusters of changed pixels.
 *   3. Need exactly N = start - end clusters.
 *      - Too many → take N largest by pixel count.
 *      - Too few  → retry with smaller gap until >= N clusters found.
 *
 * Usage: node scripts/analyze-finger-positions.mjs
 */

import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";

const ROOT  = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HANDS = path.join(ROOT, "public", "hands");
const W = 256, H = 320;
const TOP = Math.floor(H * 0.55);   // upper 55% = finger tips
const ALPHA_THRESH = 48;

async function loadTopAlpha(count) {
  const { data } = await sharp(path.join(HANDS, `hand_right_${count}.png`))
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const alpha = new Uint8Array(W * TOP);
  for (let y = 0; y < TOP; y++)
    for (let x = 0; x < W; x++)
      alpha[y * W + x] = data[(y * W + x) * 4 + 3];
  return alpha;
}

function runClustering(xs, gapPx) {
  if (!xs.length) return [];
  const sorted = [...xs].sort((a, b) => a - b);
  const clusters = [];
  let cur = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - sorted[i - 1] > gapPx) { clusters.push(cur); cur = [sorted[i]]; }
    else cur.push(sorted[i]);
  }
  clusters.push(cur);
  return clusters.map(c => ({
    x: c.reduce((s, v) => s + v, 0) / c.length / W,
    size: c.length,
  }));
}

function selectClusters(xs, n) {
  // Try gaps from coarse to fine until we have >= n clusters, then take n largest.
  for (const gap of [14, 10, 8, 6, 4]) {
    const clusters = runClustering(xs, gap);
    if (clusters.length >= n) {
      // Take n largest clusters, sorted by X
      return clusters
        .sort((a, b) => b.size - a.size)
        .slice(0, n)
        .sort((a, b) => a.x - b.x);
    }
  }
  // Still too few — return all we found, sorted by X
  return runClustering(xs, 4).sort((a, b) => a.x - b.x);
}

// Load alpha maps
process.stdout.write("Loading images...");
const alphas = {};
for (let n = 0; n <= 5; n++) {
  alphas[n] = await loadTopAlpha(n);
  process.stdout.write(` ${n}`);
}
console.log("\n");

const table = {}; // table[start][end] = [x0, x1, ...]

for (let start = 1; start <= 5; start++) {
  table[start] = {};
  for (let end = 0; end < start; end++) {
    const n = start - end;
    const startA = alphas[start];
    const endA   = alphas[end];

    // Collect X coords of pixels present in START but absent in END
    const xs = [];
    for (let i = 0; i < startA.length; i++) {
      if (startA[i] >= ALPHA_THRESH && endA[i] < ALPHA_THRESH)
        xs.push(i % W);
    }

    const clusters = selectClusters(xs, n);
    const positions = clusters.map(c => Math.round(c.x * 1000) / 1000);
    table[start][end] = positions;

    const status = clusters.length === n ? "✓" : `⚠ got ${clusters.length}`;
    const sizes = clusters.map(c => c.size).join("/");
    console.log(`  ${start}→${end} (need ${n}): [${positions.join(", ")}]  ${status}  px:${sizes}`);
  }
  console.log();
}

// Output the lookup constant for copy-paste into JSX
console.log("// ── PASTE INTO FingersCountTask.jsx ─────────────────────────────────────");
console.log("//");
console.log("// REMOVAL_XS[handCount][remainCount] = sorted X positions (0-1) in hand_right images.");
console.log("// For hand_left (mirrored screen-right): reverse array and apply (1 - x).");
console.log("const REMOVAL_XS_R = " + JSON.stringify(table, null, 2) + ";");
