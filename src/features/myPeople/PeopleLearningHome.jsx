import VideoPrizeCard from '@/features/rewards/VideoPrizeCard';
import { persistStudentTopicLink } from '@/core/linkUtils';
import { effectiveRewardSettings } from '../../../shared/reward-policy.mjs';
import { getDb, kv } from '@/core/db';
import { cloneElement, useEffect, useState } from 'react';
import { useAppStore } from '@/core/store';
import { flushQueue } from '@/core/syncApi';
import { useTimer } from '@/features/timer/TimerContext';
import PinGateModal from '@/shared/components/PinGateModal';
import { BackArrowIcon } from '@/shared/components/ArrowIcons';
import { openMyPeopleSettings } from './myPeopleReadiness';
import { defaultPlan, normalizePlan, planReadiness, learningPeople, scopeKey, PEOPLE_MODE_ID, planDescription, learningPhotoReferences, PEOPLE_CATEGORIES, categoryPeople, chooseCategory } from './peopleLearning';
import { loadLearningDocuments, loadLearningLocal, saveLearningDocument, learningDocKey } from './peopleLearningStore';
import { LearningPhoto } from './PeopleLearningTask';
import './peopleLearning.css';
export function PeopleAdultGate({ onSuccess, onCancel }) {
  const hash = useAppStore(s => s.settings.adultPinHash);
  useEffect(() => { if (!hash) onSuccess(); }, [hash, onSuccess]);
  return hash ? <PinGateModal pinHash={hash} onSuccess={onSuccess} onCancel={onCancel} /> : null;
}
function Options({ label, value, values, onChange }) {
  return <fieldset className="pl-setting"><legend>{label}</legend><div className="pl-options">{values.map(([v, title]) => <button className="pl-option" type="button" key={v} aria-pressed={v === value} onClick={() => onChange(v)}>{title}</button>)}</div></fieldset>;
}
function PeopleSet({ label, value, people, onChange }) {
  return <fieldset className="pl-setting"><legend>{label}</legend><div className="pl-people">{people.map(person => <label className="pl-person" key={person.id}>
    <input type="checkbox" checked={value.includes(person.id)} onChange={() => onChange(value.includes(person.id) ? value.filter(id => id !== person.id) : [...value, person.id])} />
    <span>{person.name}<small>{person.type === 'pet' ? 'Питомец' : person.relation}</small></span>
  </label>)}</div></fieldset>;
}
const PLAN_COVERED_MODE_IDS = ['show_me', 'who_is_this'];
export default function PeopleLearningHome({ legacy }) {
  const identity = useAppStore(s => `${s.account?.id}:${s.activeStudentId}`);
  return <PeopleLearningHomeContent key={identity} legacy={legacy} />;
}
function PeopleLearningHomeContent({ legacy }) {
  const student = useAppStore(s => s.students.find(p => p.id === s.activeStudentId));
  const owner = useAppStore(s => s.account?.id);
  const store = useAppStore();
  const { markSessionStart } = useTimer();
  const [intent, setIntent] = useState(() => useAppStore.getState().myPeoplePreparationScope);
  const [docs, setDocs] = useState(null), [page, setPage] = useState('child'), [gate, setGate] = useState(intent?.studentId === student?.id);
  const [draft, setDraft] = useState(() => defaultPlan(student)), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [route, setRoute] = useState('legacy');
  useEffect(() => {
    let disposed = false;
    if (!owner || !student?.id) { Promise.resolve().then(() => { if (!disposed) setDocs({}); }); return; }
    // Render the account's offline copy immediately, then reconcile with server.
    const apply = next => { if (!disposed) { setDocs(next); setRoute(next[learningDocKey(student.id, 'route', 'main')]?.version ?? 'legacy'); if (next.__conflicts?.length) setError('На другом устройстве подготовлен другой план. Проверьте текущий план перед запуском.'); } };
    loadLearningLocal(owner, student.id).then(apply);
    loadLearningDocuments(owner, student.id).then(apply).catch(() => { if (!disposed) setError('Не удалось прочитать планы. Попробуйте открыть тему снова.'); });
    return () => { disposed = true; };
  }, [owner, student?.id]);
  const people = learningPeople(student), check = planReadiness(student, draft);
  const topicLink = store.studentTopicLinks[`${student?.id}_my_people`] ?? {};
  const prize = { videoRewardEnabled: topicLink.videoRewardEnabled ?? true, answersPerStar: topicLink.answersPerStar ?? 1, strictStars: topicLink.strictStars ?? true, ...draft.rewardConfig };
  const changePrize = patch => update({ rewardConfig: { ...prize, ...patch } });
  const prepared = docs?.[learningDocKey(student?.id, 'plan', 'self')];
  const childCheck = prepared ? planReadiness(student, prepared) : null;
  const update = patch => setDraft(p => normalizePlan({ ...p, ...patch }, student));
  async function save(kind, scope, payload, expected) {
    const value = await saveLearningDocument(owner, student.id, kind, scope, payload, expected);
    setDocs(d => ({ ...d, [learningDocKey(student.id, kind, scope)]: value }));
    flushQueue().catch(() => {}); return value;
  }
  function prepare() {
    const requestedScope = intent?.studentId === student.id ? intent : draft;
    const p = docs?.[learningDocKey(student.id, 'draft', scopeKey(requestedScope))] ?? prepared ?? defaultPlan(student);
    store.setMyPeoplePreparationScope(null); setIntent(null);
    setDraft(normalizePlan(p, student)); setPage('adult');
  }
  function changeScope(patch) {
    const next = { ...draft, ...patch };
    const saved = docs?.[learningDocKey(student.id, 'draft', scopeKey(next))];
    const category = next.goal === 'relation' && next.category === 'pets' ? 'all' : next.category;
    const p = saved ?? defaultPlan(student, { goal: next.goal, activity: next.activity, context: next.context, category,
      targetPersonIds: categoryPeople(student, category, next.goal).slice(0, category === 'all' ? 3 : undefined).map(p => p.id) });
    setDraft(normalizePlan(p, student));
  }
  async function launch(raw) {
    const valid = planReadiness(student, raw);
    if (!valid.ready) { setError(valid.errors.join(' ')); return; }
    const exposures = Object.fromEntries(Object.values(docs ?? {}).filter(d => d.exposureKey).map(d => [d.exposureKey, true]));
    const photoReferences = await learningPhotoReferences(student);
    const snapshot = store.activeSessionSnapshot;
    const savedParams = snapshot?.sessionState?.statistics?.conditions?.params;
    const samePlan = snapshot?.context?.studentId === student.id && snapshot.context.modeId === PEOPLE_MODE_ID && savedParams?.id === raw.id;
    const photosValid = samePlan && snapshot.sessionState.tasks.every(task => {
      const refs = task.choices ?? [{ personId: task.targetPersonId, image: task.image, photoRef: task.photoRef }];
      return refs.every(ref => people.some(p => p.id === ref.personId && (p.photos.includes(ref.image) || ref.photoRef && photoReferences[p.id]?.includes(ref.photoRef))));
    });
    if (samePlan && !photosValid) {
      store.clearActiveSessionSnapshot(); await kv.del(await getDb(), 'activeSession');
    }
    store.setMyPeopleLaunchPlan(photosValid ? savedParams : { ...valid.plan, exposures, photoReferences });
    if (valid.plan.rewardConfig) await persistStudentTopicLink(student.id, 'my_people', valid.plan.rewardConfig);
    store.setActiveTopicId('my_people'); store.setActiveModeId(PEOPLE_MODE_ID);
    store.setSessionReturnScreen('modes'); markSessionStart(); store.setScreen('session');
  }
  async function confirm() {
    setBusy(true); setError('');
    try {
      await save('draft', scopeKey(draft), draft);
      const p = await save('plan', draft.context, draft, docs?.[learningDocKey(student.id, 'plan', draft.context)]?.id ?? null);
      if (draft.context === 'self') setPage('child'); else await launch(p);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function switchRoute(version) {
    setBusy(true);
    try { await save('route', 'main', { version }); setRoute(version); setPage('child'); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  if (docs === null) return <div className="screen-center">Загрузка плана…</div>;
  if (!student) return <div className="pl-page"><h1>Мои люди</h1><p>Выберите ученика на главном экране.</p><button className="pl-primary" onClick={() => store.setScreen('home')}>На главную</button></div>;
  // The ordinary list of modes, with the switch to the plan route on top.
  if (route === 'legacy') return <><div className="pl-page pl-switch"><button className="pl-option" onClick={() => setGate(true)}>Занятия по плану</button><p className="pl-conditions">Взрослый готовит план, ребёнок начинает одной кнопкой. Этот список останется в «Других упражнениях».</p>{error && <p role="alert">{error}</p>}</div>{legacy}{gate && <PeopleAdultGate onSuccess={() => { setGate(false); switchRoute('new'); }} onCancel={() => setGate(false)} />}</>;
  // «Другие упражнения» inside the plan route: the plan already does
  // «Покажи» (choose the photo) and «Кто это?» (name it), so they are left
  // out here; «back» returns to the adult's page.
  if (page === 'legacy') return cloneElement(legacy, { hiddenModeIds: PLAN_COVERED_MODE_IDS, onBack: () => setPage('adult') });
  return <div className="screen"><main className="pl-page">
    <header className="pl-page__head"><button type="button" aria-label="Назад" onClick={() => page === 'child' ? store.setScreen('home') : setPage(page === 'settings' ? 'adult' : 'child')}><BackArrowIcon /></button><h1>Мои люди</h1></header>
    {error && <p className="pl-errors" role="alert">{error}</p>}
    {page === 'child' ? <section className="pl-hero">
      <h2>{prepared ? 'Давай позанимаемся' : 'Здесь будут твои люди'}</h2>
      <div className="pl-preview">{(prepared?.targetPersonIds ?? []).map(id => people.find(p => p.id === id)).filter(Boolean).slice(0, 6).map(p => <LearningPhoto key={p.id} src={p.photos[0]} />)}</div>
      {prepared ? <button type="button" className="pl-primary pl-primary--start" disabled={!childCheck.ready || busy} onClick={() => launch(prepared)}>Начать</button> : <p>Взрослый подготовит первое занятие.</p>}
      {childCheck && !childCheck.ready && <p>Нужно обновить подготовленное занятие.</p>}
      <button type="button" className="pl-link" onClick={() => setGate(true)}>Для взрослого</button>
    </section> : <>
      <h2>Подготовка занятия · {student.name}</h2>
      <div className="pl-card">
        <Options label="Что учим" value={draft.goal} values={[[ 'name', 'Имена' ], [ 'relation', 'Кто он мне' ]]} onChange={goal => changeScope({ goal })} />
        <Options label="Кого отрабатываем" value={draft.category} values={PEOPLE_CATEGORIES.filter(([key]) => (key !== 'pets' || draft.goal === 'name') && (key !== 'home' || people.some(p => p.contexts?.includes('home'))))} onChange={category => setDraft(chooseCategory(student, draft, category))} />
        <Options label="Как занимаемся" value={draft.context} values={[[ 'self', 'Самостоятельно' ], [ 'adult', 'Со взрослым' ]]} onChange={context => changeScope({ context })} />
        <Options label="Задание" value={draft.activity} values={[[ 'select', 'Выбрать фото' ], [ 'recall', 'Назвать самому' ]]} onChange={activity => changeScope({ activity })} />
      </div>
      <section className="pl-card"><h2>Сегодня</h2><p className="pl-conditions">{planDescription(draft)}</p>
        <p>{draft.targetPersonIds.map(id => people.find(p => p.id === id)?.name ?? 'Карточка недоступна').join(', ') || 'Выберите людей'}</p>
        {draft.context === 'self' && draft.activity === 'recall' && <p className="pl-conditions">Практика с образцом, без оценки правильности ответа.</p>}
        <button type="button" className="pl-link" onClick={() => setPage(page === 'settings' ? 'adult' : 'settings')}>{page === 'settings' ? 'Свернуть параметры' : 'Все параметры'}</button>
        <button type="button" className="pl-link" onClick={async () => { try { await save('draft', scopeKey(draft), draft); openMyPeopleSettings({ studentId: student.id, returnScreen: 'modes' }); } catch (e) { setError(e.message); } }}>Карточки людей и питомцев</button>
      </section>
      {page === 'settings' && <section className="pl-card">
        {draft.activity === 'select' ? <Options label="Фото на экране" value={draft.fieldSize} values={[2, 3, 4, 6].map(n => [n, `${n} фото · ${n - 1} отвлекающих`])} onChange={fieldSize => update({ fieldSize })} />
          : <Options label="Начальная помощь" value={draft.initialHint} values={[[ 'model', 'Полный образец' ], [ 'prefix', 'Начало слова' ], [ 'none', 'Без подсказки' ]]} onChange={initialHint => update({ initialHint })} />}
        <Options label="Фотографии" value={draft.photoMode} values={[[ 'primary', 'Основные' ], [ 'available', 'Чередовать доступные' ]]} onChange={photoMode => update({ photoMode })} />
        <Options label="Вопросов в занятии" value={draft.questionCount} values={[4, 6, 8].map(n => [n, String(n)])} onChange={questionCount => update({ questionCount })} />
        {draft.activity === 'select' && <Options label="Знакомство перед выбором" value={draft.introMode} values={[[ 'new', 'Только новые слова' ], [ 'all', 'Перед каждым раундом' ], [ 'off', 'Пропустить' ]]} onChange={introMode => update({ introMode })} />}
        <Options label="Озвучка" value={draft.voice} values={[[ true, 'Включена' ], [ false, 'Выключена' ]]} onChange={voice => update({ voice })} />
        {(student.rewardVideos?.length ?? 0) > 0 && <VideoPrizeCard enabled={prize.videoRewardEnabled} onEnabled={videoRewardEnabled => changePrize({ videoRewardEnabled })}
          showSeries={draft.activity !== 'recall' || draft.context === 'adult'} answersPerStar={prize.answersPerStar} onAnswersPerStar={answersPerStar => changePrize({ answersPerStar })}
          showAtEnd atEnd={draft.videoAtEnd === true} onAtEnd={videoAtEnd => update({ videoAtEnd })}
          showStrict={draft.activity !== 'recall' || draft.context === 'adult'} strict={prize.strictStars} onStrict={strictStars => changePrize({ strictStars })} rules={effectiveRewardSettings(student.rewardSettings)} />}
        <PeopleSet label="Кого учим" value={draft.targetPersonIds} people={categoryPeople(student, draft.category, draft.goal)} onChange={targetPersonIds => update({ targetPersonIds })} />
        {draft.activity === 'select' && <PeopleSet label="Откуда брать отвлекающие варианты" value={draft.distractorPoolIds} people={people} onChange={distractorPoolIds => update({ distractorPoolIds })} />}
        <button type="button" className="pl-option" disabled={busy} onClick={async () => { setBusy(true); try { await save('draft', scopeKey(draft), draft); setPage('adult'); } catch (e) { setError(e.message); } finally { setBusy(false); } }}>Сохранить черновик</button>
      </section>}
      {!check.ready && <div className="pl-errors" role="status">{check.errors.map(reason => <p key={reason}>{reason}</p>)}</div>}
      {store.activeSessionSnapshot?.context?.studentId === student.id && store.activeSessionSnapshot?.context?.modeId === PEOPLE_MODE_ID && store.activeSessionSnapshot.sessionState.statistics?.conditions?.params?.context === 'adult' && <button type="button" className="pl-option" onClick={() => launch(store.activeSessionSnapshot.sessionState.statistics.conditions.params)}>Продолжить занятие со взрослым</button>}
      <div className="pl-actions"><button type="button" className="pl-primary" disabled={!check.ready || busy} onClick={confirm}>{draft.context === 'self' ? 'Подготовить ребёнку' : 'Начать вместе'}</button></div>
      {prepared && <p className="pl-conditions">Сейчас ребёнку подготовлено: {planDescription(prepared)}. Черновик изменит этот план только после подтверждения.</p>}
      <div className="pl-actions"><button type="button" className="pl-link" onClick={() => setPage('legacy')}>Другие упражнения</button><button type="button" className="pl-link" disabled={busy} onClick={() => switchRoute('legacy')}>Выключить занятия по плану</button></div>
    </>}
    {gate && <PeopleAdultGate onSuccess={() => { setGate(false); prepare(); }} onCancel={() => setGate(false)} />}
  </main></div>;
}
