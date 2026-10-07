import React, { useEffect, useMemo, useRef, useState } from 'react';
import SessionHeader from '../../src/features/session/SessionHeader.jsx';
import Renderer from '../../src/topics/renderers/word_formation/index.jsx';
import { generateTasks } from '../../src/topics/renderers/word_formation/engine.js';
import { alignWordFormationMode } from '../../src/topics/wordFormationMethodology.js';
import cards from '../../.cache/word-formation-preview-data.json';

const TITLES = { pair_intro: 'Знакомство с парами', pick_form: 'Выбор прилагательного', season_form_pick: 'Согласование прилагательных' };
const CATEGORIES = { soup: 'Суп', juice: 'Сок', jam: 'Варенье', kasha: 'Каша', materials: 'Материалы', weather: 'Погода', seasons: 'Времена года' };

export function TabletLesson() {
  const query = new URLSearchParams(location.search);
  const mode = query.get('mode') || 'pair_intro';
  const category = query.get('category') || 'soup';
  const stage = query.get('stage') || 'model';
  const schema = useMemo(() => alignWordFormationMode({ type: mode, params: { category: {
    type: 'enum_multi', label: { ru: 'Категория' }, values: Object.keys(CATEGORIES), labels: { ru: CATEGORIES },
  } } }).params, [mode]);
  const [params, setParams] = useState(() => ({
    ...Object.fromEntries(Object.entries(schema).map(([key, value]) => [key, value.default])),
    category: [category], introStage: stage === 'answer' ? 'answer' : 'model',
    activityStage: stage === 'check' ? 'check' : 'training',
  }));
  const tasks = useMemo(() => generateTasks({ type: mode }, cards, 500, params), [mode, params]);
  const [index, setIndex] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [score, setScore] = useState({ correct: 0, incorrect: 0 });
  const [closed, setClosed] = useState(false);
  const [settings, setSettings] = useState(false);
  const [revision, setRevision] = useState(0);
  const task = tasks[index];
  const evaluation = mode === 'pair_intro' ? 'none' : 'auto';
  function advance(delta = 1) { setIndex(i => Math.max(0, Math.min(tasks.length - 1, i + delta))); setFeedback(''); setRevision(v => v + 1); }
  useEffect(() => {
    const receive = e => {
      if (e.source !== parent || e.data?.type !== 'tablet-next') return;
      setIndex(i => Math.max(0, Math.min(tasks.length - 1, i + e.data.delta)));
      setFeedback(''); setRevision(v => v + 1);
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [tasks.length]);
  if (closed) return <div className="screen-center"><p>Просмотр занятия завершён</p><button className="btn btn--secondary" onClick={() => { setClosed(false); advance(0); }}>Вернуться к занятию</button></div>;
  return <div className="session-screen">
    <div className={'session-header-wrap' + (evaluation === 'none' ? ' session-header-wrap--compact' : '')}>
      <SessionHeader topicTitle="Словообразование" modeTitle={TITLES[mode]} evaluation={evaluation}
        showProgress showStreak={evaluation !== 'none'} streakCount={score.correct} answersPerStar={5}
        taskIndex={index} total={tasks.length} correctCount={score.correct} incorrectCount={score.incorrect}
        onClose={() => setClosed(true)} onOpenModeSettings={() => setSettings(v => !v)} />
    </div>
    <div className="session-renderer-wrap">{task ? <Renderer key={[index, revision].join(':')} task={task} topicId="tablet-preview"
      onAdvance={() => advance()} onPrevious={() => advance(-1)}
      onCorrect={() => { setScore(s => ({ ...s, correct: s.correct + 1 })); setFeedback('Правильно'); }}
      onIncorrect={() => { setScore(s => ({ ...s, incorrect: s.incorrect + 1 })); setFeedback('Посмотрим вместе'); }}

    /> : <div className="screen-center">Для выбранной категории и материала нет подготовленных заданий. Измените настройки режима.</div>}</div>
    {feedback && <button className="wf-tablet-feedback" onClick={() => advance()}>{feedback} · Дальше →</button>}
    {settings && <div className="wf-tablet-settings" role="dialog" aria-modal="true" aria-label="Настройки режима">
      <strong>Настройки режима · {TITLES[mode]}</strong>
      <div className="wf-tablet-settings__fields">{Object.entries(schema).map(([key, field]) => {
        const locked = params.materialSet === 'transfer' && ['introStage', 'activityStage', 'showImage', 'questionHint'].includes(key)
          || key === 'questionHint' && params.activityStage === 'check';
        const change = value => { setParams(p => ({ ...p, [key]: value })); setIndex(0); setRevision(v => v + 1); setFeedback(''); setScore({ correct: 0, incorrect: 0 }); };
        return <label key={key}><span>{field.label.ru}</span>
          {field.type === 'boolean' ? <input type="checkbox" aria-label={field.label.ru} checked={!locked && params[key] !== false} disabled={locked} onChange={e => change(e.target.checked)} />
            : <select aria-label={key === 'introStage' ? 'Предъявление в настройках' : field.label.ru} disabled={locked}
                value={locked ? key === 'introStage' ? 'answer' : 'check' : Array.isArray(params[key]) ? params[key][0] : params[key]}
                onChange={e => change(field.type === 'enum_multi' ? [e.target.value] : key === 'optionCount' ? Number(e.target.value) : e.target.value)}>
                {field.values.map(value => <option key={value} value={value}>{field.labels?.ru?.[value] ?? value}</option>)}
              </select>}
          {field.hint?.ru && <small>{field.hint.ru}</small>}
        </label>;
      })}</div>
      <button className="btn btn--secondary" onClick={() => setSettings(false)}>Вернуться к занятию</button>
    </div>}

  </div>;
}

export function TabletPreview() {
  const [landscape, setLandscape] = useState(false);
  const [category, setCategory] = useState('soup');
  const [mode, setMode] = useState('pair_intro');
  const [stage, setStage] = useState('model');
  const [small, setSmall] = useState(false);
  const [scale, setScale] = useState(.7);
  const host = useRef(null);
  const frame = useRef(null);
  const width = landscape ? (small ? 960 : 1024) : (small ? 600 : 768);
  const height = landscape ? (small ? 600 : 768) : (small ? 960 : 1024);
  useEffect(() => {
    const observer = new ResizeObserver(entries => {
      const r = entries[0].contentRect;
      setScale(Math.min(1, (r.width - 28) / width, (r.height - 28) / height));
    });
    observer.observe(host.current);
    return () => observer.disconnect();
  }, [width, height]);
  const src = '?app=1&category=' + category + '&mode=' + mode + '&stage=' + stage;
  return <div className="wf-tablet-preview">
    <header><strong>Словообразование · планшет</strong><span>Реальная шапка и компоненты занятия. Предпросмотр без сохранения результатов.</span></header>
    <div className="wf-tablet-controls">
      <label>Категория <select aria-label="Категория планшета" value={category} onChange={e => { setCategory(e.target.value); setMode('pair_intro'); }}>{Object.entries(CATEGORIES).map(([id, title]) => <option key={id} value={id}>{title}</option>)}</select></label>
      <label>Режим <select aria-label="Режим планшета" value={mode} onChange={e => { setMode(e.target.value); setStage('model'); }}>{Object.entries(TITLES).map(([id, title]) => <option key={id} value={id} disabled={id === 'season_form_pick' && !['soup', 'seasons'].includes(category)}>{title}</option>)}</select></label>
      {mode === 'pair_intro' && <select aria-label="Этап планшета" value={stage} onChange={e => setStage(e.target.value)}><option value="model">Образец</option><option value="answer">Самостоятельный ответ</option></select>}
      {mode === 'season_form_pick' && <select aria-label="Этап планшета" value={stage} onChange={e => setStage(e.target.value)}><option value="model">Обучение</option><option value="check">Проверка</option></select>}
      <button onClick={() => setLandscape(v => !v)}>Повернуть планшет</button>
      <label><input type="checkbox" checked={small} onChange={e => setSmall(e.target.checked)} />Маленький планшет</label>
      <button onClick={() => frame.current.contentWindow.postMessage({ type: 'tablet-next', delta: -1 }, location.protocol === 'file:' ? '*' : location.origin)}>←</button>
      <button onClick={() => frame.current.contentWindow.postMessage({ type: 'tablet-next', delta: 1 }, location.protocol === 'file:' ? '*' : location.origin)}>Следующее →</button>
    </div>
    <div className="wf-tablet-host" ref={host}><div className="wf-tablet-outline" style={{ width: width * scale, height: height * scale }}>
      <iframe ref={frame} title="Занятие на планшете" src={src} width={width} height={height} style={{ transform: 'scale(' + scale + ')' }} />
    </div></div>
    <footer>{width} × {height} · {landscape ? 'горизонтально' : 'вертикально'} · масштаб показа {Math.round(scale * 100)}%. Внутри рамки — только интерфейс занятия.</footer>
  </div>;
}
