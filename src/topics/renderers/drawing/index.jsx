import Coloring from './coloring/Coloring.jsx';
import { useEffect, useId, useRef, useState } from 'react';
import { createDrawingPlayer } from './player.js';
import { toolForStep } from './lessonPlan.js';
import './drawing.css';
import FirstLines from './firstLines/FirstLines.jsx';
import { drawingLabelAttributes } from './labels.js';
import Portrait from './portrait/Portrait.jsx';
import { MenuButton, Primary, ShowAgain } from './ui.jsx';

const initialState = { index: 0, busy: false, paused: false };
const TOOL_PAUSE_MS = 1100;
const icons = {
  next: <path d="M7 16h18M19 7l9 9-9 9" />,
  repeat: <path d="M7 10a11 11 0 1 1-1 14M7 3v8h8" />,
  gear: <><path d="M13 3h6l1 4 4 2 4-1 3 5-3 3v4l3 3-3 5-4-1-4 2-1 4h-6l-1-4-4-2-4 1-3-5 3-3v-4l-3-3 3-5 4 1 4-2Z" /><circle cx="16" cy="18" r="5" /></>,
  pause: <path d="M11 7v18M22 7v18" />,
  home: <><path d="M4 6h11v23H4ZM20 6h11v23H20Z" /><path d="M7 22l3-4 3 4M23 22l3-4 3 4" /></>,
};
function Icon({ name }) {
  return <svg viewBox="0 0 36 36" fill="none" stroke="currentColor" strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icons[name]}</svg>;
}
function Pencil({ tool }) {
  return <svg viewBox="0 0 268 80" aria-hidden="true"><ellipse cx="132" cy="68" rx="100" ry="4" fill="#26352d" opacity=".08" /><g transform="rotate(-5 134 38)">
    <path d="M190 18 248 37 190 56Z" fill="#e9bf87" /><path d="M190 18 248 37 194 35Z" fill="#f8dbad" /><path d="M190 56 248 37 194 40Z" fill="#d9a56c" />
    <path d="M30 18H190Q197 28 190 37Q197 47 190 56H30Q20 56 20 46V28Q20 18 30 18Z" fill={tool.color} />
    <path d="M30 18H190Q193 23 193 28H24V25Q24 18 30 18Z" fill="white" opacity=".28" /><path d="M24 46H193Q194 51 190 56H30Q24 56 24 50Z" fill="black" opacity=".13" />
    <path d="M232 31.8 248 37 232 42.2Z" fill={tool.color} /><path d="M36 24H165" stroke="white" strokeWidth="3" strokeLinecap="round" opacity=".32" />
  </g></svg>;
}
function AdultDialog({ page, onDismiss, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    if (page && !dialog.open) dialog.showModal();
    if (!page && dialog.open) dialog.close();
  }, [page]);
  return <dialog ref={ref} className="drawing-dialog" aria-label={page === 'reset' ? 'Начать сначала?' : 'Для взрослого'} onCancel={event => { event.preventDefault(); onDismiss(); }}>
    {page && children}
  </dialog>;
}
function Cover({ card, loadTopicFileUrl, topicId }) {
  const [url, setUrl] = useState(card.coverUrl);
  useEffect(() => {
    let active = true, ownedUrl;
    if (!card.coverUrl && loadTopicFileUrl) Promise.resolve(loadTopicFileUrl(topicId, card.image)).then(value => {
      if (value?.startsWith('blob:')) ownedUrl = value;
      if (active) setUrl(value);
      else if (ownedUrl) URL.revokeObjectURL(ownedUrl);
    }).catch(() => {});
    return () => { active = false; if (ownedUrl) URL.revokeObjectURL(ownedUrl); };
  }, [card.coverUrl, card.image, loadTopicFileUrl, topicId]);
  return url ? <img src={url} alt="" /> : <svg viewBox={card.lesson.viewBox} aria-hidden="true"><g fill="none" stroke="#26352d" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
    {card.lesson.steps.flatMap((step, i) => step.kind === 'stroke' ? step.paths.map((item, n) => <path key={`${i}-${n}`} d={typeof item === 'string' ? item : item.d} fill={item.fill ?? 'none'} />) : [])}
  </g>{card.lesson.labels?.map(label => <text key={label.id} {...drawingLabelAttributes(label)}>{label.text}</text>)}</svg>;
}
function readStored(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
function store(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Local-mode previews can have no storage. */ } }

export default function DrawingRenderer(props) {
  if (props.task?.type === 'drawing_portrait') return <Portrait {...props} AdultDialog={AdultDialog} />;
  return props.task?.type === 'drawing_coloring' ? <Coloring {...props} /> : props.task?.type === 'drawing_first_line' ? <FirstLines {...props} /> : <PaperDrawing {...props} />;
}

function PaperDrawing({ task, topicRecord, topicId = 'drawing', student, sessionParams, soundEnabled = true, loadTopicFileUrl, onRequestVideoBonus }) {
  const cards = topicRecord?.cards?.filter(card => card.lesson?.steps?.length) ?? [];
  const fallback = { id: task?.cardId ?? task?.lesson?.id, label: task?.lesson?.title, lesson: task?.lesson };
  const [selected, setSelected] = useState(() => cards.length > 1 ? null : cards[0] ?? fallback);
  const [menu, setMenu] = useState(null);
  const [choices, setChoices] = useState(() => ({ labels: true, tap: false, speed: sessionParams?.speed ?? 'normal', pencilSound: sessionParams?.pencilSound !== 'off', ...readStored('drawing-ui-options', {}) }));
  const [bonusEnabled, setBonusEnabled] = useState(sessionParams?.videoRewardEnabled === true);
  const bonusAvailable = typeof onRequestVideoBonus === 'function' && Boolean(student?.rewardVideos?.length);
  const bonus = { enabled: bonusEnabled, available: bonusAvailable, setEnabled: setBonusEnabled, request: onRequestVideoBonus };
  const progressKey = id => `drawing-progress:${student?.id ?? 'local'}:${id}`;
  const revisionFor = id => (cards.find(card => card.id === id) ?? fallback).lesson?.progressRevision;
  const saveProgress = (id, snapshot) => store(progressKey(id), { ...snapshot, revision: revisionFor(id) ?? 0 });
  const changeChoice = (key, value) => setChoices(previous => { const next = { ...previous, [key]: value }; store('drawing-ui-options', next); return next; });
  // A drawing is drawn in one sitting (owner, 2026-11-16): opening it always starts from the first step.
  // The position is still written (the browser checks read it), but never restored.
  if (selected?.lesson?.steps?.length) return <Lesson key={selected.id} card={selected} saved={null} choices={choices} onChoice={changeChoice}
    soundEnabled={soundEnabled} bonus={bonus} onSave={snapshot => saveProgress(selected.id, snapshot)} onDrawings={() => setSelected(null)} />;
  return <section className="drawing-lesson drawing-picker" aria-label="Рисование">
    <div className="drawing-picker__adult"><MenuButton onOpen={() => setMenu('settings')} /></div>
    <h2>Рисование</h2><p>Выбери рисунок</p>
    <div className="drawing-cards">{cards.map(card => <button type="button" className="drawing-card" key={card.id} onClick={() => setSelected(card)}>
      <Cover card={card} loadTopicFileUrl={loadTopicFileUrl} topicId={topicId} /><span>{card.label ?? card.lesson.title}</span>

    </button>)}</div>
    <AdultDialog page={menu} onDismiss={() => setMenu(null)}><div className="drawing-dialog__heading"><h3>Для взрослого</h3><button type="button" onClick={() => setMenu(null)} aria-label="Закрыть настройки">×</button></div>
      <Settings choices={choices} onChoice={changeChoice} bonus={bonus} />
    </AdultDialog>
  </section>;
}
function Settings({ choices, onChoice, bonus }) {
  return <>
    <label className="drawing-setting"><span>Переход тапом по рисунку</span><input type="checkbox" checked={choices.tap} onChange={event => onChoice('tap', event.target.checked)} /></label>
    <label className="drawing-setting"><span>Шуршание карандаша</span><input type="checkbox" checked={choices.pencilSound} onChange={event => onChoice('pencilSound', event.target.checked)} /></label>
    <label className="drawing-setting"><span>Видеобонус в конце</span><input type="checkbox" checked={bonus.enabled} disabled={!bonus.available} onChange={event => bonus.setEnabled(event.target.checked)} /></label>
    {!bonus.available && <p className="drawing-adult-note">Добавьте видео в карточке ребёнка, чтобы включить бонус.</p>}
    <label className="drawing-setting"><span>Темп анимации</span><select value={choices.speed} onChange={event => onChoice('speed', event.target.value)}><option value="slow">Медленно</option><option value="normal">Обычно</option><option value="fast">Быстро</option></select></label>
  </>;
}
function Lesson({ card, saved, choices, onChoice, soundEnabled, onSave, onDrawings, bonus }) {
  const lesson = card.lesson;
  const svg = useRef(null), player = useRef(null), last = useRef(initialState), save = useRef(onSave);
  useEffect(() => { save.current = onSave; }, [onSave]);
  const savedIndex = Number.isFinite(saved?.index) ? Math.min(lesson.steps.length, Math.max(0, Math.floor(saved.index))) : 0;
  const [bonusGiven, setBonusGiven] = useState(saved?.bonusGiven === true);
  const [bonusPending, setBonusPending] = useState(false);
  const [state, setState] = useState(initialState);
  const [phase, setPhase] = useState(savedIndex ? saved?.phase === 'done' && savedIndex === lesson.steps.length ? 'done' : 'copy' : 'ready');
  const phaseRef = useRef(phase);
  const [menu, setMenu] = useState(null);
  const prefix = useId().replace(/[^a-zA-Z0-9]/g, '');
  const changePhase = next => { phaseRef.current = next; setPhase(next); };
  useEffect(() => {
    const instance = createDrawingPlayer(svg.current, lesson, next => {
      const wasBusy = last.current.busy; last.current = next; setState(next);
      if (wasBusy && !next.busy && next.index > 0) {
        phaseRef.current = 'copy'; setPhase('copy'); save.current({ index: next.index, phase: 'copy' });
      }
    }, prefix);
    player.current = instance;
    if (savedIndex) instance.restore(savedIndex);
    return () => { instance.dispose(); player.current = null; };
    // The component is keyed by card id. Restore only on mount, after SVG is attached.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson, prefix]);
  useEffect(() => { player.current?.setSpeed(choices.speed); }, [choices.speed]);
  useEffect(() => { player.current?.setSoundEnabled(soundEnabled && choices.pencilSound); }, [soundEnabled, choices.pencilSound]);
  const context = toolForStep(lesson, phase === 'copy' || phase === 'done' ? Math.max(0, state.index-1) : Math.min(state.index, lesson.steps.length-1));
  const openSettings = () => {
    player.current.stopFinale();
    if (last.current.busy && !last.current.paused) player.current.togglePause();
    setMenu('settings');
  };
  const next = () => {
    const current = last.current;
    if (current.busy) { if (current.paused) player.current.togglePause(); return; }
    if (phaseRef.current === 'done') return;
    if (phaseRef.current === 'copy') {
      if (current.index === lesson.steps.length) {
        changePhase('done'); save.current({ index: current.index, phase: 'done' }); player.current.playFinale(); return;
      }
      // A new pencil: it wiggles in the header for a moment, then the step starts by itself (no extra tap;
      // a second tap starts it at once). Owner, 2026-11-16.
      if (toolForStep(lesson, current.index-1).tool.id !== toolForStep(lesson, current.index).tool.id) {
        changePhase('tool');
        setTimeout(() => { if (phaseRef.current === 'tool' && !last.current.busy) { changePhase('animating'); player.current?.next(); } }, TOOL_PAUSE_MS);
        return;
      }
    }
    changePhase('animating'); player.current.next();
  };
  const repeat = () => { if (last.current.busy || !last.current.index) return; changePhase('animating'); player.current.repeat(); };
  const previous = () => {
    setBonusGiven(false); player.current.back(); const index = last.current.index; changePhase(index ? 'copy' : 'ready');
    save.current({ index, phase: index ? 'copy' : 'ready' }); setMenu(null);
  };
  const reset = () => { setBonusGiven(false); player.current.reset(); changePhase('ready'); save.current({ index: 0, phase: 'ready' }); setMenu(null); };
  const done = phase === 'done';
  const offerBonus = done && bonus.enabled && bonus.available && !bonusGiven;
  const finishDrawing = () => {
    if (!offerBonus) { onDrawings(); return; }
    if (bonusPending) return;
    player.current.stopFinale(); setBonusPending(true);
    const accepted = bonus.request({ title: 'Рисунок готов — молодец!',
      onCancel: () => setBonusPending(false),
      onComplete: () => {
        setBonusPending(false); setBonusGiven(true);
        save.current({ index: lesson.steps.length, phase: 'done', bonusGiven: true }); onDrawings();
      },
    });
    if (!accepted) setBonusPending(false);
  };
  return <section className="drawing-lesson drawing-shell" aria-label={`Рисуем: ${lesson.title}`}>
    <header className="drawing-top"><h2>{done ? 'Рисунок готов' : lesson.title}</h2>
      {/* The pencil to take: small, in the header, so the picture gets the whole lesson area. It wiggles when it changes. */}
      <div className={`drawing-pencil-chip${phase === 'tool' ? ' is-new' : ''}`} role="img" aria-label={done ? 'Рисунок готов' : context.tool.name}>{!done && <Pencil tool={context.tool} />}</div>
      <MenuButton onOpen={openSettings} /></header>
    <div className="drawing-board" role={choices.tap && !done ? 'button' : undefined} tabIndex={choices.tap && !done ? 0 : undefined}
      aria-label={choices.tap && !done ? 'Показать следующий шаг' : undefined} onClick={() => { if (choices.tap) next(); }}
      onKeyDown={event => { if (choices.tap && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); next(); } }}>
      <svg ref={svg} viewBox={lesson.viewBox} role="img" aria-label={lesson.title} />
      {state.paused && <div className="drawing-pause-curtain"><Icon name="pause" /></div>}
      {!done && state.index > 0 && !state.busy && <ShowAgain label="Показать этот шаг ещё раз" onClick={event => { event.stopPropagation(); repeat(); }} />}
    </div>
    {/* Back is the child's (owner, 2026-11-16): it only rewinds the model on screen — the paper stays — so
        a child who got lost can look again by themselves. One tap, one step; restart stays with the adult. */}
    {state.index > 0 && !state.busy && <button type="button" className="drawing-back" aria-label="Назад на шаг" onClick={previous}>
      <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M37 24H13M23 13 12 24l11 11" /></svg></button>}
    {done ? <Primary icon={offerBonus ? 'next' : 'drawings'} label={offerBonus ? 'Дальше — бонус' : 'Другой рисунок'} disabled={bonusPending} onClick={finishDrawing} />
      : <Primary icon="next" label="Дальше" disabled={state.busy && !state.paused} onClick={next} />}
    <span className="drawing-sr-only" role="status" aria-live="polite">{state.paused ? 'Анимация на паузе' : done ? 'Рисунок готов' : phase === 'copy' ? 'Можно рисовать на бумаге' : phase === 'tool' ? 'Подготовьте следующий карандаш' : 'Показать следующий шаг'}</span>
    <AdultDialog page={menu} onDismiss={() => setMenu(null)}>
      {menu === 'reset' ? <><h3>Начать сначала?</h3><p>Сделанные шаги этого рисунка сбросятся.</p><div className="drawing-dialog__actions"><button type="button" onClick={() => setMenu('settings')}>Оставить рисунок</button><button type="button" className="drawing-danger" onClick={reset}>Начать сначала</button></div></> : <>
        <div className="drawing-dialog__heading"><h3>Для взрослого</h3><button type="button" onClick={() => setMenu(null)} aria-label="Закрыть настройки">×</button></div>
        <p className="drawing-parent-progress">{lesson.title} · показано {state.index} из {lesson.steps.length} шагов</p>
        <Settings choices={choices} onChoice={onChoice} bonus={bonus} />
        <div className="drawing-dialog__actions"><button type="button" disabled={state.busy || !state.index} onClick={previous}>Вернуться на один шаг</button><button type="button" onClick={onDrawings}>Другой рисунок</button><button type="button" className="drawing-danger" onClick={() => setMenu('reset')}>Начать рисунок сначала…</button></div>
        <p className="drawing-adult-note">Во время настройки анимация стоит на паузе. Продолжение — по зелёной кнопке. Выйти из занятия — ✕ вверху.</p>
      </>}
    </AdultDialog>
  </section>;
}
