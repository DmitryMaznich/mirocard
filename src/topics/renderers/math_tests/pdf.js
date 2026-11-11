// «Контрольные по математике» → a vector PDF: every page drawn from layout.js's shapes (the same
// the screen draws), text as Nunito outlines (digits as Primo's) (the app's printLettersPdf.js — no font embedded),
// then svg2pdf. With `answers` a copy of the pages with every box filled in follows, for the adult.
import { svgPagesToPdf, outlineText } from "@/features/printLetters/printLettersPdf";
import { layoutTest, pagePrimitives } from "./layout.js";

const esc = (v) => String(v).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

async function pageMarkup(layout, pageIndex, opts) {
  const prims = pagePrimitives(layout, pageIndex, opts);
  const parts = [`<rect x="0" y="0" width="${layout.grid.w}" height="${layout.grid.h}" fill="#ffffff"/>`];
  for (const p of prims) {
    if (p.k === "line") parts.push(`<line x1="${p.x1}" y1="${p.y1}" x2="${p.x2}" y2="${p.y2}" stroke="${p.stroke}" stroke-width="${p.w}" stroke-linecap="${p.cap ?? "butt"}"/>`);
    else if (p.k === "path") parts.push(`<path d="${p.d}" stroke="${p.stroke}" stroke-width="${p.w}" fill="${p.fill}" stroke-linecap="round" stroke-linejoin="round"/>`);
    else if (p.k === "circle") parts.push(`<circle cx="${p.cx}" cy="${p.cy}" r="${p.r}" stroke="${p.stroke}" stroke-width="${p.w2}" fill="${p.fill}"/>`);
    else if (p.k === "rect") parts.push(`<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="${p.rx}" stroke="${p.stroke}" stroke-width="${p.w2}" fill="${p.fill}"/>`);
    else if (p.k === "text") {
      const t = { ...p, text: p.text.replace(/\u2212/g, "–") }; // no «−» in the PDF glyph set
      let x = t.x;
      if (t.anchor !== "start") {
        const { width } = await outlineText(t.text, t.size, 0, 0, { weight: t.weight, fill: t.fill, family: t.font });
        x = t.anchor === "middle" ? t.x - width / 2 : t.x - width;
      }
      const { markup } = await outlineText(t.text, t.size, x, t.y, { weight: t.weight, fill: esc(t.fill), family: t.font });
      // the outline stroke sits on the glyph paths, which are scaled size/upm (Primo: upm 1000) — so its width is in font units
      parts.push(t.outline ? markup.replace("<g ", `<g stroke="${esc(t.fill)}" stroke-width="${((t.outline / t.size) * 1000).toFixed(1)}" stroke-linejoin="round" `) : markup);
    }
  }
  return { w: layout.grid.w, h: layout.grid.h, markup: parts.join("") };
}

export async function makeTestPdf(test, { answers = true, values = null, marks = null } = {}) {
  const layout = layoutTest(test);
  const pages = [];
  for (let i = 0; i < layout.pages.length; i += 1) pages.push(await pageMarkup(layout, i, { test, values: values ?? {}, marks }));
  if (answers && !values) {
    for (let i = 0; i < layout.pages.length; i += 1) pages.push(await pageMarkup(layout, i, { test, showAnswers: true, answerTitle: true }));
  }
  return svgPagesToPdf(pages);
}

export function pdfFileName(title) {
  return `${title || "Контрольная"} ${new Date().toLocaleDateString("ru-RU")}.pdf`.replace(/[\\/:*?"<>|]+/g, " ");
}
