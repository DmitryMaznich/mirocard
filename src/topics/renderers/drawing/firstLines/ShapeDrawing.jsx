import { shapeDefinition, frameTransform, partPoint, transformPoint } from './shapes.js';
import { resolveProfile } from './trackProfile.js';
const pathPoints = points => points.map(p => `${p.x},${p.y}`).join(' ');
export default function ShapeDrawing({ state, width = 'normal', passive = false, hint = false, demo = false, demoProgress = 0, demoLift = null, demoPart = null, drawing = false, ready = false }) {
  const shape = shapeDefinition(state.kind, state.variant);
  const profile = state.profile ?? resolveProfile(width);
  return <g data-shape={shape.id} data-size={shape.variant.scale}>
    {/* Guides are behind every stroke, including the shared corners of a square. */}
    {!passive && shape.parts.map((part, i) => {
      const active = i === state.part && !state.done, s = state.parts[i], start = s.anchor;
      return <g key={i} transform={frameTransform(part.frame)}>
        <path className="first-lines__track" d={part.d} strokeWidth={profile.width / part.frame.scale} opacity={active || state.done ? 1 : .5} />
        {active && !drawing && <circle className="first-lines__start" cx={start.x} cy={start.y} r={Math.max(10, profile.width * .22) / part.frame.scale} fill="#248b79" />}
      </g>;
    })}
    {shape.parts.map((part, i) => {
      const s = state.parts[i], active = i === state.part && !state.done;
      const fraction = demoPart === null ? Math.max(0, Math.min(1, (demoProgress * shape.length - shape.parts.slice(0, i).reduce((sum, p) => sum + p.travelLength, 0)) / part.travelLength)) : demoProgress;
      const tip = partPoint(part, fraction);
      return <g key={i} transform={frameTransform(part.frame)} data-part={i} style={{ '--first-lines-ink-width': profile.ink / part.frame.scale }}>
        {(s.history ?? []).map((history, n) => <g key={n} className="first-lines__history" aria-hidden="true">
          {history.strokes.map((stroke, index) => <polyline key={index} className={`first-lines__ink${history.reason === 'error' ? ' first-lines__ink--error' : ''}`} points={pathPoints(stroke.points)} />)}
          {history.marks.map((p, index) => <circle key={index} className="first-lines__mark" cx={p.x} cy={p.y} r={20 / part.frame.scale} />)}
        </g>)}
        {s.strokes.map((stroke, index) => <g key={index}>
          {stroke.points.length === 1 && <circle cx={stroke.points[0].x} cy={stroke.points[0].y} r={profile.ink / 2 / part.frame.scale} fill="#315b86" />}
          <polyline className="first-lines__ink" points={pathPoints(stroke.failedFrom === null ? stroke.points : stroke.points.slice(0, stroke.failedFrom + 1))} />
          {stroke.failedFrom !== null && <polyline className="first-lines__ink first-lines__ink--error" points={pathPoints(stroke.points.slice(stroke.failedFrom))} />}
        </g>)}
        {s.marks.map((p, index) => <circle key={index} className="first-lines__mark" cx={p.x} cy={p.y} r={20 / part.frame.scale} />)}
        {!passive && active && !drawing && (s.needsReturn || hint || s.strokes.length > 0 || state.recovery) && <circle className="first-lines__resume" cx={s.anchor.x} cy={s.anchor.y} r={Math.max(profile.width / 2, profile.resume * .55) / part.frame.scale} />}
        {!passive && active && (shape.parts.length > 1 || part.closed && s.start) && (() => {
          const end = part.closed && s.start ? s.start : partPoint(part, 1);
          return <g className={`first-lines__goal${ready ? ' first-lines__goal--ready' : ''}`} transform={`translate(${end.x} ${end.y})`}>
            <circle r={16 / part.frame.scale} fill="white" stroke="#248b79" strokeWidth={4 / part.frame.scale} />
            {ready && <path d="m-8 0 6 6 12-14" fill="none" stroke="#248b79" strokeWidth="4" />}
          </g>;
        })()}
        {demo && (demoPart === null || demoPart === i) && <g className="first-lines__demo" aria-hidden="true">
          <path className="first-lines__demo-line" d={part.d} pathLength="1" strokeDashoffset={1 - fraction} />
          {(fraction > 0 && fraction < 1 || (demoPart === null ? i === 0 : i === demoPart) && demoProgress === 0 || (demoPart === null ? i === shape.parts.length - 1 : i === demoPart) && demoProgress === 1 && demoLift === null) && <circle className="first-lines__demo-tip" cx={tip.x} cy={tip.y} r={Math.max(6, profile.ink) / part.frame.scale} />}
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
      const part = shape.parts.at(-1), end = transformPoint(partPoint(part, 1), part.frame);
      return <path className="first-lines__house" transform={`translate(${end.x - 680} ${end.y - 500})`} d="M653 494v40h54v-40M644 496l36-32 36 32M674 534v-22h13v22" />;
    })()}
  </g>;
}
