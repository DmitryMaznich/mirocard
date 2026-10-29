/* global window */
// Screenshot of rows drawn by the harness (see harness.jsx). Usage (Vite on :5199, harness copied to the repo root as tmp-pdf.*):
//   node tools/propis2/dev/shot-words.mjs '["Вчера мы с папой"]' dense /tmp/out.png [heightShare=0.2] [scale=3]
// grid: dense | regular | none. Ink is shown on white (inverted print preview). Playwright and Chromium are preinstalled in the cloud sandbox.
import { chromium } from "playwright";
const [rowsJson, grid = "dense", out = "/tmp/words.png", share = "0.2", scale = "3"] = process.argv.slice(2);
const rows = JSON.parse(rowsJson);
const b = await chromium.launch({ executablePath: process.env.CHROME ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const p = await b.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: Number(scale) });
p.on("pageerror", (e) => console.log("ERR", e.message));
await p.emulateMedia({ media: "print" });
await p.goto("http://localhost:5199/tmp-pdf.html");
await p.waitForFunction(() => typeof window.showWords === "function", null, { timeout: 40000 });
await p.addStyleTag({ content: "html{filter:invert(1) hue-rotate(180deg)}" });
await p.evaluate(([w, g]) => window.showWords(w, { ruling: "narrow", grid: g }), [rows, grid]);
await p.waitForTimeout(4000);
const bb = await p.locator(".propis-print-all__sheet").nth(0).boundingBox();
await p.screenshot({ path: out, fullPage: true, clip: { x: bb.x, y: bb.y, width: bb.width, height: bb.height * Number(share) } });
await b.close();
