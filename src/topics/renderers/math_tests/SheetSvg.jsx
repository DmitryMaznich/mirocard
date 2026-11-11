import { memo } from "react";
import { pagePrimitives } from "./layout.js";

const PX_PER_MM = 96 / 25.4;

// One page of the test on screen, drawn from the same shapes as the PDF (layout.js pagePrimitives).
// `scale` = screen px per mm of paper. In the editor a click on a block selects it; when solving a
// tap on an answer box focuses it.
function SheetSvg({ layout, pageIndex, test, scale = PX_PER_MM, values, marks, focus, showAnswers, selectedBlockId, onSelectBlock, onFocusBlank, className = "" }) {
  const { grid } = layout;
  const page = layout.pages[pageIndex];
  if (!page) return null;
  const prims = pagePrimitives(layout, pageIndex, { test, values, marks, focus, showAnswers });
  const sel = selectedBlockId ? page.blocks.find((b) => b.block.id === selectedBlockId) : null;
  const { cell, ox, oy } = grid;
  return (
    <svg
      className={`mt-sheet ${className}`}
      viewBox={`0 0 ${grid.w} ${grid.h}`}
      width={grid.w * scale}
      height={grid.h * scale}
      role="img"
      aria-label={`Страница ${pageIndex + 1}`}
    >
      <rect x="0" y="0" width={grid.w} height={grid.h} fill="#fff" />
      {prims.map((p, i) => {
        if (p.k === "line") return <line key={i} x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} stroke={p.stroke} strokeWidth={p.w} strokeLinecap={p.cap ?? "butt"} />;
        if (p.k === "path") return <path key={i} d={p.d} stroke={p.stroke} strokeWidth={p.w} fill={p.fill} strokeLinecap="round" strokeLinejoin="round" />;
        if (p.k === "circle") return <circle key={i} cx={p.cx} cy={p.cy} r={p.r} stroke={p.stroke} strokeWidth={p.w2} fill={p.fill} />;
        if (p.k === "rect") {
          const blank = p.role === "blank" && onFocusBlank;
          return (
            <rect
              key={i}
              x={p.x} y={p.y} width={p.w} height={p.h} rx={p.rx}
              stroke={p.stroke} strokeWidth={p.w2} fill={p.fill === "none" && blank ? "rgba(255,255,255,0.001)" : p.fill}
              data-blank={p.blankKey}
              className={blank ? "mt-blank" : undefined}
              onClick={blank ? (e) => { e.stopPropagation(); onFocusBlank(p.blankKey); } : undefined}
            />
          );
        }
        if (p.k === "text") {
          return <text key={i} x={p.x} y={p.y} fontSize={p.size} fontWeight={p.weight} fill={p.fill} textAnchor={p.anchor} fontFamily="Nunito, system-ui, sans-serif">{p.text}</text>;
        }
        return null;
      })}
      {onSelectBlock && page.blocks.map((b) => (
        <rect
          key={b.block.id}
          className="mt-block-hit"
          x={ox + cell * 0.6} y={oy + b.r0 * cell - cell * 0.4}
          width={(grid.cols - 1.2) * cell} height={(b.h + 0.8) * cell}
          rx={cell * 0.5}
          fill="transparent"
          onClick={(e) => { e.stopPropagation(); onSelectBlock(b.block.id); }}
        />
      ))}
      {sel && (
        <rect
          className="mt-block-sel"
          x={ox + cell * 0.6} y={oy + sel.r0 * cell - cell * 0.4}
          width={(grid.cols - 1.2) * cell} height={(sel.h + 0.8) * cell}
          rx={cell * 0.5}
          fill="rgba(74,155,143,0.08)" stroke="#4a9b8f" strokeWidth={cell * 0.12}
          pointerEvents="none"
        />
      )}
    </svg>
  );
}

export default memo(SheetSvg);
export { PX_PER_MM };
