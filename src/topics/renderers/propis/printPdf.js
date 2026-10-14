// `propis2`: the printed notebook as a VECTOR PDF made in the app (owner, 2026-10-14: no print dialog, no printer defaults — the
// file has the sheets as they must be; how it is printed is the user's business). The source is the very markup the print used
// (PrintPageView's `.propis-print-all`: one `.propis-print-all__sheet` per sheet, in print order, «По порядку» or «Тетрадью»): it is
// laid out off screen at its real size, then every sheet becomes a page of the PDF —
//   - the notebook pages are SVG already: svg2pdf draws them as vectors (CSS-styled bits inlined first: svg2pdf reads attributes);
//   - the cover is HTML (cover/*.jsx): walked element by element — its SVGs (logo, back block, spine) through svg2pdf, its text with
//     the embedded fonts (public/fonts/pdf, Nunito + DM Serif Display, subset to Latin + Cyrillic), the field lines and the spine's
//     edge lines as lines, clipped where the markup clips (overflow: hidden).
// The libraries and fonts load only when a PDF is made.

const FONT_FILES = [
  ["Nunito-400.ttf", "Nunito", "normal"],
  ["Nunito-700.ttf", "Nunito", "bold"],
  ["Nunito-800.ttf", "Nunito800", "normal"],
  ["Nunito-900.ttf", "Nunito900", "normal"],
  ["DMSerifDisplay-Regular.ttf", "DMSerifDisplay", "normal"],
  ["DMSerifDisplay-Italic.ttf", "DMSerifDisplay", "italic"],
];
let fontData = null;
async function loadFonts() {
  if (!fontData) {
    fontData = Promise.all(FONT_FILES.map(async ([file]) => {
      const buf = await (await fetch(`${import.meta.env.BASE_URL ?? "/"}fonts/pdf/${file}`)).arrayBuffer();
      let bin = "";
      const bytes = new Uint8Array(buf);
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      return btoa(bin);
    })).catch((e) => { fontData = null; throw e; });
  }
  return fontData;
}

const MM_PER_PT = 25.4 / 72;
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

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
  // the embedded fonts by the names they are registered under (svg2pdf does not resolve a quoted family list)
  for (const el of [clone, ...clone.querySelectorAll("*")]) {
    const f = el.getAttribute("font-family");
    if (f) el.setAttribute("font-family", /DM Serif/.test(f) ? "DMSerifDisplay" : "Nunito");
  }
  return clone;
}

function rgb(color) {
  const m = /rgba?\(([^)]+)\)/.exec(color);
  if (!m) return null;
  const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
  return a === 0 ? null : [r, g, b];
}

function fontFor(cs) {
  const w = Number(cs.fontWeight) || 400;
  if (/DM Serif/.test(cs.fontFamily)) return ["DMSerifDisplay", cs.fontStyle === "italic" ? "italic" : "normal"];
  if (w >= 850) return ["Nunito900", "normal"];
  if (w >= 750) return ["Nunito800", "normal"];
  if (w >= 600) return ["Nunito", "bold"];
  return ["Nunito", "normal"];
}

// The lines a text node is laid out in: its words grouped by their line box.
function textLines(node) {
  const text = node.textContent;
  const range = document.createRange();
  const lines = [];
  const re = /\S+/g;
  let m;
  while ((m = re.exec(text))) {
    range.setStart(node, m.index);
    range.setEnd(node, m.index + m[0].length);
    const r = range.getBoundingClientRect();
    if (!r.width) continue;
    const last = lines[lines.length - 1];
    if (last && Math.abs(last.top - r.top) < r.height / 2) { last.words.push(m[0]); last.right = r.right; }
    else lines.push({ words: [m[0]], left: r.left, right: r.right, top: r.top, height: r.height });
  }
  return lines;
}

export async function printPdf(container, { onProgress } = {}) {
  const [{ jsPDF }, { svg2pdf }, fonts] = await Promise.all([import("jspdf"), import("svg2pdf.js"), loadFonts()]);
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
      if (!doc) {
        doc = new jsPDF({ unit: "mm", format: [wMm, hMm], orientation: a4 ? "portrait" : "landscape", compress: true });
        FONT_FILES.forEach(([file, name, style], k) => { doc.addFileToVFS(file, fonts[k]); doc.addFont(file, name, style); });
      } else doc.addPage([wMm, hMm], a4 ? "portrait" : "landscape");
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
        await svg2pdf(inlinedClone(svg), doc, { x: r.x, y: r.y, width: r.w, height: r.h });
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
            const [family, style] = fontFor(cs);
            const c = rgb(cs.color) ?? [0, 0, 0];
            const sizePt = (parseFloat(cs.fontSize) * k) / MM_PER_PT;
            const spacing = cs.letterSpacing === "normal" ? 0 : parseFloat(cs.letterSpacing) * k;
            doc.setFont(family, style);
            doc.setFontSize(sizePt);
            doc.setTextColor(...c);
            for (const line of textLines(child)) {
              const x = (line.left - box.left) * k;
              const y = (line.top - box.top + line.height / 2) * k;
              doc.text(line.words.join(" "), x, y, { baseline: "middle", charSpace: spacing });
            }
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
      onProgress?.((i + 1) / sheets.length);
      await nextFrame();
    }
    return doc ? doc.output("blob") : null;
  } finally {
    container.classList.remove("propis-print-all--export");
  }
}

// Hands the file over: the share sheet on a phone / tablet (save to Files, send, print), a download elsewhere.
export async function deliverPdf(blob, fileName) {
  const file = new File([blob], fileName, { type: "application/pdf" });
  const touch = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
  if (touch && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: fileName.replace(/\.pdf$/i, "") }); return "shared"; }
    catch (e) { if (e?.name === "AbortError") return "cancelled"; }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return "downloaded";
}

// a file name from the notebook's title: no characters the file systems refuse
export const pdfFileName = (title) => `${String(title ?? "").replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim() || "Тетрадь"}.pdf`;
