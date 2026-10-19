import { useMemo } from "react";
import { gradeStrokes, gradeText } from "./gradeMark.js";

export default function GradeStamp({ grade }) {
  const { w, h, strokes } = useMemo(() => gradeStrokes(grade), [grade]);
  if (!strokes.length) return null;
  return (
    <svg className="propis2-grade-stamp" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Оценка ${gradeText(grade)}`} data-testid="propis2-grade-stamp">
      {strokes.map((s, i) => (
        <path key={i} d={s.d} pathLength="1" className="propis2-grade-stroke" style={{ animationDuration: `${s.ms}ms`, animationDelay: `${s.delay}ms` }} />
      ))}
    </svg>
  );
}

