import { PrintPageTop } from "@/topics/renderers/propis/PrintPageView";
import { FIELDS, accentColor, coverTitle, presetOf } from "./coverConfig.js";

// The front of the cover, drawn from a cover config (coverConfig.js) and the notebook. One component for the print (an A5 / A4 page)
// and the previews: every size is a share of the cover's own width (container query units), the decorations are SVG in the same
// shares, so the preview is the cover itself, only smaller. Pure: the engine tasks come in ready (coverTasks.js).
export default function CoverTemplate({ cover, title, tasks = {}, sampleTask = null, a4 = false }) {
  const name = coverTitle(cover, title);
  const { decor } = cover;
  const hasWindow = decor === "sample-window";
  const preset = presetOf(cover);
  return (
    <div
      className={`p2-cover${a4 ? " p2-cover--a4" : ""}${hasWindow ? " p2-cover--window" : ""}`}
      style={{ "--p2-accent": accentColor(cover.accent) }}
      data-testid={`propis2-cover-${preset ?? "custom"}`}
      data-decor={decor}
    >
      {(decor === "frame" || decor === "corners") && <Ornament kind={decor} />}
      {decor === "ruling-band" && tasks.bandTask && <div className="p2-cover-band p2-cover-band--top"><PrintPageTop task={tasks.bandTask} rows={2} /></div>}
      {decor === "elements-band" && tasks.elementsTask && <div className="p2-cover-band p2-cover-band--bottom"><PrintPageTop task={tasks.elementsTask} rows={1} /></div>}
      <div className={hasWindow ? "p2-cover-top" : "p2-cover-mid"}>
        {cover.title.kicker && <div className="p2-cover-kicker">ТЕТРАДЬ</div>}
        {cover.title.style === "cursive"
          ? <div className="p2-cover-ruled">{tasks.titleTask && <PrintPageTop task={tasks.titleTask} rows={2} />}</div>
          : <div className={`p2-cover-name${hasWindow || !cover.title.kicker ? " p2-cover-name--big" : ""}`}>{name}</div>}
        {hasWindow && <div className="p2-cover-window">{sampleTask && <PrintPageTop task={sampleTask} rows={6} />}</div>}
        {cover.fields.length > 0 && (
          <div className="p2-cover-fields">
            {FIELDS.filter((f) => cover.fields.includes(f.id)).map((f) => <div key={f.id} className="p2-cover-field"><span>{f.label}</span><i /></div>)}
          </div>
        )}
      </div>
      {cover.logo && <div className="p2-cover-logo">Mironium</div>}
    </div>
  );
}

// A frame (a double line along the edge) or four ornamental corners, in the accent colour. The viewBox is the page in shares of its
// width (A5 and A4 are both 1 : √2).
const H = 141.42;
const CORNER = "M5 26 V12 Q5 5 12 5 H26 M9 20 V13 Q9 9 13 9 H20 M5 12 Q12 12 12 5";
function Ornament({ kind }) {
  return (
    <svg className="p2-cover-ornament" viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" aria-hidden="true">
      {kind === "frame" ? (
        <>
          <rect x="4" y="4" width="92" height={H - 8} fill="none" stroke="var(--p2-accent)" strokeWidth="0.7" />
          <rect x="5.6" y="5.6" width="88.8" height={H - 11.2} fill="none" stroke="var(--p2-accent)" strokeWidth="0.25" />
        </>
      ) : (
        [[0, 0, 1, 1], [100, 0, -1, 1], [0, H, 1, -1], [100, H, -1, -1]].map(([x, y, sx, sy]) => (
          <g key={`${x}-${y}`} transform={`translate(${x} ${y}) scale(${sx} ${sy})`}>
            <path d={CORNER} fill="none" stroke="var(--p2-accent)" strokeWidth="0.6" strokeLinecap="round" />
            <circle cx="16" cy="16" r="1.1" fill="var(--p2-accent)" />
          </g>
        ))
      )}
    </svg>
  );
}
