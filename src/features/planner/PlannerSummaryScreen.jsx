import { useEffect, useState } from 'react';
import { useAppStore } from '@/core/store';
import { getTopicTitle } from '@/shared/utils/format';
import Button from '@/shared/components/Button';
import { getRawRecipeTxt } from '@/core/groupStore';
import { parseRecipeMetadata } from './recipeParser.js';
import { loadPlan, sendPlanToStudent } from './plannerApi.js';
import { BackArrowIcon, ForwardArrowIcon } from '@/shared/components/ArrowIcons';
import './planner.css';

export default function PlannerSummaryScreen() {
  const setScreen        = useAppStore((s) => s.setScreen);
  const students         = useAppStore((s) => s.students);
  const topicRecords     = useAppStore((s) => s.topicRecords);
  const activeStudentId  = useAppStore((s) => s.activeStudentId);
  const student          = students.find((s) => s.id === activeStudentId);

  const [plan, setPlan]       = useState(null);
  const [recipeMeta, setRecipeMeta] = useState({}); // textId -> { title, portions, fixedPortions }
  const [sending, setSending] = useState(false);
  const [sent, setSent]       = useState(false);
  const [sendError, setSendError] = useState(null);

  useEffect(() => {
    if (!activeStudentId) return;
    loadPlan(activeStudentId).then((p) => {
      if (!p) { setScreen('planner_menu'); return; }
      setPlan(p);
    });
  }, [activeStudentId]);

  useEffect(() => {
    if (!plan || !topicRecords.length) return;
    let cancelled = false;
    async function load() {
      const meta = {};
      for (const record of topicRecords) {
        if (record.meta?.renderer !== 'reading') continue;
        for (const text of record.texts ?? []) {
          if (!plan.selectedRecipes.includes(text.id) || !text.file) continue;
          const content = await getRawRecipeTxt(record.meta.id, text.file);
          if (!content) continue;
          const { portions, fixedPortions } = parseRecipeMetadata(content);
          meta[text.id] = { title: getTopicTitle(text.title), portions, fixedPortions };
        }
      }
      if (!cancelled) setRecipeMeta(meta);
    }
    load();
    return () => { cancelled = true; };
  }, [plan, topicRecords]);

  async function handleSend() {
    if (!plan) return;
    setSending(true);
    setSendError(null);
    try {
      await sendPlanToStudent(plan.studentId, plan);
      setSent(true);
    } catch (err) {
      setSendError(err?.message ?? 'Ошибка отправки');
    } finally {
      setSending(false);
    }
  }

  if (!plan) return <div className="screen screen-center">Загрузка…</div>;

  return (
    <div className="screen planner-screen">
      <div className="planner-header">
        <button className="planner-header__back" onClick={() => setScreen('planner_menu')}><BackArrowIcon size={22} /></button>
        <h1 className="planner-header__title">
          Меню{student ? ` для ${student.name}` : ''}
        </h1>
      </div>

      <div className="planner-body">
        <div className="plan-recipes-summary">
          {plan.selectedRecipes.map((textId) => {
            const meta = recipeMeta[textId];
            const meal = plan.mealAssignments[textId] ?? null;
            const portions = meta
              ? (meta.fixedPortions || plan.selectedPortions[textId] || meta.portions || 1)
              : null;
            return (
              <div key={textId} className="plan-recipe-summary-row">
                <span className="plan-recipe-summary-row__title">{meta?.title ?? textId}</span>
                <span className="plan-recipe-summary-row__meta">
                  {meal ?? '—'}
                  {portions != null ? ` · ${portions} порц.` : ''}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="planner-footer">
        <Button fullWidth onClick={() => setScreen('planner_shopping')}>
          🛒 Список покупок <ForwardArrowIcon size={16} />
        </Button>

        <div style={{ marginTop: 12 }}>
          {sent ? (
            <div className="planner-sent">✓ Отправлено ученику</div>
          ) : (
            <>
              {sendError && (
                <div style={{ color: 'red', fontSize: 13, marginBottom: 8, textAlign: 'center' }}>
                  {sendError}
                </div>
              )}
              <Button fullWidth variant="secondary" disabled={sending} onClick={handleSend}>
                {sending ? 'Отправляем…' : <span style={{display:'inline-flex',alignItems:'center',gap:6}}>Отправить меню ученику <ForwardArrowIcon size={16} /></span>}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
