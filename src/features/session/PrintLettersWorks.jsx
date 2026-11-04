import { useState } from "react";
import "./printLettersWorks.css";
import { letterWorks } from "./printLettersWorks.js";

// «Мои буквы» — the end of a «Пишу на экране» lesson (print_letters, owner 2026-11-04: «на экране все
// сохранённые буквы, которые написал ученик… чтобы потом можно было в PDF сохранить»). Every letter
// the child wrote, in the child's own lines, on the notebook grid; «Сохранить в PDF» makes an A4
// sheet of them with the student's name and the date. The letters come with the lesson's record
// (`session.works`, handed by the renderer with each right answer — sessionEngine.withWork).

const INK = "#1d4ed8";
const GIVEN = "#94a3b8";
const GRID = "#b9d3e6";

function strokePath(s) {
  const n = String(s ?? "").trim().split(/\s+/).map(Number);
  if (n.length < 2 || n.some((v) => !Number.isFinite(v))) return "";
  let d = `M ${n[0]} ${n[1]}`;
  if (n.length === 2) return `${d} l 0.01 0`;
  for (let i = 2; i + 1 < n.length; i += 2) d += ` L ${n[i]} ${n[i + 1]}`;
  return d;
}

// one letter in glyph units (50 per cell, 100 tall), grid cells around it
function WorkTile({ work }) {
  const w = Number(work.w) || 50;
  const cellsW = Math.ceil(w / 50);
  const x0 = -25, y0 = -25, vw = cellsW * 50 + 50, vh = 150;
  const lines = [];
  for (let x = 0; x <= cellsW * 50; x += 50) lines.push(<line key={`x${x}`} x1={x} y1={y0} x2={x} y2={y0 + vh} />);
  for (let y = 0; y <= 100; y += 50) lines.push(<line key={`y${y}`} x1={x0} y1={y} x2={x0 + vw} y2={y} />);
  return (
    <svg className="plw-works-tile" viewBox={`${x0} ${y0} ${vw} ${vh}`} role="img" aria-label={`Буква ${work.letter}`}>
      <g className="plw-works-grid">{lines}</g>
      {work.strokes.map((s, i) => (
        <path key={i} d={strokePath(s)} fill="none" stroke={i < (work.given ?? 0) ? GIVEN : INK} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </svg>
  );
}

const fileName = (studentName, date) => `Мои буквы${studentName ? ` — ${studentName}` : ""} ${date}.pdf`.replace(/[\\/:*?"<>|]+/g, " ");
const canPickFile = () => typeof window !== "undefined" && typeof window.showSaveFilePicker === "function";

function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

// The A4 sheet(s): a 5mm grid over the page, the letters 4 cells (20mm) tall at a cell line, one
// blank cell after each, rows two cells apart — like a notebook page written big.
const MM = { w: 210, h: 297, margin: 10, cell: 5, top: 30 };
async function makeWorksPdf(works, { studentName, dateLabel }) {
  const { svgPagesToPdf, outlineText } = await import("@/features/printLetters/printLettersPdf");
  const k = 0.2; // mm per glyph unit: 100 units = 20 mm = 4 cells
  const colsW = MM.w - 2 * MM.margin;
  const rowPitch = 6 * MM.cell;
  const pages = [];
  let page = null, x = 0, y = 0;
  const title = await outlineText("Мои буквы", 8, MM.margin, 18, { weight: 900 });
  const sub = await outlineText([studentName, dateLabel].filter(Boolean).join(" · "), 4.2, MM.margin + title.width + 4, 18, { weight: 700, fill: "#64748b" });
  const grid = () => {
    const out = [];
    for (let gx = MM.margin; gx <= MM.w - MM.margin + 0.01; gx += MM.cell) out.push(`<line x1="${gx}" y1="${MM.top - MM.cell}" x2="${gx}" y2="${MM.h - MM.margin}"/>`);
    for (let gy = MM.top - MM.cell; gy <= MM.h - MM.margin + 0.01; gy += MM.cell) out.push(`<line x1="${MM.margin}" y1="${gy}" x2="${MM.w - MM.margin}" y2="${gy}"/>`);
    return `<g stroke="${GRID}" stroke-width="0.2">${out.join("")}</g>`;
  };
  const newPage = () => {
    page = { parts: [grid(), title.markup, sub.markup] };
    pages.push(page);
    x = MM.cell; y = MM.top + MM.cell; // a cell in from the grid's edge
  };
  newPage();
  for (const work of works) {
    const wmm = Math.ceil(((Number(work.w) || 50) * k) / MM.cell) * MM.cell;
    if (x + wmm > colsW - MM.cell) { x = MM.cell; y += rowPitch; }
    if (y + 20 > MM.h - MM.margin) newPage();
    const strokes = work.strokes.map((s, i) => `<path d="${strokePath(s)}" fill="none" stroke="${i < (work.given ?? 0) ? GIVEN : INK}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`).join("");
    page.parts.push(`<g transform="translate(${MM.margin + x} ${y}) scale(${k})">${strokes}</g>`);
    x += wmm + MM.cell;
  }
  return svgPagesToPdf(pages.map((p) => ({ w: MM.w, h: MM.h, markup: p.parts.join("") })));
}

export default function PrintLettersWorks({ session, studentName }) {
  const works = letterWorks(session);
  const [job, setJob] = useState(null); // { status: making | ready | saved | error, blob }
  if (!works.length) return null;
  const date = new Date(session.completedAt ?? session.startedAt);
  const dateLabel = date.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
  const name = fileName(studentName, date.toLocaleDateString("ru-RU"));

  async function makePdf() {
    let handle = null;
    if (canPickFile()) {
      try {
        handle = await window.showSaveFilePicker({ suggestedName: name, types: [{ description: "PDF", accept: { "application/pdf": [".pdf"] } }] });
      } catch (e) {
        if (e?.name === "AbortError") return;
      }
    }
    setJob({ status: "making" });
    try {
      const blob = await makeWorksPdf(works, { studentName, dateLabel });
      if (handle) {
        const w = await handle.createWritable();
        await w.write(blob); await w.close();
        setJob({ status: "saved", blob });
      } else {
        setJob({ status: "ready", blob });
      }
    } catch (e) {
      console.error("«Мои буквы» PDF", e);
      setJob({ status: "error" });
    }
  }

  // the share sheet needs its own tap (one started seconds after the first tap is refused on iPad)
  async function save() {
    const file = new File([job.blob], name, { type: "application/pdf" });
    try {
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: name });
      else download(job.blob, name);
      setJob({ status: "saved", blob: job.blob });
    } catch (e) {
      if (e?.name === "AbortError") return;
      download(job.blob, name);
      setJob({ status: "saved", blob: job.blob });
    }
  }

  return (
    <section className="plw-works" aria-label="Мои буквы">
      <div className="plw-works-head">
        <h2 className="plw-works-title">Мои буквы</h2>
        <span className="plw-works-count">{works.length}</span>
      </div>
      <div className="plw-works-grid-wrap">
        {works.map((w, i) => <WorkTile key={i} work={w} />)}
      </div>
      <div className="plw-works-actions">
        {job?.status === "ready" ? (
          <button type="button" className="plw-works-btn plw-works-btn--primary" onClick={save}>Сохранить файл</button>
        ) : (
          <button type="button" className="plw-works-btn" onClick={makePdf} disabled={job?.status === "making"}>
            {job?.status === "making" ? "Готовлю PDF…" : job?.status === "saved" ? "Сохранено ✓ · ещё раз" : job?.status === "error" ? "Не получилось — ещё раз" : "Сохранить в PDF"}
          </button>
        )}
      </div>
    </section>
  );
}
