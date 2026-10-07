import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Renderer from '../../src/topics/renderers/word_formation/index.jsx';
import { generateTasks } from '../../src/topics/renderers/word_formation/engine.js';
import cards from '../../.cache/word-formation-preview-data.json';
import '../../src/styles.css';
import './word-formation-preview.css';
import { TabletPreview, TabletLesson } from './word-formation-tablet';

const CATEGORIES = { soup: 'Суп', juice: 'Сок', jam: 'Варенье', kasha: 'Каша', materials: 'Материалы', weather: 'Погода', seasons: 'Времена года' };
const MODES = { pair_intro: 'Знакомство', pick_form: 'Выбор прилагательного', season_form_pick: 'Согласование' };
function Preview() {
  const [overview, setOverview] = useState(true);
  const [category, setCategory] = useState('soup');
  const [mode, setMode] = useState('pair_intro');
  const [stage, setStage] = useState('model');
  const [checking, setChecking] = useState(false);
  const [count, setCount] = useState(2);
  const [material, setMaterial] = useState('trained');
  const [index, setIndex] = useState(0);
  const [revision, setRevision] = useState(0);
  const [note, setNote] = useState('');
  const tasks = useMemo(() => generateTasks({ type: mode }, cards, 500, {
    category: [category], introStage: stage, activityStage: checking ? 'check' : 'training',
    materialSet: material, optionCount: count, speechEnabled: false,
  }), [category, mode, stage, checking, material, count, revision]);
  const task = tasks[index];
  function reset() { setIndex(0); setRevision(v => v + 1); setNote(''); }
  function chooseCategory(next) { setCategory(next); setMode('pair_intro'); setMaterial('trained'); reset(); setOverview(false); }
  function advance(delta = 1) { setIndex(i => Math.max(0, Math.min(tasks.length - 1, i + delta))); setNote(''); }
  return <div className="wf-preview">
    <header><strong>Словообразование</strong><span>Обзор всей темы · реальные экраны · результаты демо не сохраняются</span></header>
    {overview ? <div className="wf-preview__overview">
      <h1>Одна тема. Три режима.</h1><p>Связываем исходное выражение со словом, выбираем прилагательное и отдельно отрабатываем согласование.</p>
      <div className="wf-preview__modes">{Object.values(MODES).map((label, i) => <div key={label}><b>{i + 1}</b><strong>{label}</strong><span>{['Образец и самостоятельный ответ', 'Выбор слова по значению', 'Форма знакомого слова по роду и числу'][i]}</span></div>)}</div>
      <h2>Материалы темы</h2><div className="wf-preview__categories">{Object.entries(CATEGORIES).map(([id, label]) => {
        const pool = cards.filter(c => c.category === id);
        const first = pool[0];
        const image = first?.ingredientImage ?? first?.backgroundImage ?? first?.image;
        return <button key={id} onClick={() => chooseCategory(id)}>{image && <img src={image} alt="" />}<strong>{label}</strong><span>{pool.reduce((n, c) => n + (c.items?.length ?? 1), 0)} сочетаний</span></button>;
      })}</div>
      <p className="wf-preview__status">«Суп» переработан со смысловой связью продукта и результата. Остальные категории показаны с текущими изображениями. Текстовый перенос — дополнительный материал для взрослого.</p>
    </div> : <>
      <nav aria-label="Режим темы"><button onClick={() => setOverview(true)}>← Вся тема</button>{Object.entries(MODES).map(([id, label]) => <button key={id} aria-pressed={mode === id} disabled={id === 'season_form_pick' && !['soup', 'seasons'].includes(category)} onClick={() => { setMode(id); reset(); }}>{label}</button>)}</nav>
      <div className="wf-preview__settings">
        <label>Категория <select aria-label="Категория" value={category} onChange={e => chooseCategory(e.target.value)}>{Object.entries(CATEGORIES).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
        {mode === 'pair_intro' ? <label>Этап <select aria-label="Этап" value={stage} onChange={e => { setStage(e.target.value); reset(); }}><option value="model">Образец</option><option value="answer">Самостоятельный ответ</option></select></label>
          : <label>Вариантов <select aria-label="Вариантов" value={count} onChange={e => { setCount(Number(e.target.value)); reset(); }}>{[2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}</select></label>}
        {mode === 'season_form_pick' && <label>Этап <select aria-label="Этап согласования" value={checking ? 'check' : 'training'} onChange={e => { setChecking(e.target.value === 'check'); reset(); }}><option value="training">Обучение</option><option value="check">Проверка</option></select></label>}
        <label>Материал <select aria-label="Материал" value={material} onChange={e => { setMaterial(e.target.value); reset(); }}><option value="trained">Знакомые сочетания</option><option value="transfer">Текстовый перенос</option></select></label>
      </div>
      <div className="wf-preview__pager"><button disabled={index === 0} onClick={() => advance(-1)}>← Предыдущее</button><select aria-label="Задание" value={index} onChange={e => { setIndex(Number(e.target.value)); setNote(''); }}>{tasks.map((t, i) => <option key={i} value={i}>{i + 1}. {t.item?.sourcePhrase ?? (t.item ? [t.card?.contextPhrase, t.item.adjPhrase.split(/\s+/).slice(1).join(' ')].filter(Boolean).join('. ') : t.card?.nounPhrase ?? t.cards?.[0]?.nounPhrase)}</option>)}</select><button disabled={index >= tasks.length - 1} onClick={() => advance()}>Следующее →</button></div>
      <main>{task ? <Renderer key={[mode, category, stage, checking, index, revision].join(':')} task={task} topicId="topic-preview"
        onCorrect={() => setNote('Правильно. Прочитайте полное сочетание.')}
        onIncorrect={() => setNote('Посмотрим вместе. Условие задаёт значение или форму слова.')}
        onQualityAnswer={q => setNote(({ independent: 'Самостоятельный ответ', prompted: 'Ответ с помощью', after_model: 'Ответ после образца', none: 'Нет ответа' })[q])}
        onAdvance={() => advance()} /> : <div className="wf-preview__empty">Для этого сочетания настроек нет подготовленных заданий. Выберите знакомый материал или другую категорию.</div>}</main>
      <footer aria-live="polite">{note || [CATEGORIES[category], MODES[mode], (tasks.length ? index + 1 : 0) + ' из ' + tasks.length].join(' · ')}{!['soup', 'seasons'].includes(category) && ' · Согласование подготовлено для еды и сезонов.'}</footer>
    </>}
  </div>;
}
const query = new URLSearchParams(location.search);
createRoot(document.getElementById('root')).render(query.has('app') ? <TabletLesson /> : query.has('tablet') ? <TabletPreview /> : <Preview />);
