import { useEffect, useState } from 'react';
import { useAppStore } from '@/core/store';
import { getTopicTitle } from '@/shared/utils/format';
import Button from '@/shared/components/Button';
import { MEAL_TYPES } from './plannerUtils.js';
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

  function getTitle(textId) {
    for (const record of topicRecords) {
      const text = (record.texts ?? []).find((t) => t.id === textId);
      if (text) return getTopicTitle(text.title);
    }
    return textId;
  }

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
        <div className="plan-days-summary">
          {plan.days.map((day) => {
            const filled = MEAL_TYPES.filter((m) => (day.meals[m] ?? []).length > 0);
            if (!filled.length) return null;
            return (
              <div key={day.dayIndex} className="plan-day-summary">
                <p className="plan-day-summary__title">День {day.dayIndex + 1}</p>
                {filled.map((mealType) => (
                  <div key={mealType} className="plan-meal-row">
                    <span className="plan-meal-row__type">{mealType}:</span>
                    {day.meals[mealType].map(({ textId, portions }) => (
                      <span key={textId} className="plan-meal-row__recipe">
                        {getTitle(textId)}{portions > 1 ? ` ×${portions}` : ''}
                      </span>
                    ))}
                  </div>
                ))}
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
