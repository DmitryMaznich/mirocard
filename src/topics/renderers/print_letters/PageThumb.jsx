import Sheet from "./Sheet";
import { sheetSizeMm } from "./model";

const THUMB_W = 80; // px
const PX_PER_MM = 96 / 25.4;

// Non-interactive miniature of a page — the real Sheet at a CSS scale, not a
// schematic (propis2's own Propis2Thumbs does the same), so the thumbnail
// always matches the page, including its format's proportions.
export default function PageThumb({ page, format, byId, active, index, onSelect, compact = false }) {
  const { w, h } = sheetSizeMm(format);
  const thumbW = compact ? 40 : THUMB_W;
  const scale = thumbW / (w * PX_PER_MM);
  return (
    <button type="button" className={`pl-thumb${active ? " is-active" : ""}`} onClick={onSelect} aria-label={`Страница ${index + 1}`} aria-current={active ? "page" : undefined}>
      {!compact && <span className="pl-thumb-num">{index + 1}</span>}
      <span className="pl-thumb-sheet" style={{ width: thumbW, height: Math.round(thumbW * h / w) }}>
        <span className="pl-thumb-scale" style={{ transform: `scale(${scale})` }}>
          <Sheet page={page} format={format} byId={byId} className="pl-sheet--thumb" />
        </span>
      </span>
      {compact && <span className="pl-thumb-num">{index + 1}</span>}
    </button>
  );
}
