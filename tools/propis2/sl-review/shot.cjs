// Screenshot the <svg> of SL_SHOTS pages: node tools/propis2/sl-review/shot.cjs <ABSOLUTE dir> x name1,name2 → <dir>/<name>-t.png
// (transparent; composite on white to look at it). The dir must be absolute (file:// URL).
const { chromium } = require("playwright");
(async () => {
const [dir, outDir] = process.argv.slice(2);
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 900, height: 1300 }, deviceScaleFactor: 2, colorScheme: "light" });
for (const n of (process.argv[4]||"caps,print").split(",")) { await p.goto(`file://${dir}/${n}.html`); const svg = await p.$("svg"); await svg.screenshot({ path: `${dir}/${n}-t.png`, omitBackground: true }); }
await b.close(); })();
