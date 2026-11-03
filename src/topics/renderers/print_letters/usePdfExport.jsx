import { useEffect, useRef, useState } from "react";
import PrintPages from "./PrintPages";

// «PDF» instead of the print dialog (owner, 2026-11-03: «просто был диалог сохранить в PDF»).
// The PDF itself is made by the app (`makePdf`, src/features/printLetters/printLettersPdf.js) from
// the print sheets laid out off screen here. Saving:
//  - where the browser has a real «Save as» dialog (Chromium on a computer: showSaveFilePicker), it
//    is asked FIRST, right at the tap (it needs the tap's user activation), then the file is made and
//    written there;
//  - elsewhere (iPhone, iPad, Android) the file is made, then a small panel «PDF готов» offers
//    «Сохранить», whose own tap opens the system share sheet with «Сохранить в Файлы» (or downloads
//    it where there is no share sheet) — a share started seconds after the first tap would be refused.
// Without `makePdf` (an app older than this deck) it falls back to the browser's print.
const pdfFileName = (title) => `${String(title ?? "").replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim() || "Тетрадь"}.pdf`;

const canPickFile = () => typeof window !== "undefined" && typeof window.showSaveFilePicker === "function";

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

export default function usePdfExport({ makePdf, byId }) {
  const [job, setJob] = useState(null); // { nb, status: making|ready|saved|error, progress, blob, handle }
  const ref = useRef(null);

  async function start(nb) {
    if (!nb) return;
    if (!makePdf) { window.print(); return; }
    let handle = null;
    if (canPickFile()) {
      try {
        handle = await window.showSaveFilePicker({ suggestedName: pdfFileName(nb.title), types: [{ description: "PDF", accept: { "application/pdf": [".pdf"] } }] });
      } catch (e) {
        if (e?.name === "AbortError") return; // the person closed the dialog
        handle = null;
      }
    }
    setJob({ nb, status: "making", progress: 0, handle });
  }

  // the sheets are on the page now: make the file
  useEffect(() => {
    if (job?.status !== "making" || !ref.current) return undefined;
    let alive = true;
    (async () => {
      try {
        const blob = await makePdf(ref.current, { onProgress: (progress) => alive && setJob((j) => (j ? { ...j, progress } : j)) });
        if (!alive) return;
        if (job.handle) {
          const w = await job.handle.createWritable();
          await w.write(blob);
          await w.close();
          setJob((j) => ({ ...j, status: "saved", blob }));
        } else {
          setJob((j) => ({ ...j, status: "ready", blob }));
        }
      } catch (e) {
        console.error("print_letters PDF", e);
        if (alive) setJob((j) => ({ ...j, status: "error" }));
      }
    })();
    return () => { alive = false; };
  }, [job?.status, job?.nb]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (job?.status !== "saved") return undefined;
    const t = setTimeout(() => setJob(null), 2500);
    return () => clearTimeout(t);
  }, [job?.status]);

  async function save() {
    const name = pdfFileName(job.nb.title);
    const file = new File([job.blob], name, { type: "application/pdf" });
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: name });
      } else {
        download(job.blob, name);
      }
      setJob(null);
    } catch (e) {
      if (e?.name === "AbortError") return; // closed the share sheet: the panel stays
      download(job.blob, name);
      setJob(null);
    }
  }

  const node = job ? (
    <>
      {job.status === "making" && <PrintPages notebook={job.nb} byId={byId} exporting containerRef={ref} />}
      <div className="pl-pdf-toast no-print" role="status" aria-live="polite">
        {job.status === "making" && <span className="pl-pdf-msg">Готовлю PDF… {Math.round((job.progress ?? 0) * 100)}%</span>}
        {job.status === "ready" && <>
          <span className="pl-pdf-msg">PDF готов: «{job.nb.title || "Тетрадь"}»</span>
          <button type="button" className="pl-pdf-save" onClick={save}>Сохранить</button>
          <button type="button" className="pl-pdf-close" onClick={() => setJob(null)} aria-label="Закрыть">×</button>
        </>}
        {job.status === "saved" && <span className="pl-pdf-msg">PDF сохранён</span>}
        {job.status === "error" && <>
          <span className="pl-pdf-msg">Не получилось сделать PDF</span>
          <button type="button" className="pl-pdf-close" onClick={() => setJob(null)} aria-label="Закрыть">×</button>
        </>}
      </div>
    </>
  ) : null;

  return { start, busy: job?.status === "making", node };
}
