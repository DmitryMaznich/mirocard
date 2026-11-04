import { personRelations } from '../../../shared/my-people-v2.mjs';
import RewardVideoModal from '@/shared/components/RewardVideoModal';
import { endVideoAvailable } from '@/features/session/endVideo';
import { useState } from 'react';
import { useAppStore } from '@/core/store';
import { learningSummary, nextLearningPlan, scopeKey, planDescription } from './peopleLearning';
import { saveLearningDocument } from './peopleLearningStore';
import { PeopleAdultGate } from './PeopleLearningHome';
import { LearningPhoto } from './PeopleLearningTask';
import { flushQueue } from '@/core/syncApi';
import './peopleLearning.css';
const LABEL = { independent: 'Полностью сам', prompted: 'С подсказкой', not_recalled: 'Не вспомнил', practice: 'Практика', skipped: 'Пропущено', presented: 'Знакомство' };
export default function PeopleLearningSummary({ session }) {
  const store = useAppStore(), student = store.students.find(s => s.id === session.studentId);
  const [adult, setAdult] = useState(false), [gate, setGate] = useState(false), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false);
  const [endVideo, setEndVideo] = useState('offered');
  const trials = session.statistics.myPeople.trials ?? [], summary = learningSummary(trials), plan = session.paramsSnapshot;
  const people = student?.myPeople ?? [];
  const rowsToShow = plan.targetPersonIds.flatMap(id => plan.goal === 'relation' && plan.activity === 'select'
    ? personRelations(people.find(p => p.id === id)).map(role => ({ id, roleKey: role.key, roleLabel: role.label }))
    : [{ id, roleKey: null, roleLabel: null }]);
  const who = id => people.find(p => p.id === id)?.name ?? 'Карточка недоступна';
  async function prepareNext() {
    setBusy(true);
    try {
      const next = nextLearningPlan(plan, trials);
      delete next.exposures; delete next.photoReferences;
      await saveLearningDocument(store.account?.id, student.id, 'draft', scopeKey(next), next);
      flushQueue().catch(() => {});
      store.setMyPeoplePreparationScope({ studentId: student.id, goal: next.goal, activity: next.activity, context: next.context });
      store.setMyPeopleLaunchPlan(null); store.setScreen('modes');
    } catch (e) { setNotice(e.message); } finally { setBusy(false); }
  }
  return <div className="screen"><main className="pl-page">
    {!adult ? <section className="pl-hero"><h1>Готово!</h1><div className="pl-preview">{[...new Set(trials.filter(t => t.kind === 'main').map(t => t.targetPersonId))].map(id => {
      const person = people.find(p => p.id === id); return person?.photos?.[0] ? <LearningPhoto src={person.photos[0]} key={id} /> : null;
    })}</div><p>Занятие завершено</p>
      {endVideoAvailable(session, student) && endVideo !== 'watched' && <button type="button" className="pl-primary" onClick={() => setEndVideo('open')}>Смотреть видео</button>}
      <button type="button" className="pl-primary pl-primary--start" onClick={() => { store.setMyPeopleLaunchPlan(null); store.setScreen('modes'); }}>Домой</button>
      <button type="button" className="pl-link" onClick={() => setGate(true)}>Результат для взрослого</button>
    </section> : <>
      <h1>Результат занятия</h1><p className="pl-conditions">{planDescription(plan)} · {plan.context === 'self' ? 'самостоятельно' : 'со взрослым'}</p>
      <div className="pl-card"><h2>{plan.goal === 'name' ? 'Имена' : 'Кто он мне'} · {plan.activity === 'select' ? 'Выбор фото' : 'Называние'}</h2>
        {summary.checked ? <p>Полностью сам: {summary.independent} · с подсказкой: {summary.prompted} · не вспомнил: {summary.notRecalled}</p> : <p>Практика без оценки правильности ответа.</p>}
        {summary.practice > 0 && <p>Практика: {summary.practice}</p>}
        {summary.skipped > 0 && <p>Пропущено: {summary.skipped}</p>}
        {summary.presented > 0 && <p>Предъявлено образцов: {summary.presented}. Это не отметка об освоении.</p>}
        {plan.goal === 'relation' && plan.activity === 'recall' && <p className="pl-conditions">Отмечено называние одной допустимой связи. Какие именно слова произнесены, приложение не определяет.</p>}
        <table className="pl-results"><thead><tr><th>Кого учим</th><th>Основные вопросы</th><th>Помощь</th></tr></thead><tbody>{rowsToShow.map(({ id, roleKey, roleLabel }) => {
          const rows = summary.main.filter(t => t.targetPersonId === id && (!roleKey || t.targetRelationKey === roleKey));
          return <tr key={`${id}:${roleKey}`}><td>{who(id)}{roleLabel && <small style={{ display: 'block' }}>{roleLabel}</small>}</td><td>{rows.length ? rows.map(r => LABEL[r.outcome]).join(' · ') : 'Не проверяли'}</td><td>{[...new Set(rows.flatMap(t => t.assistanceUsed))].map(x => ({ prefix: 'Начало слова', model: 'Образец', correction: 'Исправление', adult: 'Помощь взрослого' })[x] ?? x).join(', ') || '—'}</td></tr>;
        })}</tbody></table>
        {summary.retries.length > 0 && <details><summary>Возвраты после помощи: {summary.retries.length}</summary>{summary.retries.map(t => <p key={t.trialId}>{who(t.targetPersonId)} · {LABEL[t.outcome]}</p>)}</details>}
        {trials.some(t => t.photoIndex > 0) && <p className="pl-conditions">Использовались дополнительные фотографии. Результаты сохранены с конкретным фото каждой пробы.</p>}
      </div>
      {notice && <p className="pl-errors" role="alert">{notice}</p>}
      <p className="pl-conditions">Следующий план останется черновиком на той же сложности. Подготовленное ребёнку занятие изменится после подтверждения.</p>
      <div className="pl-actions"><button className="pl-primary" type="button" disabled={busy} onClick={prepareNext}>Подготовить следующее занятие</button><button className="pl-option" type="button" onClick={() => store.setScreen('modes')}>К теме</button></div>
    </>}
    {endVideo === 'open' && <RewardVideoModal rewardVideos={student.rewardVideos} studentId={student.id} onDismiss={() => setEndVideo('watched')} continueLabel="Вернуться к результату" />}
    {gate && <PeopleAdultGate onSuccess={() => { setGate(false); setAdult(true); }} onCancel={() => setGate(false)} />}
  </main></div>;
}
