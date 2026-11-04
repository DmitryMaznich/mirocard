import Sheet from "./Sheet";
import { FORMATS, PAGE_MARGIN_MM, sheetSizeMm } from "./model";

// Every page of a notebook as its own physical sheet. Two uses: under @media print (the browser's
// print, kept as a fallback), and — with `exporting` — laid out off screen at real size for the PDF
// (usePdfExport.jsx): the data-* attributes carry the paper, margin and sheet sizes in mm.
export default function PrintPages({ notebook, byId, exporting = false, containerRef }) {
  if (!notebook) return null;
  const format = notebook.format ?? "a4";
  const { w, h } = FORMATS[format] ?? FORMATS.a4;
  const sheet = sheetSizeMm(format);
  return (
    <>
      {!exporting && <style>{`@media print { @page { size: ${w}mm ${h}mm; margin: ${PAGE_MARGIN_MM}mm; } }`}</style>}
      <div
        ref={containerRef}
        className={`pl-print-pages${exporting ? " pl-print-pages--export" : ""}`}
        data-format={format} data-paper-w={w} data-paper-h={h} data-margin={PAGE_MARGIN_MM} data-sheet-w={sheet.w} data-sheet-h={sheet.h}
        aria-hidden={exporting || undefined}
      >
        {notebook.pages.map((p) => (
          <Sheet key={p.id} page={p} format={format} byId={byId} className="pl-sheet--print" nameLine={notebook.nameLine !== false} />
        ))}
      </div>
    </>
  );
}
