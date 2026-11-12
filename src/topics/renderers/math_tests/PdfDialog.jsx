import { useState } from "react";
import SheetSvg from "./SheetSvg";
import { makeTestPdf, pdfFileName } from "./pdf.js";

function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

// Saves a PDF: a real «Save as» where the browser has one (showSaveFilePicker); elsewhere the PDF is
// made first and «Сохранить» — its own tap — opens the share sheet (iPad refuses a share started
// seconds after the first tap) or downloads it.
export function usePdfSaver() {
  const [job, setJob] = useState(null);
  async function make(name, build) {
    let handle = null;
    if (typeof window.showSaveFilePicker === "function") {
      try {
        handle = await window.showSaveFilePicker({ suggestedName: name, types: [{ description: "PDF", accept: { "application/pdf": [".pdf"] } }] });
      } catch (e) {
        if (e?.name === "AbortError") return;
      }
    }
    setJob({ status: "making", name });
    try {
      const blob = await build();
      if (handle) {
        const w = await handle.createWritable();
        await w.write(blob);
        await w.close();
        setJob({ status: "saved", name, blob });
      } else {
        setJob({ status: "ready", name, blob });
      }
    } catch (e) {
      console.error("Контрольная PDF", e);
      setJob({ status: "error", name });
    }
  }
  async function save() {
    const file = new File([job.blob], job.name, { type: "application/pdf" });
    try {
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: job.name });
      else download(job.blob, job.name);
    } catch (e) {
      if (e?.name === "AbortError") return;
      download(job.blob, job.name);
    }
    setJob({ ...job, status: "saved" });
  }
  return { job, make, save, reset: () => setJob(null) };
}

export default function PdfDialog({ test, layout, onClose }) {
  const [answers, setAnswers] = useState(true);
  const pdf = usePdfSaver();
  const { job } = pdf;
  const pages = layout.pages.length;
  const totalPages = pages * (answers ? 2 : 1);
  const thumbW = 110;
  return (
    <div className="mt-modal" role="dialog" aria-modal="true" aria-label="Контрольная в PDF" onClick={onClose}>
      <div className="mt-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="mt-modal-head">
          <h2>Контрольная в PDF</h2>
          <button type="button" className="mt-modal-x" onClick={onClose} aria-label="Закрыть">✕</button>
        </div>
        <div className="mt-pdf-previews">
          <span className="mt-thumb"><SheetSvg layout={layout} pageIndex={0} test={test} scale={thumbW / layout.grid.w} /></span>
          {answers && <span className="mt-thumb"><SheetSvg layout={layout} pageIndex={0} test={test} scale={thumbW / layout.grid.w} showAnswers /></span>}
          <span className="mt-pdf-count"><b>{totalPages} {totalPages === 1 ? "страница" : totalPages < 5 ? "страницы" : "страниц"} {layout.grid.w > 200 ? "А4" : "А5"}</b>{answers ? "лист и ответы" : "только лист"}</span>
        </div>
        <label className="mt-check">
          <span><b>Ответы для взрослого</b><span>копия листа с вписанными ответами, после листа</span></span>
          <input type="checkbox" checked={answers} onChange={(e) => { setAnswers(e.target.checked); pdf.reset(); }} />
        </label>
        {job?.status === "ready" ? (
          <button type="button" className="mt-primary" onClick={pdf.save}>Сохранить PDF</button>
        ) : (
          <button type="button" className="mt-primary" disabled={job?.status === "making"} onClick={() => pdf.make(pdfFileName(test.title), () => makeTestPdf(test, { answers }))}>
            {job?.status === "making" ? "Готовлю PDF…" : job?.status === "saved" ? "PDF сохранён — ещё раз" : job?.status === "error" ? "Не получилось — ещё раз" : "Сохранить PDF"}
          </button>
        )}
      </div>
    </div>
  );
}
