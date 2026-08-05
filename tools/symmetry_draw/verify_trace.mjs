export const DIRECTION = {
  up: { col: 0, row: -1 },
  down: { col: 0, row: 1 },
  right: { col: 1, row: 0 },
  left: { col: -1, row: 0 },
  up_right: { col: 1, row: -1 },
  down_right: { col: 1, row: 1 },
  up_left: { col: -1, row: -1 },
  down_left: { col: -1, row: 1 },
};

export function commandsToPath(start, commands) {
  const points = [{ col: start.col, row: start.row }];
  let current = { col: start.col, row: start.row };
  for (const command of commands) {
    const direction = DIRECTION[command.direction];
    if (!direction) {
      throw new Error(`Unknown direction: ${command.direction}`);
    }
    current = {
      col: current.col + direction.col * command.cells,
      row: current.row + direction.row * command.cells,
    };
    points.push(current);
  }
  return points;
}

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

function toPixel(point, cellPx, originX, originY) {
  return { pxX: originX + point.col * cellPx, pxY: originY + point.row * cellPx };
}

function buildOverlaySvg({ width, height, paths, startPoint }) {
  const strokes = paths
    .map((path) => {
      const points = path.map((p) => `${p.pxX},${p.pxY}`).join(" ");
      return `<polyline points="${points}" fill="none" stroke="#ff0033" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />`;
    })
    .join("\n");
  const dots = paths
    .flat()
    .map((p) => `<circle cx="${p.pxX}" cy="${p.pxY}" r="4" fill="#ff0033" />`)
    .join("\n");
  const start = startPoint
    ? `<circle cx="${startPoint.pxX}" cy="${startPoint.pxY}" r="7" fill="none" stroke="#0055ff" stroke-width="3" />`
    : "";
  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${strokes}\n${dots}\n${start}</svg>`;
}

function buildRulerSvg({ width, height, step }) {
  const lines = [];
  const labels = [];
  for (let x = 0; x <= width; x += step) {
    lines.push(`<line x1="${x}" y1="0" x2="${x}" y2="${height}" stroke="#00cc44" stroke-width="1" opacity="0.6" />`);
    labels.push(`<text x="${x + 2}" y="12" font-size="10" fill="#008822">${x}</text>`);
  }
  for (let y = 0; y <= height; y += step) {
    lines.push(`<line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke="#00cc44" stroke-width="1" opacity="0.6" />`);
    labels.push(`<text x="2" y="${y - 2}" font-size="10" fill="#008822">${y}</text>`);
  }
  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${lines.join("\n")}\n${labels.join("\n")}</svg>`;
}

async function runRuler(imagePath, { step, out }) {
  const image = sharp(imagePath);
  const { width, height } = await image.metadata();
  const svg = buildRulerSvg({ width, height, step });
  await image.composite([{ input: Buffer.from(svg) }]).toFile(out);
  console.log(`Ruler overlay written to ${out} (${width}x${height}px, step ${step}px)`);
}

async function runOverlay(imagePath, dataPath, { cellPx, originX, originY, out }) {
  const data = JSON.parse(readFileSync(dataPath, "utf8"));
  const rawPaths = data.paths ?? [commandsToPath(data.start, data.commands)];
  const paths = rawPaths.map((path) => path.map((p) => ({ ...p, ...toPixel(p, cellPx, originX, originY) })));
  const startPoint = data.start ? { ...data.start, ...toPixel(data.start, cellPx, originX, originY) } : null;
  const image = sharp(imagePath);
  const { width, height } = await image.metadata();
  const svg = buildOverlaySvg({ width, height, paths, startPoint });
  await image.composite([{ input: Buffer.from(svg) }]).toFile(out);
  console.log(`Overlay written to ${out}`);
}

function parseArgs(argv) {
  const [command, imagePath, maybeDataPath, ...rest] = argv;
  const options = {};
  for (const arg of rest) {
    const match = /^--([^=]+)=(.*)$/.exec(arg);
    if (match) options[match[1]] = match[2];
  }
  return { command, imagePath, maybeDataPath, options };
}

async function main() {
  const { command, imagePath, maybeDataPath, options } = parseArgs(process.argv.slice(2));
  if (command === "ruler") {
    await runRuler(imagePath, {
      step: Number(options.step ?? 50),
      out: options.out ?? "overlay-ruler.png",
    });
  } else if (command === "overlay") {
    await runOverlay(imagePath, maybeDataPath, {
      cellPx: Number(options.cell),
      originX: Number(options.originX),
      originY: Number(options.originY),
      out: options.out ?? "overlay-check.png",
    });
  } else {
    console.error(
      "Usage:\n" +
        "  node verify_trace.mjs ruler <image> [--step=50] [--out=path]\n" +
        "  node verify_trace.mjs overlay <image> <data.json> --cell=N --originX=N --originY=N [--out=path]"
    );
    process.exitCode = 1;
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
  main();
}
