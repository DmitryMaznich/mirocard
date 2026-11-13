import { useMemo } from 'react';
import { shapeDefinition, frameTransform, partPoint, transformPoint } from './shapes.js';
import { resolveProfile } from './trackProfile.js';
const pathPoints = points => points.map(p => `${p.x},${p.y}`).join(' ');
export default function ShapeDrawing({ state, width = 'normal', passive = false, hint = false, demo = false, demoProgress = 0, demoLift = null, demoPart = null, drawing = false }) {
  const shape = useMemo(() => shapeDefinition(state.kind, state.variant), [state.kind, state.variant]);
  const profile = state.profile ?? resolveProfile(width);
  return <g data-shape={shape.id} data-size={shape.variant.scale} style={{ '--first-lines-marker-stroke': profile.markerStroke ?? 2, '--first-lines-goal-stroke': profile.goalStroke ?? 5 }}>
    {/* Guides are behind every stroke, including the shared corners of a square. */}
    {!passive && shape.parts.map((part, i) => {
      const active = i === state.part && !state.done;
      return <g key={i} transform={frameTransform(part.frame)}>
        <path className="first-lines__track" d={part.d} strokeWidth={profile.width / part.frame.scale} opacity={active || state.done ? 1 : .5} />
      </g>;
    })}
    {shape.parts.map((part, i) => {
      const s = state.parts[i];
      const fraction = demoPart === null ? Math.max(0, Math.min(1, (demoProgress * shape.length - shape.parts.slice(0, i).reduce((sum, p) => sum + p.travelLength, 0)) / part.travelLength)) : demoProgress;
      const tip = partPoint(part, fraction);
      return <g key={i} transform={frameTransform(part.frame)} data-part={i} style={{ '--first-lines-ink-width': profile.ink / part.frame.scale }}>
        {(s.history ?? []).map((history, n) => <g key={n} className="first-lines__history" aria-hidden="true">
          {history.strokes.map((stroke, index) => <polyline key={index} className={`first-lines__ink${history.reason === 'error' ? ' first-lines__ink--error' : ''}`} points={pathPoints(stroke.points)} />)}
          {history.marks.map((p, index) => <circle key={index} className="first-lines__mark" cx={p.x} cy={p.y} r={(profile.markRadius ?? 20) / part.frame.scale} />)}
        </g>)}
        {s.strokes.map((stroke, index) => <g key={index}>
          {stroke.points.length === 1 && <circle cx={stroke.points[0].x} cy={stroke.points[0].y} r={profile.ink / 2 / part.frame.scale} fill="#315b86" />}
          <polyline className="first-lines__ink" points={pathPoints(stroke.failedFrom === null ? stroke.points : stroke.points.slice(0, stroke.failedFrom + 1))} />
          {stroke.failedFrom !== null && <polyline className="first-lines__ink first-lines__ink--error" points={pathPoints(stroke.points.slice(stroke.failedFrom))} />}
        </g>)}
        {s.marks.map((p, index) => <circle key={index} className="first-lines__mark" cx={p.x} cy={p.y} r={(profile.markRadius ?? 20) / part.frame.scale} />)}
        {demo && (demoPart === null || demoPart === i) && <g className="first-lines__demo" aria-hidden="true">
          <path className="first-lines__demo-line" d={part.d} pathLength="1" strokeDashoffset={1 - fraction} />
          {(fraction > 0 && fraction < 1 || (demoPart === null ? i === 0 : i === demoPart) && demoProgress === 0 || (demoPart === null ? i === shape.parts.length - 1 : i === demoPart) && demoProgress === 1 && demoLift === null) && <circle className="first-lines__demo-tip" cx={tip.x} cy={tip.y} r={(profile.tipRadius ?? Math.max(6, profile.ink)) / part.frame.scale} />}
        </g>}
      </g>;
    })}
    {demo && demoLift !== null && (() => {
      const part = shape.parts[demoLift], end = transformPoint(partPoint(part, 1), part.frame);
      return <g className="first-lines__demo-lift" transform={`translate(${end.x} ${end.y}) scale(${profile.overlayScale ?? 1})`} aria-hidden="true">
        <path d="M22 8V-18M16-12l6-6 6 6" fill="none" stroke="#315b86" strokeWidth={profile.markerStroke ? profile.markerStroke / (profile.overlayScale ?? 1) * 2 : 6} strokeLinecap="round" strokeLinejoin="round" />
      </g>;
    })()}
    {!passive && !state.done && (() => {
      const part = shape.parts[state.part], current = state.parts[state.part];
      const from = drawing && current.strokes.length ? current.strokes.at(-1).points[0] : current.anchor;
      const start = transformPoint(from, part.frame);
      const finish = transformPoint(part.closed && current.start ? current.start : partPoint(part, 1), part.frame);
      const radius = (profile.markerRadius ?? Math.max(14, profile.width * .22));
      const fraction = part.type === 'line' ? (current.progress - 320) / 360 : current.progress / part.length;
      const lead = Array.from({ length: 12 }, (_, i) => transformPoint(partPoint(part, Math.min(1, fraction + (profile.leadLength ?? 44) / part.travelLength * i / 11)), part.frame));
      return <g className="first-lines__endpoints" aria-hidden="true">
        {!drawing && !current.needsReturn && <path className="first-lines__start-line" d={'M' + [start, ...lead].map(p => `${p.x} ${p.y}`).join('L')} strokeWidth={profile.leadInk ?? Math.max(6, profile.ink)} />}
        <circle className="first-lines__start-halo" cx={start.x} cy={start.y} r={radius + (profile.markerHalo ?? (hint || state.recovery ? 8 : 5))} />
        <circle className="first-lines__start" cx={start.x} cy={start.y} r={radius} fill="#0ba85b" />
        <circle className="first-lines__goal" cx={finish.x} cy={finish.y} r={profile.goalRadius ?? radius + 10} fill="none" stroke="#8153b5" />
      </g>;
    })()}
  </g>;
}
