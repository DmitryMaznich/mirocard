/**
 * html-to-pdf.mjs
 * Renders an HTML file to a PDF via headless Chrome (puppeteer-core).
 * Auto-scales content to fit on a single page.
 *
 * Usage:
 *   node scripts/html-to-pdf.mjs output/file.html
 *   node scripts/html-to-pdf.mjs output/file.html output/file.pdf
 *   node scripts/html-to-pdf.mjs output/file.html --a5
 */

import puppeteer from "puppeteer-core";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const CHROME_PATHS = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
];

const chromePath = CHROME_PATHS.find(fs.existsSync);
if (!chromePath) { console.error("Chrome/Edge not found"); process.exit(1); }

const args    = process.argv.slice(2).filter(a => !a.startsWith("--"));
const flags   = process.argv.slice(2).filter(a => a.startsWith("--"));
const isA5    = flags.includes("--a5");
const format  = isA5 ? "A5" : "A4";

const [htmlArg, pdfArg] = args;
if (!htmlArg) { console.error("Usage: node scripts/html-to-pdf.mjs <input.html> [output.pdf] [--a5]"); process.exit(1); }

const htmlPath = path.resolve(ROOT, htmlArg);
const pdfPath  = pdfArg
  ? path.resolve(ROOT, pdfArg)
  : htmlPath.replace(/\.html$/, ".pdf");

console.log(`Rendering: ${htmlPath}`);
console.log(`Output:    ${pdfPath}  [${format}]`);
console.log(`Browser:   ${chromePath}\n`);

// Paper dimensions
const MARGIN_MM = 7;
const MM_TO_PX  = 96 / 25.4;
const PAPER_H_MM = isA5 ? 210 : 297;
const PAPER_W_PX = Math.round((isA5 ? 148 : 210) * MM_TO_PX);
const AVAIL_H_PX = (PAPER_H_MM - MARGIN_MM * 2) * MM_TO_PX;

const browser = await puppeteer.launch({
  executablePath: chromePath,
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});

const page = await browser.newPage();
await page.setViewport({ width: PAPER_W_PX, height: 600 });

const url = `file:///${htmlPath.replace(/\\/g, "/")}`;
await page.goto(url, { waitUntil: "networkidle0", timeout: 15000 });
await page.evaluate(() => document.fonts.ready);

const contentH = await page.evaluate(() => document.body.offsetHeight);
const scale     = Math.min(1, AVAIL_H_PX / contentH);
console.log(`Content height: ${contentH}px  →  scale: ${scale.toFixed(3)}`);

const tmpPath = pdfPath + ".tmp.pdf";

await page.pdf({
  path: tmpPath,
  format,
  printBackground: true,
  scale: scale,
  margin: {
    top:    `${MARGIN_MM}mm`,
    bottom: `${MARGIN_MM}mm`,
    left:   "10mm",
    right:  "10mm",
  },
});

await browser.close();

// Atomic replace — works even if target is open in some viewers
try { fs.unlinkSync(pdfPath); } catch {}
fs.renameSync(tmpPath, pdfPath);

const size = (fs.statSync(pdfPath).size / 1024).toFixed(0);
console.log(`✓ PDF saved (${size} KB): ${pdfPath}`);
