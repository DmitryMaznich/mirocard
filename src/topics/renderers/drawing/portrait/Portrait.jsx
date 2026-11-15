// «Портрет по кубику» (drawing_portrait): the child draws a face on paper part by part;
// a die (a real one or one on the screen) picks which of six variants to draw. Not evaluated.
// The adult picks the style (styles.js); the chosen variant is then drawn stroke by stroke as a model.
import { useEffect, useMemo, useRef, useState } from 'react';
import { STYLES, normalizeStyle, styleSteps } from './styles.js';
import { back, chooseShape, next, pick, portraitKey, readPortrait, savePortrait, freshPortrait, stepCount, startColoring } from './state.js';
import { colorSteps, paintLesson, paletteFor } from './paintPlan.js';
import { createDrawingPlayer } from '../player.js';
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
// The «Рисуем по шагам» player shows the colouring: the portrait outline at once, then the new colour
// hatched in like a real pencil (from → to player steps). Without SVG geometry (tests) it stays empty.
function PaintBoard({ lesson, from, to, play, soundEnabled }) {
  const svg = useRef(null);
  useEffect(() => {
    const node = svg.current;
    if (!node || typeof node.getBBox !== 'function') return undefined;
    let player, alive = true;
    try {
      player = createDrawingPlayer(node, lesson, () => {}, `portrait-${play}`, { soundEnabled });
      player.restore(from);
      (async () => { for (let i = from; i < to && alive; i++) await player.next(); })();
    } catch { try { player?.restore(to); } catch { /* geometry unavailable */ } }
    return () => { alive = false; player?.dispose(); };
  }, [lesson, from, to, play, soundEnabled]);
  return <svg ref={svg} className="portrait-face portrait-paint" viewBox={lesson.viewBox} role="img" aria-label="Раскраска портрета" />;
}
function Pencil({ pencil }) {
  return <svg className="portrait-pencil" viewBox="0 0 120 34" aria-hidden="true">
    <path d="M10 5h78l22 10-22 10H10a5 5 0 0 1-5-5V10a5 5 0 0 1 5-5Z" fill={pencil.pencil ?? pencil.color} stroke="#3a3a32" strokeWidth="1.5" />
    <path d="M88 5l22 10-22 10Z" fill="#f1d7ad" stroke="#3a3a32" strokeWidth="1.5" /><path d="M103 12l7 3-7 3Z" fill={pencil.pencil ?? pencil.color} />
    {/* «слегка»: the same pencil, a pale stroke beside it shows the light pressure */}
    {pencil.light && <path d="M14 28 q12 -4 24 0 t24 0" fill="none" stroke={pencil.color} strokeWidth="4" strokeLinecap="round" />}
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

// Adult menu: an ordinary tap, as everywhere else in the app (no long press). Leaving the lesson is the
// shared header's ✕, which asks for confirmation, so the menu holds only printing and step controls.
function MenuButton({ onOpen }) {
  return <button type="button" className="drawing-adult portrait-menu" aria-label="Для взрослого" onClick={onOpen}>
    <svg viewBox="0 0 36 36" fill="none" stroke="currentColor" strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M13 3h6l1 4 4 2 4-1 3 5-3 3v4l3 3-3 5-4-1-4 2-1 4h-6l-1-4-4-2-4 1-3-5 3-3v-4l-3-3 3-5 4 1 4-2Z" /><circle cx="16" cy="18" r="5" /></svg>
  </button>;
}

export default function Portrait({ student, sessionParams, soundEnabled = true, interactionDisabled = false, onClose, onAdvance, AdultDialog }) {
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
  // One lesson object per choice: a new object on every render restarted the player mid-colour (2026-11-15).
  const paintKey = state.phase === 'color' || state.phase === 'colored'
    ? JSON.stringify([state.style, state.shape, state.results, state.phase === 'colored' || state.value === null ? state.colors : [...state.colors, state.value]]) : null;
  const paint = useMemo(() => { if (!paintKey) return null; const [st, sh, res, cols] = JSON.parse(paintKey); return paintLesson(st, sh, res, cols); }, [paintKey]);
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
    <p className="drawing-parent-progress">{style.title}{state.phase === 'done' || state.phase === 'colored' ? ' · портрет готов' : state.phase === 'color' ? ' · раскрашиваем' : step ? ` · ${step.name} · шаг ${part + 1} из ${total}` : ''}</p>
    <div className="drawing-dialog__actions portrait-adult-actions">
      <button type="button" onClick={() => print(true)}>Распечатать контур лица</button>
      {(state.phase === 'done' || state.phase === 'colored') && <button type="button" onClick={() => print(false)}>Распечатать портрет</button>}
      {state.phase !== 'shape' && <button type="button" onClick={() => { setRolling(null); update(back); setMenu(null); }}>Вернуться на шаг</button>}
      {state.phase !== 'shape' && <button type="button" onClick={() => { setRolling(null); setState(freshPortrait(state.style)); setMenu(null); }}>Начать новый портрет</button>}
    </div>
    <p className="drawing-adult-note">Стиль и кубик ({screenDie ? 'на экране' : 'настоящий'}) меняются в настройках режима.</p>
  </AdultDialog>;
  const shell = (phase, label, children) => <section className="drawing-lesson drawing-shell portrait" data-phase={phase} data-style={state.style} aria-label={label}>{children}{adult}</section>;

  if (state.phase === 'shape') return shell('shape', 'Портрет по кубику: выбери лицо', <>
    <header className="drawing-top portrait-top"><h2>Какое лицо?</h2><MenuButton onOpen={() => setMenu('settings')} /></header>
    <div className="portrait-shapes">{style.faces.map((option, i) => <button type="button" key={option.name} className="portrait-shape" aria-label={option.name} disabled={interactionDisabled}
      onClick={() => update(s => chooseShape(s, i))}>
      <svg viewBox={style.viewBox} fill="none" stroke="currentColor" strokeWidth="5" strokeLinejoin="round" aria-hidden="true"><path d={option.path} /></svg>
    </button>)}</div>
  </>);

  if (state.phase === 'done') return shell('done', 'Портрет готов', <>
    <header className="drawing-top portrait-top"><h2>Портрет готов</h2><MenuButton onOpen={() => setMenu('settings')} /></header>
    <div className="portrait-done" ref={faceRef}><Face viewBox={style.viewBox} face={face} steps={steps} results={state.results} hint={false} className="portrait-face portrait-face--done" /></div>
    <div className="portrait-done-actions">
      <button type="button" className="portrait-round portrait-round--paint" aria-label="Раскрасить" disabled={interactionDisabled} onClick={() => update(startColoring)}>
        <svg viewBox="0 0 36 36" aria-hidden="true"><path d="M18 4C9 4 4 10 4 17c0 7 5 12 11 12 3 0 3-3 1-5-2-2 0-5 3-5h5c5 0 8-3 8-7 0-5-6-8-14-8Z" /><circle cx="11" cy="15" r="2" /><circle cx="17" cy="10" r="2" /><circle cx="24" cy="12" r="2" /></svg></button>
      <button type="button" className="portrait-round portrait-round--quiet" aria-label="Новый портрет" disabled={interactionDisabled} onClick={() => setState(freshPortrait(state.style))}>
        <svg viewBox="0 0 36 36" aria-hidden="true"><path d="M7 10a11 11 0 1 1-1 14M7 3v8h8" /></svg></button>
      <button type="button" className="portrait-round portrait-round--quiet" aria-label="Закончить" disabled={interactionDisabled} onClick={finish}>
        <svg viewBox="0 0 36 36" aria-hidden="true"><path d="M5 17 18 6l13 11M9 14v15h18V14" /></svg></button>
    </div>
  </>);

  const chosen = rolling ?? state.value;
  const roller = screenDie && state.value === null && <button type="button" className="portrait-roll" aria-label="Бросить кубик" disabled={interactionDisabled || rolling !== null}
    data-rolling={rolling !== null || undefined} onClick={() => {
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) update(s => pick(s, 1 + Math.floor(Math.random() * 6)));
      else setRolling(1 + Math.floor(Math.random() * 6));
    }}><Die value={rolling ?? 5} size="big" /></button>;
  const nextButton = label => state.value !== null && <button type="button" className="portrait-next" aria-label={label} disabled={interactionDisabled}
    onClick={() => update(next)}><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M11 24h24M25 13l11 11-11 11" /></svg></button>;

  // Colouring on screen, to repeat with real pencils on paper. Every colour is the child's choice by tap.
  if (state.phase === 'color' || state.phase === 'colored') {
    const plan = colorSteps(state.style, state.shape, state.results), k = state.colors.length, cstep = plan[k];
    const { lesson, ends } = paint;
    const from = state.phase === 'colored' ? ends.at(-1) : ends[k], to = ends.at(-1);
    const board = <PaintBoard lesson={lesson} from={from} to={to} play={play} soundEnabled={soundEnabled} />;
    if (state.phase === 'colored') return shell('colored', 'Портрет раскрашен', <>
      <header className="drawing-top portrait-top"><h2>Портрет готов</h2><MenuButton onOpen={() => setMenu('settings')} /></header>
      <div className="portrait-done" ref={faceRef}>{board}</div>
      <div className="portrait-done-actions">
        <button type="button" className="portrait-round" aria-label="Новый портрет" disabled={interactionDisabled} onClick={() => setState(freshPortrait(state.style))}>
          <svg viewBox="0 0 36 36" aria-hidden="true"><path d="M7 10a11 11 0 1 1-1 14M7 3v8h8" /></svg></button>
        <button type="button" className="portrait-round portrait-round--quiet" aria-label="Закончить" disabled={interactionDisabled} onClick={finish}>
          <svg viewBox="0 0 36 36" aria-hidden="true"><path d="M5 17 18 6l13 11M9 14v15h18V14" /></svg></button>
      </div>
    </>);
    const pencils = paletteFor(state.style, cstep.group);
    return shell('color', `Раскрась: ${cstep.name}`, <>
      <header className="drawing-top portrait-top">
        <h2>{cstep.name}</h2>
        <ol className="portrait-steps portrait-steps--paint" aria-label={`Цвет ${k + 1} из ${plan.length}`}>{plan.map((s, i) => <li key={s.group} className={i < k ? 'is-done' : i === k ? 'is-current' : ''} />)}</ol>
        <MenuButton onOpen={() => setMenu('settings')} />
      </header>
      <div className="portrait-work" data-paint={cstep.group} data-chosen={state.value ?? undefined}>
        <div className="portrait-options portrait-options--paint" role="group" aria-label={`Цвет: ${cstep.name.toLowerCase()}`}>
          {pencils.map((pencil, i) => {
            const value = i + 1, selected = chosen === value;
            return <button type="button" key={pencil.id} className={`portrait-option portrait-color${selected ? ' is-selected' : ''}${chosen && !selected ? ' is-dim' : ''}`}
              aria-label={pencil.name} aria-pressed={selected}
              disabled={interactionDisabled} onClick={() => { update(s => pick(s, value)); setPlay(n => n + 1); }}>
              <Pencil pencil={pencil} /><span className="portrait-color__name">{pencil.name}</span>
            </button>;
          })}
        </div>
        <div className="portrait-stage">
          {board}
          {state.value !== null && <button type="button" className="portrait-show" aria-label="Показать ещё раз" disabled={interactionDisabled}
            onClick={() => setPlay(n => n + 1)}><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M11 7.5v17l14-8.5z" /></svg></button>}
        </div>
      </div>
      {nextButton(k + 1 === plan.length ? 'Готово' : 'Дальше')}
      <span className="drawing-sr-only" role="status" aria-live="polite">{state.value === null ? 'Выбери цвет' : `${pencils[state.value - 1].name}. Раскрась на бумаге`}</span>
    </>);
  }

  return shell('part', `Портрет по кубику: ${step.name}`, <>
    <header className="drawing-top portrait-top">
      <h2>{step.name}</h2>
      <ol className="portrait-steps" aria-label={`Шаг ${part + 1} из ${total}`}>{steps.map((s, i) => <li key={s.name} className={i < part ? 'is-done' : i === part ? 'is-current' : ''} />)}</ol>
      <MenuButton onOpen={() => setMenu('settings')} />
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
        {roller}
      </div>
    </div>
    {nextButton(part + 1 === total ? 'Готово' : 'Дальше')}
    <span className="drawing-sr-only" role="status" aria-live="polite">{state.value === null ? (screenDie ? 'Брось кубик' : 'Брось кубик и выбери') : `${step.variants[state.value - 1].label}. Нарисуй на бумаге`}</span>
  </>);
}
