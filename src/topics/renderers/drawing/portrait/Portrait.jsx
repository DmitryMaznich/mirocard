// «Портрет по кубику» (drawing_portrait): the child draws a face on paper part by part;
// a die (a real one or one on the screen) picks which of six variants to draw. Not evaluated.
import { useEffect, useRef, useState } from 'react';
import { FACES, HAIR_TRANSFORMS, PART_FILLS, PART_LABELS, PART_NAMES, PART_TRANSFORMS, PARTS, PLACEMENTS } from './parts.js';
import { STEPS, back, chooseShape, next, pick, portraitKey, readPortrait, savePortrait, freshPortrait } from './state.js';
import './portrait.css';

const PIPS = [[4], [0, 8], [0, 4, 8], [0, 2, 6, 8], [0, 2, 4, 6, 8], [0, 2, 3, 5, 6, 8]];
const ROLL_MS = 900;

function Die({ value, size = 'small' }) {
  return <span className={`portrait-die portrait-die--${size}`} aria-hidden="true">
    {Array.from({ length: 9 }, (_, i) => <span key={i} className={value && PIPS[value - 1].includes(i) ? 'portrait-pip' : ''} />)}
  </span>;
}
function PartArt({ part, value }) {
  const fill = part < 2 ? PART_FILLS[part][value - 1] : '';
  return <><path d={PARTS[part][value - 1]} />{fill && <path d={fill} fill="currentColor" stroke="none" />}</>;
}
function PartIcon({ part, value }) {
  return <svg viewBox="0 0 180 160" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><PartArt part={part} value={value} /></svg>;
}
// The face with the parts already drawn; the current one in the accent colour, or a dashed place for it.
export function Face({ shape, results, current = null, hint = true, className = 'portrait-face' }) {
  const place = PLACEMENTS[results.length];
  const transform = part => part === 6 ? HAIR_TRANSFORMS[shape] : PART_TRANSFORMS[part];
  return <svg className={className} viewBox="0 -28 220 268" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={FACES[shape].path} />
    {results.map((value, part) => <g key={part} transform={transform(part)}><PartArt part={part} value={value} /></g>)}
    {current !== null && <g className="portrait-face__current" transform={transform(results.length)}><PartArt part={results.length} value={current} /></g>}
    {hint && current === null && place && <ellipse className="portrait-face__place" cx={place[0]} cy={place[1]} rx={place[2]} ry={place[3]} />}
  </svg>;
}
// Printing goes through a hidden frame: a pop-up is often blocked in an installed app.
function printSvg(title, svg) {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true'); frame.style.cssText = 'position:fixed;width:0;height:0;border:0;left:-9999px';
  document.body.append(frame);
  const doc = frame.contentDocument;
  doc.open();
  doc.write(`<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>${title}</title><style>@page{size:A4;margin:12mm}body{margin:0;display:flex;justify-content:center}svg{width:170mm;height:210mm;color:#222}</style></head><body>${svg}</body></html>`);
  doc.close();
  setTimeout(() => { try { frame.contentWindow.focus(); frame.contentWindow.print(); } finally { setTimeout(() => frame.remove(), 1000); } }, 100);
}

export default function Portrait({ student, sessionParams, interactionDisabled = false, onClose, onAdvance, AdultButton, AdultDialog }) {
  const key = portraitKey(student?.id);
  const [state, setState] = useState(() => readPortrait(key));
  const [rolling, setRolling] = useState(null);
  const [menu, setMenu] = useState(null);
  const faceRef = useRef(null);
  const screenDie = sessionParams?.dice === 'screen';
  useEffect(() => { savePortrait(key, state); }, [key, state]);
  const part = state.results.length;
  const finish = () => { setMenu(null); (onClose ?? onAdvance)?.(); };
  const update = change => setState(previous => change(previous));

  // An on-screen throw: the faces flicker for a moment, then the die lands and picks the variant itself.
  useEffect(() => {
    if (rolling === null) return undefined;
    const final = 1 + Math.floor(Math.random() * 6);
    const flicker = setInterval(() => setRolling(1 + Math.floor(Math.random() * 6)), 90);
    const land = setTimeout(() => { clearInterval(flicker); setRolling(null); update(s => pick(s, final)); }, ROLL_MS);
    return () => { clearInterval(flicker); clearTimeout(land); };
  }, [rolling !== null]); // eslint-disable-line react-hooks/exhaustive-deps

  const print = blank => {
    const shape = state.shape ?? 0;
    const done = faceRef.current?.querySelector('svg')?.outerHTML;
    const svg = done && !blank ? done
      : `<svg viewBox="0 -28 220 268" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="${FACES[shape].path}"/></svg>`;
    printSvg(blank ? 'Портрет по кубику — контур лица' : 'Мой портрет по кубику', svg);
  };

  const adult = <AdultDialog page={menu} onDismiss={() => setMenu(null)}>
    <div className="drawing-dialog__heading"><h3>Для взрослого</h3><button type="button" onClick={() => setMenu(null)} aria-label="Закрыть настройки">×</button></div>
    {state.phase !== 'shape' && <p className="drawing-parent-progress">{state.phase === 'done' ? 'Портрет готов' : `${PART_NAMES[part]} · шаг ${part + 1} из ${STEPS}`}</p>}
    <div className="drawing-dialog__actions portrait-adult-actions">
      <button type="button" onClick={() => print(true)}>Распечатать контур лица</button>
      {state.phase === 'done' && <button type="button" onClick={() => print(false)}>Распечатать портрет</button>}
      {state.phase !== 'shape' && <button type="button" onClick={() => { setRolling(null); update(back); setMenu(null); }}>Вернуться на шаг</button>}
      {state.phase !== 'shape' && <button type="button" onClick={() => { setRolling(null); setState(freshPortrait()); setMenu(null); }}>Начать новый портрет</button>}
      <button type="button" onClick={finish}>Закончить занятие</button>
    </div>
    <p className="drawing-adult-note">Чтобы открыть это меню, удерживайте шестерёнку. Кубик: {screenDie ? 'на экране' : 'настоящий'} — меняется в настройках режима.</p>
  </AdultDialog>;

  if (state.phase === 'shape') return <section className="drawing-lesson drawing-shell portrait" data-phase="shape" aria-label="Портрет по кубику: выбери лицо">
    <header className="drawing-top portrait-top"><h2>Какое лицо?</h2><AdultButton onOpen={() => setMenu('settings')} /></header>
    <div className="portrait-shapes">{FACES.map((face, i) => <button type="button" key={face.name} className="portrait-shape" aria-label={face.name} disabled={interactionDisabled}
      onClick={() => update(s => chooseShape(s, i))}>
      <svg viewBox="0 -28 220 268" fill="none" stroke="currentColor" strokeWidth="5" strokeLinejoin="round" aria-hidden="true"><path d={face.path} /></svg>
    </button>)}</div>
    {adult}
  </section>;

  if (state.phase === 'done') return <section className="drawing-lesson drawing-shell portrait" data-phase="done" aria-label="Портрет готов">
    <header className="drawing-top portrait-top"><h2>Портрет готов</h2><AdultButton onOpen={() => setMenu('settings')} /></header>
    <div className="portrait-done" ref={faceRef}><Face shape={state.shape} results={state.results} hint={false} className="portrait-face portrait-face--done" /></div>
    <div className="portrait-done-actions">
      <button type="button" className="portrait-round" aria-label="Новый портрет" disabled={interactionDisabled} onClick={() => setState(freshPortrait())}>
        <svg viewBox="0 0 36 36" aria-hidden="true"><path d="M7 10a11 11 0 1 1-1 14M7 3v8h8" /></svg></button>
      <button type="button" className="portrait-round portrait-round--quiet" aria-label="Закончить" disabled={interactionDisabled} onClick={finish}>
        <svg viewBox="0 0 36 36" aria-hidden="true"><path d="M5 17 18 6l13 11M9 14v15h18V14" /></svg></button>
    </div>
    {adult}
  </section>;

  const chosen = rolling ?? state.value;
  return <section className="drawing-lesson drawing-shell portrait" data-phase="part" data-part={part} data-chosen={state.value ?? undefined} aria-label={`Портрет по кубику: ${PART_NAMES[part]}`}>
    <header className="drawing-top portrait-top">
      <h2>{PART_NAMES[part]}</h2>
      <ol className="portrait-steps" aria-label={`Шаг ${part + 1} из ${STEPS}`}>{PART_NAMES.map((name, i) => <li key={name} className={i < part ? 'is-done' : i === part ? 'is-current' : ''} />)}</ol>
      <AdultButton onOpen={() => setMenu('settings')} />
    </header>
    <div className="portrait-work">
      <div className="portrait-options" role="group" aria-label={`Варианты: ${PART_NAMES[part].toLowerCase()}`}>
        {PARTS[part].map((_, i) => {
          const value = i + 1, selected = chosen === value;
          return <button type="button" key={value} className={`portrait-option${selected ? ' is-selected' : ''}${chosen && !selected ? ' is-dim' : ''}`}
            aria-label={`${value}: ${PART_LABELS[part][i]}`} aria-pressed={selected}
            disabled={interactionDisabled || screenDie || rolling !== null} onClick={() => update(s => pick(s, value))}>
            <Die value={value} /><PartIcon part={part} value={value} />
          </button>;
        })}
      </div>
      <div className="portrait-stage">
        <Face shape={state.shape} results={state.results} current={state.value} />
        {screenDie && state.value === null && <button type="button" className="portrait-roll" aria-label="Бросить кубик" disabled={interactionDisabled || rolling !== null}
          data-rolling={rolling !== null || undefined} onClick={() => {
            if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) update(s => pick(s, 1 + Math.floor(Math.random() * 6)));
            else setRolling(1 + Math.floor(Math.random() * 6));
          }}><Die value={rolling ?? 5} size="big" /></button>}
      </div>
    </div>
    {state.value !== null && <button type="button" className="portrait-next" aria-label={part + 1 === STEPS ? 'Готово' : 'Дальше'} disabled={interactionDisabled}
      onClick={() => update(next)}><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M11 24h24M25 13l11 11-11 11" /></svg></button>}
    <span className="drawing-sr-only" role="status" aria-live="polite">{state.value === null ? (screenDie ? 'Брось кубик' : 'Брось кубик и выбери') : `${PART_LABELS[part][state.value - 1]}. Нарисуй на бумаге`}</span>
    {adult}
  </section>;
}
