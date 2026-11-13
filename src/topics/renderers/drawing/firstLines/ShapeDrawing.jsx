import { shapeDefinition, frameTransform, partPoint, transformPoint } from './shapes.js';
import { TRACK_WIDTHS } from './lineAttempt.js';
const pathPoints = points => points.map(p => `${p.x},${p.y}`).join(' ');
export default function ShapeDrawing({ state, width = 'normal', passive = false, hint = false, demo = false, demoProgress = 0, demoLift = null }) {
  const shape = shapeDefinition(state.kind);
  return <g data-shape={shape.id}>
    {/* Guides are behind every stroke, including the shared corners of a square. */}
    {!passive && shape.parts.map((part, i) => {
      const active = i === state.part && !state.done, start = partPoint(part, 0);
      return <g key={i} transform={frameTransform(part.frame)}>
        <path className="first-lines__track" d={part.d} strokeWidth={TRACK_WIDTHS[width] ?? 100} opacity={active || state.done ? 1 : .5} />
        {active && <circle cx={start.x} cy={start.y} r="22" fill="#248b79" />}
      </g>;
    })}
    {shape.parts.map((part, i) => {
      const s = state.parts[i], active = i === state.part && !state.done;
      const fraction = Math.max(0, Math.min(1, (demoProgress * shape.length - shape.parts.slice(0, i).reduce((sum, p) => sum + p.length, 0)) / part.length));
      const tip = partPoint(part, fraction);
      return <g key={i} transform={frameTransform(part.frame)} data-part={i}>
        {s.strokes.map((stroke, index) => <g key={index}>
          {stroke.points.length === 1 && <circle cx={stroke.points[0].x} cy={stroke.points[0].y} r="7" fill="#315b86" />}
          <polyline className="first-lines__ink" points={pathPoints(stroke.failedFrom === null ? stroke.points : stroke.points.slice(0, stroke.failedFrom + 1))} />
          {stroke.failedFrom !== null && <polyline className="first-lines__ink first-lines__ink--error" points={pathPoints(stroke.points.slice(stroke.failedFrom))} />}
        </g>)}
        {s.marks.map((p, index) => <circle key={index} className="first-lines__mark" cx={p.x} cy={p.y} r="22" />)}
        {!passive && active && (s.needsReturn || hint || s.strokes.length > 0) && <circle className="first-lines__resume" cx={s.anchor.x} cy={s.anchor.y} r="34" />}
        {demo && <g className="first-lines__demo" aria-hidden="true">
          <path className="first-lines__demo-line" d={part.d} pathLength="1" strokeDashoffset={1 - fraction} />
          {(fraction > 0 && fraction < 1 || i === 0 && demoProgress === 0 || i === shape.parts.length - 1 && demoProgress === 1 && demoLift === null) && <circle className="first-lines__demo-tip" cx={tip.x} cy={tip.y} r="16" />}
        </g>}
      </g>;
    })}
    {demo && demoLift !== null && (() => {
      const part = shape.parts[demoLift], end = transformPoint(partPoint(part, 1), part.frame);
      return <g className="first-lines__demo-lift" transform={`translate(${end.x} ${end.y})`} aria-hidden="true">
        <circle r="20" fill="none" stroke="#315b86" strokeWidth="5" strokeDasharray="6 5" />
        <path d="M38 12V-36M25-23l13-13 13 13" fill="none" stroke="#315b86" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      </g>;
    })()}
    {!passive && !shape.closed && (() => {
      const end = transformPoint(partPoint(shape.parts[0], 1), shape.parts[0].frame);
      return <path className="first-lines__house" transform={`translate(${end.x - 680} ${end.y - 500})`} d="M653 494v40h54v-40M644 496l36-32 36 32M674 534v-22h13v22" />;
    })()}
  </g>;
}
