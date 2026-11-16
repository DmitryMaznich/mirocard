// «Портрет по кубику» (drawing_portrait): the child draws a face on paper part by part;
// a die (a real one or one on the screen) picks which of six variants to draw. Not evaluated.
// The adult picks the style (styles.js); the chosen variant is then drawn stroke by stroke as a model.
import { useEffect, useMemo, useRef, useState } from 'react';
import { STYLES, normalizeStyle, styleSteps } from './styles.js';
import { back, chooseShape, next, pick, portraitKey, readPortrait, savePortrait, freshPortrait, stepCount, startColoring } from './state.js';
import { colorSteps, fixedColor, paintLesson, paletteFor, portraitPaint } from './paintPlan.js';
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
function PaintBoard({ lesson, from, to, play, soundEnabled, delay = 0 }) {
  const svg = useRef(null);
  useEffect(() => {
    const node = svg.current;
    if (!node || typeof node.getBBox !== 'function') return undefined;
    let player, alive = true;
    try {
      player = createDrawingPlayer(node, lesson, () => {}, `portrait-${play}`, { soundEnabled });
      player.restore(from);
      (async () => {
        if (delay) await new Promise(resolve => setTimeout(resolve, delay));
        for (let i = from; i < to && alive; i++) await player.next();
      })();
    } catch { try { player?.restore(to); } catch { /* geometry unavailable */ } }
    return () => { alive = false; player?.dispose(); };
  }, [lesson, from, to, play, soundEnabled, delay]);
  return <svg ref={svg} className="portrait-face portrait-paint" viewBox={lesson.viewBox} role="img" aria-label="Раскраска портрета" />;
}
// What this step colours, as a pale pulsing underlay of the pencil's colour (until the pencil starts).
const HINT_MS = 1600;
function AreaHint({ regions, color, viewBox, until }) {
  return <svg className={`portrait-hint${until ? ' portrait-hint--once' : ''}`} viewBox={viewBox} aria-hidden="true">
    <defs>{regions.map((r, i) => r.clip && <clipPath key={i} id={`portrait-hint-${i}`}><path d={r.clip} /></clipPath>)}</defs>
    {regions.map((r, i) => <path key={i} d={r.d} fill={color} fillRule="evenodd" clipPath={r.clip ? `url(#portrait-hint-${i})` : undefined} />)}
  </svg>;
}
function Pencil({ pencil }) {
  return <svg className="portrait-pencil" viewBox="0 0 120 34" aria-hidden="true">
    <path d="M10 5h78l22 10-22 10H10a5 5 0 0 1-5-5V10a5 5 0 0 1 5-5Z" fill={pencil.pencil ?? pencil.color} stroke="#3a3a32" strokeWidth="1.5" />
    <path d="M88 5l22 10-22 10Z" fill="#f1d7ad" stroke="#3a3a32" strokeWidth="1.5" /><path d="M103 12l7 3-7 3Z" fill={pencil.pencil ?? pencil.color} />
    {/* «слегка»: the same pencil, a pale stroke beside it shows the light pressure */}
    {pencil.light && <path d="M14 28 q12 -4 24 0 t24 0" fill="none" stroke={pencil.color} strokeWidth="4" strokeLinecap="round" />}
  </svg>;
}
// The one primary action of every screen: the big green round button, always bottom right
// («Дальше», «Раскрасить», «Новый портрет»). Leaving the lesson is only the header's ✕.
const ICONS = {
  next: <path d="M11 24h24M25 13l11 11-11 11" />,
  paint: <><path d="M24 6C12 6 6 14 6 23c0 9 7 16 15 16 4 0 4-4 1-7-2-3 0-7 4-7h7c7 0 10-4 10-9 0-6-8-10-19-10Z" /><circle cx="15" cy="20" r="2.4" /><circle cx="23" cy="13" r="2.4" /><circle cx="32" cy="16" r="2.4" /></>,
  again: <path d="M12 16a14 14 0 1 1-2 15M11 7v10h10" />,
};
function Primary({ icon, label, disabled, onClick }) {
  return <button type="button" className="portrait-next" data-icon={icon} aria-label={label} disabled={disabled} onClick={onClick}>
    <svg viewBox="0 0 48 48" aria-hidden="true">{ICONS[icon]}</svg></button>;
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

export default function Portrait({ student, sessionParams, soundEnabled = true, interactionDisabled = false, AdultDialog }) {
  const key = portraitKey(student?.id);
  const styleId = normalizeStyle(sessionParams?.style);
  const colorMode = sessionParams?.colorChoice === 'die' ? 'die' : 'instruction', skinTone = sessionParams?.skinTone;
  // A colour step whose pencil is given (instruction, or the adult's skin tone) is chosen on arrival.
  const fixedOf = s => s.phase === 'color' ? fixedColor(s.style, colorSteps(s.style, s.shape, s.results)[s.colors.length]?.group, colorMode, skinTone) : null;
  const auto = s => s.phase === 'color' && s.value === null && fixedOf(s) ? pick(s, fixedOf(s)) : s;
  const backAuto = s => { const r = back(s); return r.phase === 'color' && r.value === null && fixedOf(r) ? back(r) : r; };
  const [state, setState] = useState(() => auto(readPortrait(key, styleId)));
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
      {state.phase !== 'shape' && <button type="button" onClick={() => { setRolling(null); update(backAuto); setMenu(null); }}>Вернуться на шаг</button>}
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
    <Primary icon="paint" label="Раскрасить" disabled={interactionDisabled} onClick={() => { setPlay(0); update(s => auto(startColoring(s))); }} />
  </>);

  const chosen = rolling ?? state.value;
  const roller = screenDie && state.value === null && <button type="button" className="portrait-roll" aria-label="Бросить кубик" disabled={interactionDisabled || rolling !== null}
    data-rolling={rolling !== null || undefined} onClick={() => {
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) update(s => pick(s, 1 + Math.floor(Math.random() * 6)));
      else setRolling(1 + Math.floor(Math.random() * 6));
    }}><Die value={rolling ?? 5} size="big" /></button>;
  const nextButton = label => state.value !== null && <Primary icon="next" label={label} disabled={interactionDisabled} onClick={() => { setPlay(0); update(s => auto(next(s))); }} />;

  // Colouring on screen, to repeat with real pencils on paper. The pencil is given (instruction) or the die's.
  if (state.phase === 'color' || state.phase === 'colored') {
    const plan = colorSteps(state.style, state.shape, state.results), k = state.colors.length, cstep = plan[k];
    const { lesson, ends } = paint;
    const from = state.phase === 'colored' ? ends.at(-1) : ends[k], to = ends.at(-1);
    if (state.phase === 'colored') return shell('colored', 'Портрет раскрашен', <>
      <header className="drawing-top portrait-top"><h2>Портрет готов</h2><MenuButton onOpen={() => setMenu('settings')} /></header>
      <div className="portrait-done" ref={faceRef}><PaintBoard lesson={lesson} from={from} to={to} play={play} soundEnabled={soundEnabled} /></div>
      <Primary icon="again" label="Новый портрет" disabled={interactionDisabled} onClick={() => setState(freshPortrait(state.style))} />
    </>);
    const pencils = paletteFor(state.style, cstep.group), given = fixedOf(state), pencil = state.value ? pencils[state.value - 1] : null;
    // The area is shown first (pale underlay), then the pencil colours it; ▶ replays without the pause.
    const regions = portraitPaint(state.style, state.shape, state.results).paint[cstep.group];
    const hintColor = (given ? pencils[given - 1] : pencil)?.color ?? '#9fc3b2';
    const firstShow = play === 0 && given;
    return shell('color', `Раскрась: ${cstep.name}`, <>
      <header className="drawing-top portrait-top">
        <h2>{cstep.name}</h2>
        <ol className="portrait-steps portrait-steps--paint" aria-label={`Цвет ${k + 1} из ${plan.length}`}>{plan.map((s, i) => <li key={s.group} className={i < k ? 'is-done' : i === k ? 'is-current' : ''} />)}</ol>
        <MenuButton onOpen={() => setMenu('settings')} />
      </header>
      <div className="portrait-work" data-paint={cstep.group} data-color-mode={given ? 'given' : 'die'} data-chosen={state.value ?? undefined}>
        {given ? <div className="portrait-options portrait-options--given">
          <div className="portrait-option portrait-color portrait-color--given is-selected" aria-label={`Возьми: ${pencils[given - 1].name}`} role="img">
            <Pencil pencil={pencils[given - 1]} />
          </div>
        </div> : <div className="portrait-options portrait-options--paint" role="group" aria-label={`Цвет: ${cstep.name.toLowerCase()}`}>
          {pencils.map((p, i) => {
            const value = i + 1, selected = chosen === value;
            return <button type="button" key={p.id} className={`portrait-option portrait-color${selected ? ' is-selected' : ''}${chosen && !selected ? ' is-dim' : ''}`}
              aria-label={`${value}: ${p.name}`} aria-pressed={selected}
              disabled={interactionDisabled || screenDie || rolling !== null} onClick={() => { update(s => pick(s, value)); setPlay(n => n + 1); }}>
              <Die value={value} /><Pencil pencil={p} />
            </button>;
          })}
        </div>}
        <div className="portrait-stage">
          {(state.value === null || firstShow) && <AreaHint key={`${k}:${play}`} regions={regions} color={hintColor} viewBox={lesson.viewBox} until={firstShow} />}
          <PaintBoard lesson={lesson} from={from} to={to} play={play} soundEnabled={soundEnabled} delay={firstShow ? HINT_MS : 0} />
          {state.value !== null && <button type="button" className="portrait-show" aria-label="Показать ещё раз" disabled={interactionDisabled}
            onClick={() => setPlay(n => n + 1)}><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M11 7.5v17l14-8.5z" /></svg></button>}
          {!given && roller}
        </div>
      </div>
      {nextButton(k + 1 === plan.length ? 'Готово' : 'Дальше')}
      <span className="drawing-sr-only" role="status" aria-live="polite">{state.value === null ? 'Брось кубик' : `${pencil.name}. Раскрась на бумаге`}</span>
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
