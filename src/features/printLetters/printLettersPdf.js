// «Печатные буквы»: the notebook as a VECTOR PDF made in the app, no print dialog (owner, 2026-11-03:
// «мне нужно, чтобы просто был диалог сохранить в PDF»). The same technique as propis2's printPdf.js
// (src/topics/renderers/propis/printPdf.js), copied for this topic's own markup: the print sheets
// (PrintPages, one `.pl-sheet--print` per page) are laid out off screen at their real size, and each
// becomes one SVG in millimetres — the grid, every letter's SVG (strokes, dots, arrows, numbers), the
// block frames and colour plates, the ruling, the header — drawn into a PDF page by svg2pdf, at the
// printer margin on the paper of the notebook's format. Every text becomes outlines of Nunito
// (fonts/pdf/glyphs.json): no font is embedded. The libraries load only when a PDF is made. This
// lives in the app bundle (jsPDF is there already for propis2); the renderer in the deck ZIP gets it
// as the `makePdf` prop (PrintLettersScreen.jsx).

const SVG_NS = "http://www.w3.org/2000/svg";
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

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

const fontKey = (weight, family = "") => {
  if (/DM Serif/i.test(family)) return "DMSerif";
  const w = Number(weight) || (weight === "bold" ? 700 : 400);
  return w >= 850 ? "Nunito-900" : w >= 750 ? "Nunito-800" : w >= 600 ? "Nunito-700" : "Nunito-400";
};

// `text` in `font` at `size` from (x, baseline y): SVG paths (markup) and the width
function shape(font, text, size, x, y) {
  const k = size / font.upm;
  let cx = 0;
  const parts = [];
  for (const ch of text) {
    const g = font.glyphs[ch] ?? font.glyphs[ch === " " ? " " : "?"];
    if (!g) continue;
    if (g[1]) parts.push(`<path transform="translate(${(x + cx).toFixed(3)} ${y.toFixed(3)}) scale(${k.toFixed(6)} ${(-k).toFixed(6)})" d="${g[1]}"/>`);
    cx += g[0] * k;
  }
  return { markup: parts.join(""), width: cx };
}

const visible = (c) => c && c !== "transparent" && !/rgba\([^)]*,\s*0\)$/.test(c);
const f3 = (v) => Number(v.toFixed(3));

// The words of a text node where the layout put them.
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

// One letter / grid SVG, as a group in sheet millimetres: its content scaled from its viewBox into
// the box the layout gave it; its <text> (the numbers in the start dots) as outlines; the grid's
// hairlines a fixed 0.2mm (on screen they are one device pixel, `non-scaling-stroke`).
function svgGroup(svg, r, fonts) {
  const vb = (svg.getAttribute("viewBox") ?? `0 0 ${r.w} ${r.h}`).split(/[ ,]+/).map(Number);
  const s = Math.min(r.w / vb[2], r.h / vb[3]);
  const dx = r.x + (r.w - vb[2] * s) / 2 - vb[0] * s;
  const dy = r.y + (r.h - vb[3] * s) / 2 - vb[1] * s;
  const clone = svg.cloneNode(true);
  clone.querySelectorAll("[data-lg-anim]").forEach((n) => n.remove());
  clone.querySelectorAll("[vector-effect]").forEach((n) => {
    n.removeAttribute("vector-effect");
    n.removeAttribute("shape-rendering");
    n.setAttribute("stroke-width", String(f3(0.2 / s)));
  });
  for (const t of [...clone.querySelectorAll("text")]) {
    const size = parseFloat(t.getAttribute("font-size")) || 12;
    const font = fonts[fontKey(t.getAttribute("font-weight"))];
    const x = parseFloat(t.getAttribute("x")) || 0;
    const y = parseFloat(t.getAttribute("y")) || 0;
    const { markup, width } = shape(font, t.textContent ?? "", size, 0, 0);
    const shift = t.getAttribute("text-anchor") === "middle" ? -width / 2 : 0;
    const g = document.createElementNS(SVG_NS, "g");
    g.setAttribute("fill", t.getAttribute("fill") ?? "#000");
    g.setAttribute("transform", `translate(${x + shift} ${y})`);
    g.innerHTML = markup;
    t.replaceWith(g);
  }
  const opacity = parseFloat(getComputedStyle(svg).opacity);
  return `<g transform="translate(${f3(dx)} ${f3(dy)}) scale(${f3(s)})"${opacity < 1 ? ` opacity="${opacity}"` : ""}>${clone.innerHTML}</g>`;
}

// A rectangle with its own corner radii (the plate: top-left and bottom-right rounded only).
function roundedPath(r, [tl, tr, br, bl]) {
  const { x, y, w, h } = r;
  return `M${f3(x + tl)} ${f3(y)}H${f3(x + w - tr)}${tr ? `A${f3(tr)} ${f3(tr)} 0 0 1 ${f3(x + w)} ${f3(y + tr)}` : ""}V${f3(y + h - br)}${br ? `A${f3(br)} ${f3(br)} 0 0 1 ${f3(x + w - br)} ${f3(y + h)}` : ""}H${f3(x + bl)}${bl ? `A${f3(bl)} ${f3(bl)} 0 0 1 ${f3(x)} ${f3(y + h - bl)}` : ""}V${f3(y + tl)}${tl ? `A${f3(tl)} ${f3(tl)} 0 0 1 ${f3(x + tl)} ${f3(y)}` : ""}Z`;
}

function sheetSvg(sheet, sheetWmm, fonts) {
  const box = sheet.getBoundingClientRect();
  const k = sheetWmm / box.width;
  const at = (rect) => ({ x: (rect.left - box.left) * k, y: (rect.top - box.top) * k, w: rect.width * k, h: rect.height * k });
  const out = [];
  const lines = []; // frames drawn last, over the letters' highlight-free content
  const walk = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") return;
    const r = at(el.getBoundingClientRect());
    if (el !== sheet) {
      // a radius in % (border-radius: 50% — a round dot) is a share of the box; cap it at half a side
      const radius = (v) => (String(v).trim().endsWith("%") ? (parseFloat(v) / 100) * Math.min(r.w, r.h) : (parseFloat(v) || 0) * k);
      const radii = ["borderTopLeftRadius", "borderTopRightRadius", "borderBottomRightRadius", "borderBottomLeftRadius"].map((p) => Math.min(radius(cs[p]), r.w / 2, r.h / 2));
      if (visible(cs.backgroundColor)) out.push(`<path d="${roundedPath(r, radii)}" fill="${cs.backgroundColor}"/>`);
      const ow = parseFloat(cs.outlineWidth) || 0;
      if (cs.outlineStyle !== "none" && ow > 0 && visible(cs.outlineColor)) {
        const off = (parseFloat(cs.outlineOffset) || 0) * k;
        const half = (ow * k) / 2;
        const o = { x: r.x - off - half, y: r.y - off - half, w: r.w + 2 * (off + half), h: r.h + 2 * (off + half) };
        lines.push(`<path d="${roundedPath(o, radii.map((v) => Math.max(0, v + off + half)))}" fill="none" stroke="${cs.outlineColor}" stroke-width="${f3(ow * k)}"/>`);
      }
      for (const side of ["Top", "Bottom"]) {
        const bw = parseFloat(cs[`border${side}Width`]) || 0;
        const st = cs[`border${side}Style`];
        if (bw > 0 && st !== "none" && visible(cs[`border${side}Color`])) {
          const y = side === "Top" ? r.y + (bw * k) / 2 : r.y + r.h - (bw * k) / 2;
          const dash = st === "dashed" ? ` stroke-dasharray="${f3(bw * k * 3)} ${f3(bw * k * 3)}"` : st === "dotted" ? ` stroke-dasharray="${f3(bw * k)} ${f3(bw * k)}"` : "";
          out.push(`<path d="M${f3(r.x)} ${f3(y)}H${f3(r.x + r.w)}" stroke="${cs[`border${side}Color`]}" stroke-width="${f3(bw * k)}"${dash}/>`);
        }
      }
    }
    for (const child of el.childNodes) {
      if (child.nodeType === Node.TEXT_NODE && child.textContent.trim()) {
        const font = fonts[fontKey(cs.fontWeight, cs.fontFamily)];
        const size = parseFloat(cs.fontSize) * k;
        for (const w of textWords(child)) {
          const baseline = (w.top - box.top + (w.height * font.ascent) / (font.ascent + font.descent)) * k;
          out.push(`<g fill="${cs.color}">${shape(font, w.text, size, (w.left - box.left) * k, baseline).markup}</g>`);
        }
      } else if (child instanceof SVGSVGElement) {
        const rr = at(child.getBoundingClientRect());
        if (rr.w > 0 && rr.h > 0) out.push(svgGroup(child, rr, fonts));
      } else if (child instanceof HTMLElement) {
        walk(child);
      }
    }
  };
  walk(sheet);
  return [...out, ...lines].join("");
}

// container: the export pages (PdfPages.jsx) — one `.pl-pdf-page` per PDF page (data-w/-h, mm), each
// with `.pl-pdf-slot`s (data-x/-y: where its sheet goes on the paper; data-w/-h: the sheet's size). An
// empty slot is a blank half (the cover's back, a padding half). Returns the PDF as a Blob.
export async function makePrintLettersPdf(container, { onProgress } = {}) {
  const [{ jsPDF }, { svg2pdf }, fonts] = await Promise.all([import("jspdf"), import("svg2pdf.js"), loadGlyphs()]);
  await document.fonts?.ready;
  await nextFrame();
  await nextFrame();
  const pages = [...container.querySelectorAll(".pl-pdf-page")];
  let doc = null;
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:-20000px;top:0;width:10px;height:10px;overflow:hidden";
  document.body.appendChild(host);
  try {
    for (const [i, pg] of pages.entries()) {
      const [pw, ph] = [Number(pg.dataset.w), Number(pg.dataset.h)];
      const orientation = pw > ph ? "landscape" : "portrait";
      if (!doc) doc = new jsPDF({ unit: "mm", format: [pw, ph], orientation, compress: true });
      else doc.addPage([pw, ph], orientation);
      for (const slot of pg.querySelectorAll(".pl-pdf-slot")) {
        const sheet = slot.querySelector(".pl-sheet");
        if (!sheet) continue;
        const [x, y, sw, sh] = ["x", "y", "w", "h"].map((k) => Number(slot.dataset[k]));
        const svg = document.createElementNS(SVG_NS, "svg");
        svg.setAttribute("xmlns", SVG_NS);
        svg.setAttribute("viewBox", `0 0 ${sw} ${sh}`);
        svg.setAttribute("width", `${sw}`);
        svg.setAttribute("height", `${sh}`);
        svg.innerHTML = sheetSvg(sheet, sw, fonts);
        host.appendChild(svg);
        await svg2pdf(svg, doc, { x, y, width: sw, height: sh });
        svg.remove();
      }
      onProgress?.((i + 1) / pages.length);
      await nextFrame();
    }
  } finally {
    host.remove();
  }
  return doc ? doc.output("blob") : null;
}
