import { useEffect, useState } from 'react';
import { useSpeech } from '@/shared/hooks/useSpeech';
import { getApiToken } from '@/core/api';
import { getDb, kv } from '@/core/db';
import { useAppStore } from '@/core/store';
import './peopleLearning.css';

export function LearningPhoto({ src, className = '', onReady }) {
  const owner = useAppStore(s => s.account?.id);
  const studentId = useAppStore(s => s.activeStudentId);
  const [state, setState] = useState({ src: null, failed: false });
  const [retry, setRetry] = useState(0);
  const photoState = state.source === src && state.owner === owner && state.studentId === studentId ? state : { src: null, failed: false };
  useEffect(() => {
    let disposed = false, blobUrl;
    (async () => {
      await Promise.resolve();
      if (disposed) return;
      setState({ src: null, failed: false, source: src, owner, studentId });
      let resolved = src;
      if (src?.startsWith('/api/photos/')) {
        const db = await getDb(), key = `peoplePhoto:${owner}:${studentId}:${src}`;
        let blob = await kv.get(db, key);
        if (!blob) {
          const response = await fetch(src, { headers: { Authorization: `Bearer ${getApiToken()}` } });
          if (!response.ok) throw new Error('photo');
          blob = await response.blob();
          if (disposed) return;
          await kv.set(db, key, blob);
        }
        if (disposed) return;
        blobUrl = URL.createObjectURL(blob); resolved = blobUrl;
      }
      if (!disposed) setState({ src: resolved, failed: !resolved, source: src, owner, studentId });
    })().catch(() => { if (!disposed) { setState({ src: null, failed: true, source: src, owner, studentId }); onReady?.(false); } });
    return () => { disposed = true; if (blobUrl) URL.revokeObjectURL(blobUrl); };
  }, [src, owner, studentId, retry]); // eslint-disable-line react-hooks/exhaustive-deps
  return <span className={`pl-photo ${className}`}>
    {photoState.src && !photoState.failed ? <img src={photoState.src} alt="" draggable={false} onLoad={() => onReady?.(true)} onError={() => { setState(s => ({ ...s, failed: true })); onReady?.(false); }} />
      : <span>{photoState.failed ? 'Фото недоступно' : 'Загружаем фото…'}</span>}
    {photoState.failed && <button type="button" onClick={e => { e.stopPropagation(); setRetry(n => n + 1); }}>Загрузить снова</button>}
  </span>;
}
export default function PeopleLearningTask({ task, peopleProgress, sessionStatus, onPeopleEvent, sessionParams, soundEnabled }) {
  const { speak, cancel } = useSpeech();
  const voice = soundEnabled && sessionParams.voice !== false;
  const progress = peopleProgress ?? { assistanceUsed: [], firstChoiceCorrect: null };
  const assists = progress.assistanceUsed ?? [];
  const modelShown = task.initialHint === 'model' || assists.includes('model') || assists.includes('correction');
  const prefixShown = !modelShown && (task.initialHint === 'prefix' || assists.includes('prefix'));
  const helped = modelShown || prefixShown || assists.length > 0;
  const done = sessionStatus !== 'task_active';
  const [readyPhotos, setReadyPhotos] = useState({});
  const photos = task.kind === 'intro' || task.activity === 'recall' ? [{ personId: task.targetPersonId, image: task.image }] : task.choices;
  const ready = photos.every(c => readyPhotos[c.personId]);
  const emit = event => onPeopleEvent?.({ ...event, trialId: task.trialId });
  const say = text => { if (voice) speak(text); };
  useEffect(() => {
    if (ready && voice) speak(task.kind === 'intro' ? task.prompt : task.initialHint === 'model' ? `${task.prompt} ${task.model}` : task.initialHint === 'prefix' ? `${task.prompt} ${task.prefix}` : task.prompt);
    return cancel;
  }, [task.trialId, ready, voice, speak, cancel]); // eslint-disable-line react-hooks/exhaustive-deps
  function hint() {
    const level = !helped && task.prefix ? 'prefix' : 'model';
    emit({ type: 'hint', level }); say(level === 'prefix' ? task.prefix : task.model);
  }
  function choose(personId) {
    emit({ type: 'choice', personId });
    if (personId !== task.targetPersonId) say(task.model);
  }
  const selfPractice = task.activity === 'recall' && task.context === 'self';
  return <div className="pl-task" data-trial-id={task.trialId}>
    <div className="pl-task__stage">
      <div className="pl-task__question"><h2>{task.prompt}</h2>{voice && <button type="button" className="pl-speaker" aria-label="Повторить вопрос" onClick={() => say(task.prompt)}>◖))</button>}</div>
      <div className={`pl-field pl-field--${photos.length}`}>
        {photos.map(c => <div key={c.personId} className={`pl-choice${helped && task.activity === 'select' && task.kind !== 'intro' ? c.personId === task.targetPersonId ? ' pl-choice--hint' : ' pl-choice--dim' : ''}`}>
          <LearningPhoto src={c.image} onReady={value => setReadyPhotos(s => s[c.personId] === value ? s : { ...s, [c.personId]: value })} />
          {task.kind === 'intro' && <button type="button" className="pl-choice__hit" aria-label="Повторить образец" disabled={!ready || done || !voice} onClick={() => say(task.prompt)} />}
          {task.kind !== 'intro' && task.activity === 'select' && <button type="button" className="pl-choice__hit" aria-label={`Выбрать фотографию ${photos.indexOf(c) + 1}`} disabled={!ready || done || helped && c.personId !== task.targetPersonId} onClick={() => choose(c.personId)} />}
        </div>)}
      </div>
      {task.activity === 'recall' && <div className="pl-task__cue" aria-live="polite">{modelShown ? task.model : prefixShown ? `${task.prefix}…` : ''}</div>}
    </div>
    {task.kind === 'intro' ? <div className="pl-controls pl-controls--simple"><button type="button" disabled={!ready || done} onClick={() => emit({ type: 'complete', outcome: 'presented' })}>Дальше</button></div>
      : task.activity === 'select' ? <div className="pl-controls pl-controls--simple"><button type="button" disabled={!ready || done} onClick={() => { emit({ type: 'hint', level: 'model' }); say(task.model); }}>Помоги</button></div>
      : selfPractice ? <div className="pl-controls pl-controls--simple">
          <button type="button" disabled={!ready || done} onClick={() => { emit({ type: 'hint', level: 'model' }); say(task.model); }}>Послушать ответ</button>
          <button type="button" disabled={!ready || done || !modelShown} onClick={() => emit({ type: 'complete', outcome: 'practice' })}>Дальше</button>
          <button type="button" disabled={done} onClick={() => emit({ type: 'complete', outcome: 'skipped' })}>Пропустить</button>
        </div>
      : <div className="pl-controls" aria-label="Отметить ответ">
          <button type="button" disabled={!ready || done} onClick={hint}>Подсказка</button>
          <button type="button" disabled={!ready || done || helped} onClick={() => emit({ type: 'complete', outcome: 'independent' })}>Полностью сам</button>
          <button type="button" disabled={!ready || done} onClick={() => emit({ type: 'complete', outcome: 'prompted' })}>С подсказкой</button>
          <button type="button" disabled={!ready || done} onClick={() => emit({ type: 'complete', outcome: 'not_recalled' })}>Не вспомнил</button>
        </div>}
  </div>;
}
