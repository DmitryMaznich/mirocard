import Sheet from "./Sheet";
import { FORMATS, PAGE_MARGIN_MM } from "./model";

// Every page of a notebook as its own physical sheet — shown only by
// @media print. The printer's paper size follows the notebook's format.
export default function PrintPages({ notebook, byId }) {
  if (!notebook) return null;
  const format = notebook.format ?? "a4";
  const { w, h } = FORMATS[format] ?? FORMATS.a4;
  return (
    <>
      <style>{`@media print { @page { size: ${w}mm ${h}mm; margin: ${PAGE_MARGIN_MM}mm; } }`}</style>
      <div className="pl-print-pages">
        {notebook.pages.map((p) => (
          <Sheet key={p.id} page={p} format={format} byId={byId} className="pl-sheet--print" />
        ))}
      </div>
    </>
  );
}
