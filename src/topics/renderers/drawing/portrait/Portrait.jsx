// «Портрет по кубику» (drawing_portrait): the child draws a face on paper part by part;
// a die (a real one or one on the screen) picks which of six variants to draw. Not evaluated.
// The adult picks the style (styles.js); the chosen variant is then drawn stroke by stroke as a model.
import { useEffect, useMemo, useRef, useState } from 'react';
import { STYLES, normalizeStyle, styleSteps } from './styles.js';
import { back, chooseShape, next, pick, portraitKey, readPortrait, savePortrait, freshPortrait, stepCount } from './state.js';
import { sampleSubpaths, timeline, timelineEnd } from './drawPath.js';
import './portrait.css';

const PIPS = [[4], [0, 8], [0, 4, 8], [0, 2, 6, 8], [0, 2, 4, 6, 8], [0, 2, 3, 5, 6, 8]];
const ROLL_MS = 900;

function Die({ value, size = 'small' }) {
  return <span className={`portrait-die portrait-die--${size}`} aria-hidden="true">
    {Array.from({ length: 9 }, (_, i) => <span key={i} className={value && PIPS[value - 1].includes(i) ? 'portrait-pip' : ''} />)}
  </span>;
}
const Art = ({ variant }) => <><path d={variant.d} />{variant.fill && <path d={variant.fill} fill="currentColor" stroke="none" />}</>;

// The chosen part, traced subpath by subpath with a pencil tip; fills (pupils, dots) appear at the end.
function TracedArt({ variant, play }) {
  const subpaths = useMemo(() => sampleSubpaths(variant.d), [variant.d]);
  const spans = useMemo(() => subpaths ? timeline(subpaths) : [], [subpaths]);
  const end = timelineEnd(spans);
  const [elapsed, setElapsed] = useState(() => subpaths && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0 : Infinity);
  useEffect(() => {
    if (!subpaths || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    let frame, started;
    const tick = time => { started ??= time; const t = time - started; setElapsed(t); if (t < end) frame = requestAnimationFrame(tick); };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [subpaths, end, play]);
  if (!subpaths || elapsed >= end) return <Art variant={variant} />;
  const traced = subpaths.map((sub, i) => {
    const span = spans[i], share = Math.max(0, Math.min(1, (elapsed - span.start) / span.ms));
    return { share, points: sub.points.slice(0, Math.max(1, Math.round(share * (sub.points.length - 1))) + 1) };
  });
  const tip = traced.find(t => t.share > 0 && t.share < 1)?.points.at(-1);
  return <>{traced.map((t, i) => t.share > 0 && <polyline key={i} points={t.points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')} />)}
    {tip && <circle className="portrait-tip" cx={tip.x} cy={tip.y} r="3.2" fill="currentColor" stroke="none" />}</>;
}

// The face with the parts already drawn; the current one in the accent colour, or a dashed place for it.
function Face({ viewBox, face, steps, results, current = null, hint = true, play = 0, className = 'portrait-face' }) {
  const step = steps[results.length];
  return <svg className={className} viewBox={viewBox} fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={face.path} />
    {results.map((value, i) => <g key={i} transform={steps[i].transform}><Art variant={steps[i].variants[value - 1]} /></g>)}
    {current !== null && <g className="portrait-face__current" transform={step.transform}><TracedArt key={`${results.length}:${current}:${play}`} variant={step.variants[current - 1]} play={play} /></g>}
    {hint && current === null && step?.places.map((p, i) => <ellipse key={i} className="portrait-face__place" cx={p[0]} cy={p[1]} rx={p[2]} ry={p[3]} />)}
  </svg>;
}
function VariantIcon({ step, variant, face }) {
  return <svg viewBox={step.icon.join(' ')} fill="none" stroke="currentColor" strokeWidth={Math.max(2.4, step.icon[2] / 34)} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {step.ghost && <path d={face.path} className="portrait-ghost" />}<g transform={step.ownSpace ? undefined : step.transform}><Art variant={variant} /></g>
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
  const styleId = normalizeStyle(sessionParams?.style);
  const [state, setState] = useState(() => readPortrait(key, styleId));
  const [rolling, setRolling] = useState(null);
  const [play, setPlay] = useState(0);
  const [menu, setMenu] = useState(null);
  const faceRef = useRef(null);
  const screenDie = sessionParams?.dice === 'screen';
  useEffect(() => { savePortrait(key, state); }, [key, state]);
  const style = STYLES[state.style], total = stepCount(state.style);
  const steps = useMemo(() => state.shape === null ? null : styleSteps(state.style, state.shape), [state.style, state.shape]);
  const face = style.faces[state.shape ?? 0];
  const part = state.results.length, step = steps?.[part];
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
    const done = faceRef.current?.querySelector('svg')?.outerHTML;
    const svg = done && !blank ? done
      : `<svg viewBox="${style.viewBox}" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="${face.path}"/></svg>`;
    printSvg(blank ? 'Портрет по кубику — контур лица' : 'Мой портрет по кубику', svg);
  };

  const adult = <AdultDialog page={menu} onDismiss={() => setMenu(null)}>
    <div className="drawing-dialog__heading"><h3>Для взрослого</h3><button type="button" onClick={() => setMenu(null)} aria-label="Закрыть настройки">×</button></div>
    <p className="drawing-parent-progress">{style.title}{state.phase === 'done' ? ' · портрет готов' : step ? ` · ${step.name} · шаг ${part + 1} из ${total}` : ''}</p>
    <div className="drawing-dialog__actions portrait-adult-actions">
      <button type="button" onClick={() => print(true)}>Распечатать контур лица</button>
      {state.phase === 'done' && <button type="button" onClick={() => print(false)}>Распечатать портрет</button>}
      {state.phase !== 'shape' && <button type="button" onClick={() => { setRolling(null); update(back); setMenu(null); }}>Вернуться на шаг</button>}
      {state.phase !== 'shape' && <button type="button" onClick={() => { setRolling(null); setState(freshPortrait(state.style)); setMenu(null); }}>Начать новый портрет</button>}
      <button type="button" onClick={finish}>Закончить занятие</button>
    </div>
    <p className="drawing-adult-note">Чтобы открыть это меню, удерживайте шестерёнку. Стиль и кубик ({screenDie ? 'на экране' : 'настоящий'}) меняются в настройках режима.</p>
  </AdultDialog>;
  const shell = (phase, label, children) => <section className="drawing-lesson drawing-shell portrait" data-phase={phase} data-style={state.style} aria-label={label}>{children}{adult}</section>;

  if (state.phase === 'shape') return shell('shape', 'Портрет по кубику: выбери лицо', <>
    <header className="drawing-top portrait-top"><h2>Какое лицо?</h2><AdultButton onOpen={() => setMenu('settings')} /></header>
    <div className="portrait-shapes">{style.faces.map((option, i) => <button type="button" key={option.name} className="portrait-shape" aria-label={option.name} disabled={interactionDisabled}
      onClick={() => update(s => chooseShape(s, i))}>
      <svg viewBox={style.viewBox} fill="none" stroke="currentColor" strokeWidth="5" strokeLinejoin="round" aria-hidden="true"><path d={option.path} /></svg>
    </button>)}</div>
  </>);

  if (state.phase === 'done') return shell('done', 'Портрет готов', <>
    <header className="drawing-top portrait-top"><h2>Портрет готов</h2><AdultButton onOpen={() => setMenu('settings')} /></header>
    <div className="portrait-done" ref={faceRef}><Face viewBox={style.viewBox} face={face} steps={steps} results={state.results} hint={false} className="portrait-face portrait-face--done" /></div>
    <div className="portrait-done-actions">
      <button type="button" className="portrait-round" aria-label="Новый портрет" disabled={interactionDisabled} onClick={() => setState(freshPortrait(state.style))}>
        <svg viewBox="0 0 36 36" aria-hidden="true"><path d="M7 10a11 11 0 1 1-1 14M7 3v8h8" /></svg></button>
      <button type="button" className="portrait-round portrait-round--quiet" aria-label="Закончить" disabled={interactionDisabled} onClick={finish}>
        <svg viewBox="0 0 36 36" aria-hidden="true"><path d="M5 17 18 6l13 11M9 14v15h18V14" /></svg></button>
    </div>
  </>);

  const chosen = rolling ?? state.value;
  return shell('part', `Портрет по кубику: ${step.name}`, <>
    <header className="drawing-top portrait-top">
      <h2>{step.name}</h2>
      <ol className="portrait-steps" aria-label={`Шаг ${part + 1} из ${total}`}>{steps.map((s, i) => <li key={s.name} className={i < part ? 'is-done' : i === part ? 'is-current' : ''} />)}</ol>
      <AdultButton onOpen={() => setMenu('settings')} />
    </header>
    <div className="portrait-work" data-part={part} data-chosen={state.value ?? undefined}>
      <div className="portrait-options" role="group" aria-label={`Варианты: ${step.name.toLowerCase()}`}>
        {step.variants.map((variant, i) => {
          const value = i + 1, selected = chosen === value;
          return <button type="button" key={value} className={`portrait-option${selected ? ' is-selected' : ''}${chosen && !selected ? ' is-dim' : ''}`}
            aria-label={`${value}: ${variant.label}`} aria-pressed={selected}
            disabled={interactionDisabled || screenDie || rolling !== null} onClick={() => { update(s => pick(s, value)); setPlay(n => n + 1); }}>
            <Die value={value} /><VariantIcon step={step} variant={variant} face={face} />
          </button>;
        })}
      </div>
      <div className="portrait-stage">
        <Face viewBox={style.viewBox} face={face} steps={steps} results={state.results} current={state.value} play={play} />
        {state.value !== null && <button type="button" className="portrait-show" aria-label="Показать, как рисовать" disabled={interactionDisabled}
          onClick={() => setPlay(n => n + 1)}><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M11 7.5v17l14-8.5z" /></svg></button>}
        {screenDie && state.value === null && <button type="button" className="portrait-roll" aria-label="Бросить кубик" disabled={interactionDisabled || rolling !== null}
          data-rolling={rolling !== null || undefined} onClick={() => {
            if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) update(s => pick(s, 1 + Math.floor(Math.random() * 6)));
            else setRolling(1 + Math.floor(Math.random() * 6));
          }}><Die value={rolling ?? 5} size="big" /></button>}
      </div>
    </div>
    {state.value !== null && <button type="button" className="portrait-next" aria-label={part + 1 === total ? 'Готово' : 'Дальше'} disabled={interactionDisabled}
      onClick={() => update(next)}><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M11 24h24M25 13l11 11-11 11" /></svg></button>}
    <span className="drawing-sr-only" role="status" aria-live="polite">{state.value === null ? (screenDie ? 'Брось кубик' : 'Брось кубик и выбери') : `${step.variants[state.value - 1].label}. Нарисуй на бумаге`}</span>
  </>);
}
