// `propis2`: the printed notebook as a VECTOR PDF made in the app (owner, 2026-10-14: no print dialog, no printer defaults — the
// file has the sheets as they must be; how it is printed is the user's business). The source is the very markup the print used
// (PrintPageView's `.propis-print-all`: one `.propis-print-all__sheet` per sheet, in print order, «По порядку» or «Тетрадью»): it is
// laid out off screen at its real size, then every sheet becomes a page of the PDF —
//   - the notebook pages are SVG already: svg2pdf draws them as vectors (CSS-styled bits inlined first: svg2pdf reads attributes);
//   - the cover is HTML (cover/*.jsx): walked element by element — its SVGs (logo, back block, spine) through svg2pdf, its text as
//     outlines, the field lines and the spine's edge lines as lines, clipped where the markup clips (overflow: hidden);
//   - every text (cover, logo, page numbers, marks) becomes vector outlines of Nunito / DM Serif Display (glyphs.json): no fonts in the
//     file. The libraries and the outlines load only when a PDF is made.

// Glyph outlines (public/fonts/pdf/glyphs.json, tools/propis2/build_pdf_glyphs.py): every text goes into the PDF as vector paths,
// no font is embedded — nothing a PDF viewer can get wrong (owner, 2026-10-15).
let glyphData = null;
async function loadGlyphs() {
  if (!glyphData) {
    glyphData = fetch(`${import.meta.env.BASE_URL ?? "/"}fonts/pdf/glyphs.json`)
      .then(async (res) => {
        const json = res.ok && /json/.test(res.headers.get("content-type") ?? "") ? await res.json() : null;
        if (!json?.fonts?.["Nunito-400"]) throw new Error("PDF glyph outlines are missing (fonts/pdf/glyphs.json)");
        return json.fonts;
      })
      .catch((e) => { glyphData = null; throw e; });
  }
  return glyphData;
}

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
const SVG_NS = "http://www.w3.org/2000/svg";

const fontKey = (family, weight, style) => {
  if (/DM Serif/i.test(family ?? "")) return style === "italic" ? "DMSerif-Italic" : "DMSerif";
  const w = Number(weight) || (weight === "bold" ? 700 : 400);
  return w >= 850 ? "Nunito-900" : w >= 750 ? "Nunito-800" : w >= 600 ? "Nunito-700" : "Nunito-400";
};

// `text` set in `font` at `size` from (x, baseline y), `spacing` added after every letter: SVG path elements (as markup) and the width
function shape(font, text, size, spacing, x, y) {
  const k = size / font.upm;
  let cx = 0;
  const parts = [];
  for (const ch of text) {
    const g = font.glyphs[ch] ?? font.glyphs[ch === "\u00a0" ? " " : "?"];
    if (!g) continue;
    if (g[1]) parts.push(`<path transform="translate(${(x + cx).toFixed(3)} ${y.toFixed(3)}) scale(${k.toFixed(6)} ${(-k).toFixed(6)})" d="${g[1]}"/>`);
    cx += g[0] * k + spacing;
  }
  return { markup: parts.join(""), width: cx - (text.length ? spacing : 0) };
}

const num = (v, fallback = 0) => { const n = parseFloat(v); return Number.isFinite(n) ? n : fallback; };

// The <text> elements of an SVG (the logo, the page numbers, the Mironium marks) as outlines: runs of the text and its <tspan>s
// laid out one after the other (dx, font, size, fill per run), then moved by text-anchor; dy in em of the text's own size.
function outlineTexts(svg, fonts) {
  for (const t of [...svg.querySelectorAll("text")]) {
    const size = num(t.getAttribute("font-size"), 16);
    const family = t.getAttribute("font-family");
    const base = { fill: t.getAttribute("fill") ?? "#000", size, weight: t.getAttribute("font-weight"), style: t.getAttribute("font-style") };
    const dyRaw = t.getAttribute("dy") ?? "0";
    const y = num(t.getAttribute("y")) + (dyRaw.endsWith("em") ? num(dyRaw) * size : num(dyRaw));
    const spacing = num(t.getAttribute("letter-spacing"));
    let x = 0;
    const runs = [];
    for (const n of t.childNodes) {
      const isSpan = n.nodeType === 1;
      const st = isSpan ? { fill: n.getAttribute("fill") ?? base.fill, size: num(n.getAttribute("font-size"), base.size), weight: n.getAttribute("font-weight") ?? base.weight, style: n.getAttribute("font-style") ?? base.style } : base;
      if (isSpan) x += num(n.getAttribute("dx"));
      const font = fonts[fontKey(family, st.weight, st.style)];
      const { markup, width } = shape(font, n.textContent ?? "", st.size, spacing, x, y);
      runs.push({ fill: st.fill, markup });
      x += width + spacing;
    }
    const total = x - spacing;
    const anchor = t.getAttribute("text-anchor");
    const shift = anchor === "middle" ? -total / 2 : anchor === "end" ? -total : 0;
    const g = document.createElementNS(SVG_NS, "g");
    g.setAttribute("transform", `translate(${num(t.getAttribute("x")) + shift} 0)${t.getAttribute("transform") ? ` ${t.getAttribute("transform")}` : ""}`);
    g.innerHTML = runs.map((r) => `<g fill="${r.fill}">${r.markup}</g>`).join("");
    t.replaceWith(g);
  }
  return svg;
}

// the presentation the CSS gives an SVG element (svg2pdf only reads attributes)
const SVG_PROPS = ["fill", "stroke", "stroke-width", "stroke-dasharray", "stroke-linecap", "stroke-linejoin", "opacity", "fill-opacity", "stroke-opacity", "display", "visibility", "font-family", "font-size", "font-weight", "font-style"];
function inlinedClone(svg) {
  const clone = svg.cloneNode(true);
  const src = [svg, ...svg.querySelectorAll("*")];
  const dst = [clone, ...clone.querySelectorAll("*")];
  src.forEach((el, i) => {
    // the paper is white in the file (the screen shows it cream)
    if (el.classList?.contains("propis-paper")) { dst[i].setAttribute("fill", "#fff"); dst[i].removeAttribute("class"); return; }
    if (!el.getAttribute("class") && !el.getAttribute("style")) return;
    const cs = getComputedStyle(el);
    for (const p of SVG_PROPS) {
      const v = cs.getPropertyValue(p);
      if (v) dst[i].setAttribute(p, v);
    }
    dst[i].removeAttribute("class");
    dst[i].removeAttribute("style");
  });
  return clone;
}

function rgb(color) {
  const m = /rgba?\(([^)]+)\)/.exec(color);
  if (!m) return null;
  const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
  return a === 0 ? null : [r, g, b];
}

// The words of a text node where the layout put them (one box each: a wrapped title keeps its lines, every word its own x).
function textWords(node) {
  const text = node.textContent;
  const range = document.createRange();
  const words = [];
  const re = /\S+/g;
  let m;
  while ((m = re.exec(text))) {
    range.setStart(node, m.index);
    range.setEnd(node, m.index + m[0].length);
    const r = range.getBoundingClientRect();
    if (r.width) words.push({ text: m[0], left: r.left, top: r.top, height: r.height });
  }
  return words;
}

export async function printPdf(container, { onProgress } = {}) {
  const [{ jsPDF }, { svg2pdf }, fonts] = await Promise.all([import("jspdf"), import("svg2pdf.js"), loadGlyphs()]);
  container.classList.add("propis-print-all--export");
  try {
    await document.fonts?.ready;
    await nextFrame();
    await nextFrame();
    const sheets = [...container.querySelectorAll(":scope > .propis-print-all__sheet")];
    let doc = null;
    for (let i = 0; i < sheets.length; i += 1) {
      const sheet = sheets[i];
      const a4 = sheet.classList.contains("propis-print-all__sheet--a4");
      const [wMm, hMm] = a4 ? [210, 297] : [297, 210];
      if (!doc) doc = new jsPDF({ unit: "mm", format: [wMm, hMm], orientation: a4 ? "portrait" : "landscape", compress: true });
      else doc.addPage([wMm, hMm], a4 ? "portrait" : "landscape");
      const texts = []; // the cover's text as outlines (sheet mm), drawn over the sheet at the end
      const box = sheet.getBoundingClientRect();
      const k = wMm / box.width;
      const at = (r) => ({ x: (r.left - box.left) * k, y: (r.top - box.top) * k, w: r.width * k, h: r.height * k });

      const drawSvg = async (svg, clip) => {
        const r = at(svg.getBoundingClientRect());
        if (r.w <= 0 || r.h <= 0) return;
        doc.saveGraphicsState();
        const c = clip ?? r;
        doc.rect(c.x, c.y, c.w, c.h, null);
        doc.clip();
        doc.discardPath();
        await svg2pdf(outlineTexts(inlinedClone(svg), fonts), doc, { x: r.x, y: r.y, width: r.w, height: r.h });
        doc.restoreGraphicsState();
      };
      const intersect = (a, b) => {
        if (!a) return b;
        const x = Math.max(a.x, b.x), y = Math.max(a.y, b.y);
        return { x, y, w: Math.max(0, Math.min(a.x + a.w, b.x + b.w) - x), h: Math.max(0, Math.min(a.y + a.h, b.y + b.h) - y) };
      };
      // the cover (HTML): its SVGs, text and lines, in document order
      const walk = async (el, clip) => {
        const cs = getComputedStyle(el);
        if (cs.display === "none" || cs.visibility === "hidden") return;
        const r = at(el.getBoundingClientRect());
        if (cs.overflow === "hidden" || cs.overflowX === "hidden") clip = intersect(clip, r);
        const bb = parseFloat(cs.borderBottomWidth);
        if (bb > 0 && cs.borderBottomStyle !== "none") {
          const c = rgb(cs.borderBottomColor);
          if (c) { doc.setDrawColor(...c); doc.setLineWidth(bb * k); doc.line(r.x, r.y + r.h - (bb * k) / 2, r.x + r.w, r.y + r.h - (bb * k) / 2); }
        }
        for (const child of el.childNodes) {
          if (child.nodeType === Node.TEXT_NODE && child.textContent.trim()) {
            const font = fonts[fontKey(cs.fontFamily, cs.fontWeight, cs.fontStyle)];
            const c = rgb(cs.color) ?? [0, 0, 0];
            const size = parseFloat(cs.fontSize) * k;
            const spacing = cs.letterSpacing === "normal" ? 0 : parseFloat(cs.letterSpacing) * k;
            const parts = [];
            for (const w of textWords(child)) {
              // the box of a word is the font's content area (ascent + descent): the baseline sits at its ascent
              const baseline = (w.top - box.top + (w.height * font.ascent) / (font.ascent + font.descent)) * k;
              parts.push(shape(font, w.text, size, spacing, (w.left - box.left) * k, baseline).markup);
            }
            texts.push(`<g fill="rgb(${c.join(",")})">${parts.join("")}</g>`);
          } else if (child instanceof SVGSVGElement) {
            await drawSvg(child, clip ? intersect(clip, at(child.getBoundingClientRect())) : null);
          } else if (child instanceof HTMLElement) {
            await walk(child, clip);
          }
        }
        // the spine's edge line is drawn by ::after (CoverSpine.jsx / propis2.css)
        if (el.classList.contains("p2-spine")) {
          const after = getComputedStyle(el, "::after");
          const c = rgb(after.backgroundColor);
          const w = parseFloat(after.width) * k;
          if (c && w > 0) {
            const x = el.classList.contains("p2-spine--front") ? r.x + r.w - w : r.x;
            doc.setFillColor(...c);
            doc.rect(x, r.y, w, r.h, "F");
          }
        }
      };

      for (const part of sheet.children) {
        if (part instanceof SVGSVGElement) await drawSvg(part, null);
        else if (part instanceof HTMLElement) await walk(part, at(part.getBoundingClientRect()));
      }
      if (texts.length) {
        const svg = new DOMParser().parseFromString(`<svg xmlns="${SVG_NS}" viewBox="0 0 ${wMm} ${hMm}" width="${wMm}" height="${hMm}">${texts.join("")}</svg>`, "image/svg+xml").documentElement;
        await svg2pdf(svg, doc, { x: 0, y: 0, width: wMm, height: hMm });
      }
      onProgress?.((i + 1) / sheets.length);
      await nextFrame();
    }
    return doc ? doc.output("blob") : null;
  } finally {
    container.classList.remove("propis-print-all--export");
  }
}

// The PDF opens in the device's own viewer, and that is all (owner, 2026-10-15: no share sheet, nothing saved — saving is the
// viewer's business). A tab opened after the seconds the PDF takes is blocked as a pop-up, so `pdfTab` opens it at the tap and
// `openPdf` points it at the file when the file is ready; with no tab, `openPdf` runs from a fresh tap (the «Открыть PDF» button).
export function pdfTab() {
  try {
    const tab = window.open("", "_blank");
    if (tab) { tab.document.title = "PDF"; tab.document.body.textContent = "Готовлю PDF…"; }
    return tab;
  } catch { return null; }
}

let lastUrl = null; // freed when the next PDF is made: the viewer may still need it to save the file
export function openPdf(blob, fileName, tab) {
  if (lastUrl) URL.revokeObjectURL(lastUrl);
  lastUrl = URL.createObjectURL(new File([blob], fileName, { type: "application/pdf" }));
  if (tab && !tab.closed) { tab.location.href = lastUrl; return "tab"; }
  const a = document.createElement("a"); // no `download`: open, not save
  a.href = lastUrl;
  a.target = "_blank";
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  return "link";
}

// a file name from the notebook's title: no characters the file systems refuse
export const pdfFileName = (title) => `${String(title ?? "").replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim() || "Тетрадь"}.pdf`;
