import { applyRewardMistake } from '../../../shared/reward-policy.mjs';
import { markSessionAction, handleQualityAnswer, handleAdvance } from '@/features/session/sessionEngine';
import { trialResult, insertLearningRetry } from './peopleLearning';
export function applyLearningEvent(state, event) {
  const task = state.tasks[state.taskIndex];
  if (task?.type !== 'people_learning_v2' || event.trialId !== task.trialId || state.status !== 'task_active') return state;
  const data = state.statistics.myPeople ?? { schemaVersion: 2, trials: [], progress: {} };
  if (data.trials.some(t => t.trialId === task.trialId)) return state;
  const current = data.progress[task.trialId] ?? { assistanceUsed: [], firstChoiceCorrect: null };
  let progress = current;
  state = markSessionAction(state);
  if (event.type === 'hint') progress = { ...current, assistanceUsed: [...new Set([...current.assistanceUsed, event.level === 'prefix' ? 'prefix' : 'model'])] };
  else if (event.type === 'choice') {
    if (!task.choices?.some(c => c.personId === event.personId)) return state;
    const correct = event.personId === task.targetPersonId;
    progress = { ...current, firstChoiceCorrect: current.firstChoiceCorrect ?? correct };
    if (!correct) {
      if (current.firstChoiceCorrect === false) return state;
      progress.assistanceUsed = [...new Set([...current.assistanceUsed, 'correction'])];
      state = applyRewardMistake(state);
    } else event = { ...event, type: 'complete', outcome: 'independent' };
  }
  const nextData = { ...data, progress: { ...data.progress, [task.trialId]: progress } };
  state = { ...state, statistics: { ...state.statistics, myPeople: nextData } };
  if (event.type !== 'complete') return state;
  if (!['independent', 'prompted', 'not_recalled', 'practice', 'presented', 'skipped'].includes(event.outcome)) return state;
  const result = trialResult(task, progress, event.outcome);
  if (task.kind === 'main' && ['prompted', 'not_recalled'].includes(result.outcome)) state = { ...state, tasks: insertLearningRetry(state.tasks, state.taskIndex) };
  // Reuse the shared reward policy, without giving a success to practice or intro.
  const beforeIndex = state.taskIndex;
  let next;
  if (['independent', 'prompted', 'not_recalled'].includes(result.outcome)) {
    next = handleQualityAnswer(state, result.outcome === 'independent' ? 'correct' : result.outcome === 'not_recalled' ? 'fail' : 'prompted', task.conceptId, task.targetPersonId);
    // Keep the evaluated card until the student's tap/auto pacing advances it.
    next = { ...next, status: 'answer_correct', taskIndex: beforeIndex };
  } else next = handleAdvance(state);
  return { ...next, statistics: { ...next.statistics, myPeople: { ...nextData, trials: [...nextData.trials, result] } } };
}
