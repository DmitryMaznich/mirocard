import { useEffect, useId, useRef, useState } from "react";
import { createDrawingPlayer } from "./player.js";
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
  const instruction = paused ? "Пауза. Продолжай, когда будешь готов."
    : busy ? step.title : finished ? `${lesson.title} готов!`
    : index === 0 ? "Коснись листа, чтобы начать." : `Дальше: ${step.title.toLowerCase()}.`;
  const next = () => playerRef.current?.next();

  return <section className="drawing-lesson" aria-label={`Рисуем: ${lesson.title}`}>
    <div className="drawing-lesson__heading">
      <h2>{lesson.title}</h2>
      <span className="drawing-lesson__count">{index} / {lesson.steps.length}</span>
    </div>
    <p className="drawing-lesson__instruction" aria-live="polite">{instruction}</p>
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
