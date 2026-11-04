import { studentPeople, resolvePerson } from '../../../shared/student-people.mjs';
import { personRelations, wordKey } from '../../../shared/my-people-v2.mjs';
export const PEOPLE_MODE_ID = 'people_learning_v2';
export const newId = () => crypto.randomUUID();
export const scopeKey = p => `${p.goal}:${p.activity}:${p.context}`;
export function learningPeople(student) {
  return studentPeople(student).filter(p => !p.deletedAt && !p.mergedInto && p.enabled !== false && p.name?.trim() && p.photos?.some(Boolean));
}
export async function learningPhotoReferences(student) {
  return Object.fromEntries(await Promise.all(learningPeople(student).map(async person => [person.id, await Promise.all(person.photos.filter(Boolean).map(async image => {
    if (!image.startsWith('data:')) return image;
    // Same identity as extractAndStorePhoto on the server: no base64 in results.
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(image.slice(image.indexOf(',') + 1)));
    return `/api/photos/${Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('').slice(0, 32)}`;
  }))])));
}
export function defaultPlan(student, scope = {}) {
  const people = learningPeople(student);
  return { schemaVersion: 2, studentId: student?.id, goal: 'name', activity: 'select', context: 'self',
    targetPersonIds: people.slice(0, 3).map(p => p.id), distractorPoolIds: people.map(p => p.id),
    fieldSize: 2, initialHint: 'none', photoMode: 'primary', questionCount: 6, introMode: 'new', voice: true, ...scope };
}
export function normalizePlan(raw, student) {
  const defaults = defaultPlan(student);
  const p = { ...defaults, ...raw, schemaVersion: 2, studentId: student?.id };
  p.goal = p.goal === 'relation' ? 'relation' : 'name';
  p.activity = p.activity === 'recall' ? 'recall' : 'select';
  p.context = p.context === 'adult' ? 'adult' : 'self';
  p.fieldSize = [2, 3, 4, 6].includes(Number(p.fieldSize)) ? Number(p.fieldSize) : 2;
  p.questionCount = [4, 6, 8].includes(Number(p.questionCount)) ? Number(p.questionCount) : 6;
  p.initialHint = ['model', 'prefix'].includes(p.initialHint) ? p.initialHint : 'none';
  p.photoMode = p.photoMode === 'available' ? 'available' : 'primary';
  p.introMode = ['all', 'off'].includes(p.introMode) ? p.introMode : 'new';
  const canonical = ids => [...new Set((Array.isArray(ids) ? ids : []).map(id => resolvePerson(studentPeople(student), id)?.id ?? id))];
  p.targetPersonIds = canonical(p.targetPersonIds); p.distractorPoolIds = canonical(p.distractorPoolIds);
  return p;
}
function names(person) { return [person.name, ...(person.nameVariants ?? [])].filter(x => typeof x === 'string' && x.trim()).map(wordKey); }
function roles(person) { return personRelations(person).flatMap(r => [r.label, ...(r.acceptedLabels ?? [])]).map(wordKey); }
function overlaps(a, b) { return a.some(x => b.includes(x)); }
function alternatives(target, pool, plan, role) {
  return pool.filter(p => p.id !== target.id && (plan.goal === 'name' ? !overlaps(names(target), names(p)) : !overlaps([role.label, ...(role.acceptedLabels ?? [])].map(wordKey), roles(p))));
}
export function planReadiness(student, raw) {
  const plan = normalizePlan(raw, student), people = learningPeople(student), byId = new Map(people.map(p => [p.id, p]));
  const errors = [];
  if (!student) errors.push('Выберите ученика.');
  if (!plan.targetPersonIds.length) errors.push('Выберите, кого учим.');
  for (const id of plan.targetPersonIds) {
    const p = byId.get(id);
    if (!p) { errors.push('Одна из выбранных карточек выключена, удалена или без фото.'); continue; }
    if (plan.goal === 'relation' && (p.type === 'pet' || !personRelations(p).length)) { errors.push(`${p.name}: выберите человека и укажите отношение к ребёнку.`); continue; }
    if (plan.activity === 'select') {
      for (const role of plan.goal === 'relation' ? personRelations(p) : [null]) {
        const count = alternatives(p, plan.distractorPoolIds.map(i => byId.get(i)).filter(Boolean), plan, role).length;
        if (count < plan.fieldSize - 1) errors.push(`${p.name}${role ? ` · ${role.label}` : ''}: доступно ${count} отвлекающих вариантов, нужно ${plan.fieldSize - 1}.`);
      }
    }
  }
  return { ready: !errors.length, errors: [...new Set(errors)], plan };
}
export function wordPrefix(word, explicit) {
  if (explicit?.trim()) return explicit.trim();
  // A pronounceable beginning through the first vowel, not two arbitrary characters.
  return word?.trim().match(/^[^аеёиоуыэюя]*[аеёиоуыэюя]/iu)?.[0] ?? word?.trim()?.[0] ?? '';
}
const shuffle = (items, random) => {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
};
export function exposureKey(task) { return `${task.targetPersonId}:${task.goal}:${task.targetRelationKey ?? 'name'}:${wordKey(task.model)}`; }
export function generateLearningTasks(student, raw, exposures = {}, random = Math.random) {
  const check = planReadiness(student, raw);
  if (!check.ready) return [];
  const plan = check.plan, people = learningPeople(student), targets = plan.targetPersonIds.map(id => people.find(p => p.id === id));
  const order = shuffle(targets, random), tasks = [], counters = new Map();
  let previousPosition = -1;
  const make = (person, index) => {
    const visits = counters.get(person.id) ?? 0; counters.set(person.id, visits + 1);
    const relations = personRelations(person), role = plan.activity === 'recall' ? relations.find(r => r.key === person.preferredRelationKey) ?? relations[0] : relations[visits % Math.max(1, relations.length)];
    const model = plan.goal === 'name' ? person.name.trim() : (plan.activity === 'select' ? role.label : (relations.find(r => r.key === person.preferredRelationKey) ?? relations[0]).label);
    const photos = person.photos.filter(Boolean), photoIndex = plan.photoMode === 'available' ? visits % photos.length : 0;
    const conceptId = `people_v2:${plan.goal}:${plan.activity}:${person.id}:${plan.goal === 'relation' ? plan.activity === 'recall' ? 'any' : role.key : 'name'}`;
    const task = { type: 'people_learning_v2', trialId: newId(), conceptId, kind: 'main', sourceTrialId: null,
      goal: plan.goal, activity: plan.activity, context: plan.context, targetPersonId: person.id,
      targetRelationKey: plan.goal === 'relation' && plan.activity === 'select' ? role.key : null,
      acceptedRelationKeys: plan.goal === 'relation' ? relations.map(r => r.key) : [],
      model, image: photos[photoIndex], photoRef: plan.photoReferences?.[person.id]?.[photoIndex] ?? photos[photoIndex], photoIndex, initialHint: plan.activity === 'recall' ? plan.initialHint : 'none',
      prefix: wordPrefix(model, plan.goal === 'name' ? person.nameHint : role?.hintPrefix),
      prompt: plan.activity === 'recall' ? plan.goal === 'name' ? 'Как зовут?' : 'Кто это тебе?' :
        plan.goal === 'name' ? `Где ${model}?` : role.questionForm ? `Покажи ${role.questionForm}.` : `Кто тебе «${model}»?`,
      conditionsFingerprint: JSON.stringify({ goal: plan.goal, activity: plan.activity, context: plan.context, fieldSize: plan.activity === 'select' ? plan.fieldSize : null, initialHint: plan.initialHint, photoMode: plan.photoMode }),
    };
    if (plan.activity === 'select') {
      const pool = plan.distractorPoolIds.map(id => people.find(p => p.id === id)).filter(Boolean);
      const choices = shuffle(alternatives(person, pool, plan, role), random).slice(0, plan.fieldSize - 1);
      let position = index % plan.fieldSize;
      if (position === previousPosition) position = (position + 1) % plan.fieldSize;
      previousPosition = position;
      choices.splice(position, 0, person);
      task.choices = choices.map(p => ({ personId: p.id, image: p.id === person.id ? task.image : p.photos[plan.photoMode === 'available' ? index % p.photos.length : 0], photoRef: plan.photoReferences?.[p.id]?.[p.id === person.id ? photoIndex : plan.photoMode === 'available' ? index % p.photos.length : 0] }));
    }
    return task;
  };
  const introduced = new Set();
  for (let i = 0; i < plan.questionCount; i++) {
    const task = make(order[i % order.length], i);
    const key = exposureKey(task);
    if (plan.activity === 'select' && plan.introMode !== 'off' && !introduced.has(key) && (plan.introMode === 'all' || !exposures[key])) {
      tasks.push({ ...task, trialId: newId(), kind: 'intro', choices: undefined, prompt: `Это ${task.model}.` }); introduced.add(key);
    }
    tasks.push(task);
  }
  return tasks;
}
export function insertLearningRetry(tasks, index) {
  const source = tasks[index];
  if (source.kind !== 'main' || tasks.some(t => t.sourceTrialId === source.trialId)) return tasks;
  const retry = { ...source, trialId: newId(), kind: 'retry', sourceTrialId: source.trialId, initialHint: 'none' };
  if (source.choices) retry.choices = [...source.choices.slice(1), source.choices[0]];
  const next = [...tasks];
  let after = index + 1, other = 0;
  while (after < next.length && other < 2) { if (next[after].kind !== 'intro' && next[after].targetPersonId !== source.targetPersonId) other++; after++; }
  next.splice(after, 0, retry); return next;
}
export function trialResult(task, progress = {}, requested) {
  const assistanceUsed = [...new Set([...(task.initialHint !== 'none' ? [task.initialHint] : []), ...(progress.assistanceUsed ?? [])])];
  if (requested === 'prompted' && !assistanceUsed.length) assistanceUsed.push('adult');
  let outcome = requested;
  if (task.kind === 'intro') outcome = 'presented';
  else if (requested === 'skipped') outcome = 'skipped';
  else if (task.activity === 'recall' && task.context === 'self') outcome = 'practice';
  else if (outcome === 'independent' && (assistanceUsed.length || progress.firstChoiceCorrect === false)) outcome = 'prompted';
  return { schemaVersion: 2, trialId: task.trialId, sourceTrialId: task.sourceTrialId, kind: task.kind, goal: task.goal,
    activity: task.activity, context: task.context, targetPersonId: task.targetPersonId, targetRelationKey: task.targetRelationKey,
    acceptedRelationKeys: task.acceptedRelationKeys, photoRef: task.photoRef, photoIndex: task.photoIndex,
    choicePersonIds: task.choices?.map(c => c.personId) ?? [], assistanceUsed, firstChoiceCorrect: progress.firstChoiceCorrect ?? null,
    outcome, conditionsFingerprint: task.conditionsFingerprint };
}
export function learningSummary(trials = []) {
  const main = trials.filter(t => t.kind === 'main'), checked = main.filter(t => ['independent', 'prompted', 'not_recalled'].includes(t.outcome));
  const independent = checked.filter(t => t.outcome === 'independent').length;
  return { main, checked: checked.length, independent, prompted: checked.filter(t => t.outcome === 'prompted').length,
    notRecalled: checked.filter(t => t.outcome === 'not_recalled').length, practice: main.filter(t => t.outcome === 'practice').length,
    skipped: main.filter(t => t.outcome === 'skipped').length, retries: trials.filter(t => t.kind === 'retry'),
    presented: trials.filter(t => t.outcome === 'presented').length, percentCorrect: checked.length ? Math.round(independent * 100 / checked.length) : null };
}
export function nextLearningPlan(plan, trials) {
  const weak = [...new Set(trials.filter(t => t.kind === 'main' && ['prompted', 'not_recalled'].includes(t.outcome)).map(t => t.targetPersonId))];
  if (!weak.length) return { ...plan, id: undefined, revision: undefined };
  const familiar = plan.targetPersonIds.find(id => !weak.includes(id));
  return { ...plan, id: undefined, revision: undefined, targetPersonIds: [...weak, ...(familiar ? [familiar] : [])] };
}

export function planDescription(plan) {
  return `${plan.goal === 'name' ? 'Имена' : 'Кто он мне'} · ${plan.activity === 'select' ? `Выбрать фото · ${plan.fieldSize} ${plan.fieldSize === 6 ? "карточек" : "карточки"}` : `Назвать самому · ${{ none: 'без начальной подсказки', prefix: 'начало слова', model: 'полный образец' }[plan.initialHint]}`} · ${plan.questionCount} ${plan.questionCount === 4 ? "вопроса" : "вопросов"} · ${plan.photoMode === 'available' ? 'доступные фото' : 'основные фото'}`;
}
