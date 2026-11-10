import { useEffect, useId, useRef, useState } from "react";
import { createDrawingPlayer } from "./player.js";
import { toolForStep } from "./lessonPlan.js";
import "./drawing.css";

export default function DrawingRenderer({ task, sessionParams, onAdvance }) {
  const lesson = task?.lesson;
  const svgRef = useRef(null);
  const playerRef = useRef(null);
  const prefix = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [state, setState] = useState({ index: 0, busy: false, paused: false });
  const [speed, setSpeed] = useState(sessionParams?.speed ?? "normal");

  useEffect(() => {
    if (!lesson || !svgRef.current) return;
    const player = createDrawingPlayer(svgRef.current, lesson, setState, prefix);
    playerRef.current = player;
    return () => { player.dispose(); playerRef.current = null; };
  }, [lesson, prefix]);
  useEffect(() => { playerRef.current?.setSpeed(speed); }, [speed, lesson]);

  if (!lesson?.steps?.length) return <div className="drawing-lesson">Рисунок недоступен. Переустановите тему.</div>;
  const { index, busy, paused } = state;
  const finished = index >= lesson.steps.length;
  const step = lesson.steps[index];
  const toolContext = toolForStep(lesson, index);
  const instruction = paused ? "Пауза. Продолжай, когда будешь готов."
    : busy ? step.title : finished ? `${lesson.title} готов!`
    : `${step.title}.`;
  const next = () => playerRef.current?.next();

  return <section className="drawing-lesson" aria-label={`Рисуем: ${lesson.title}`}>
    <div className="drawing-lesson__heading">
      <h2>{lesson.title}</h2>
      <span className="drawing-lesson__count">{index} / {lesson.steps.length}</span>
    </div>
    {toolContext && <div className="drawing-lesson__tool" role="img" aria-label={toolContext.tool.name}
      style={{ "--drawing-pencil": toolContext.tool.color }}>
      <svg key={toolContext.tool.id} className="drawing-lesson__pencil" viewBox="0 0 268 80" aria-hidden="true">
        <ellipse cx="132" cy="68" rx="100" ry="4" fill="#26352d" opacity=".08" />
        <g transform="rotate(-5 134 38)">
          <path d="M190 18 248 37 190 56Z" fill="#e9bf87" />
          <path d="M190 18 248 37 194 35Z" fill="#f8dbad" />
          <path d="M190 56 248 37 194 40Z" fill="#d9a56c" />
          <path d="M30 18H190Q197 28 190 37Q197 47 190 56H30Q20 56 20 46V28Q20 18 30 18Z" fill="var(--drawing-pencil)" />
          <path d="M30 18H190Q193 23 193 28H24V25Q24 18 30 18Z" fill="white" opacity=".28" />
          <path d="M24 46H193Q194 51 190 56H30Q24 56 24 50Z" fill="black" opacity=".13" />
          <path d="M232 31.8 248 37 232 42.2Z" fill="var(--drawing-pencil)" />
          <path d="M36 24H165" stroke="white" strokeWidth="3" strokeLinecap="round" opacity=".32" />
          <path d="M31 19V55" stroke="black" strokeWidth="2" opacity=".08" />
          <path d="M204 29 226 36M204 46 222 39" stroke="#c9955d" strokeWidth="1.2" strokeLinecap="round" opacity=".45" />
        </g>
      </svg>
    </div>}
    <span className="drawing-lesson__status" role="status" aria-live="polite">{instruction}</span>
    <div className="drawing-lesson__paper" role="button" tabIndex={0}
      aria-label="Показать следующий шаг" aria-disabled={busy || finished}
      onClick={next} onKeyDown={event => {
        if (event.key === "Enter" || event.key === " ") { event.preventDefault(); next(); }
      }}>
      <svg ref={svgRef} viewBox={lesson.viewBox} role="img" aria-label={lesson.title} />
    </div>
    <progress className="drawing-lesson__progress" value={index} max={lesson.steps.length} aria-label="Шаги рисунка" />
    <div className="drawing-lesson__controls">
      <button type="button" disabled={busy || !index} onClick={() => playerRef.current?.back()}>Назад</button>
      <button type="button" disabled={busy || !index} onClick={() => playerRef.current?.repeat()}>Повторить</button>
      <button type="button" className="drawing-lesson__next" disabled={busy}
        onClick={finished ? onAdvance : next}>{finished ? "Закончить рисунок" : index ? "Дальше" : "Начать"}</button>
    </div>
    <div className="drawing-lesson__options">
      <label>Темп <select value={speed} onChange={event => setSpeed(event.target.value)}>
        <option value="slow">Медленно</option><option value="normal">Обычно</option><option value="fast">Быстро</option>
      </select></label>
      {busy && <button type="button" onClick={() => playerRef.current?.togglePause()}>{paused ? "Продолжить" : "Пауза"}</button>}
      <button type="button" onClick={() => playerRef.current?.reset()}>Сначала</button>
    </div>
  </section>;
}
