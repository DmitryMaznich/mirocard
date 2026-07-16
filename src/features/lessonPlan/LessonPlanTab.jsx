import { useEffect, useState } from "react";
import { getActivePeriodPlan, getActiveSessionPlan, pullLessonPlanKvFromServer } from "./lessonPlanApi";
import { countTouchedGoals, isPeriodExpired, sessionOccasionSummary } from "./lessonPlanUtils";
import { useLessonPlan } from "./LessonPlanContext";
import SessionPlanBuilderSheet from "./SessionPlanBuilderSheet";
import "./lessonPlan.css";

export default function LessonPlanTab({ student, setScreen }) {
  const [periodPlan, setPeriodPlan] = useState(undefined);
  const [sessionPlan, setSessionPlan] = useState(undefined);
  const [showBuilder, setShowBuilder] = useState(false);
  const lessonPlan = useLessonPlan();

  async function reload() {
    if (!student) return;
    const [period, session] = await Promise.all([
      getActivePeriodPlan(student.id),
      getActiveSessionPlan(student.id),
    ]);
    setPeriodPlan(period);
    setSessionPlan(session);
  }

  useEffect(() => {
    if (!student) return;
    pullLessonPlanKvFromServer().then(reload);
  }, [student?.id]);

  function handleBuilderClose() {
    setShowBuilder(false);
    reload();
    lessonPlan?.refresh(student.id);
  }

  if (!student) {
    return <div className="home-tab-empty">Выбери ученика выше</div>;
  }
  if (periodPlan === undefined || sessionPlan === undefined) {
    return <div className="home-tab-empty">Загрузка…</div>;
  }

  const touched = periodPlan ? countTouchedGoals(periodPlan) : null;
  const sessionSummary = sessionPlan ? sessionOccasionSummary(sessionPlan) : null;

  return (
    <div className="lesson-plan-hub">
      <button className="lesson-plan-hub__card" onClick={() => setScreen("lesson_plan_period")}>
        <div className="lesson-plan-hub__label">Период</div>
        <div className="lesson-plan-hub__value">
          {periodPlan
            ? `${touched.touched} из ${touched.total} целей задето${isPeriodExpired(periodPlan) ? " · период завершён" : ""}`
            : "Пока нет активного периода"}
        </div>
      </button>

      <button className="lesson-plan-hub__card lesson-plan-hub__card--active" onClick={() => setShowBuilder(true)}>
        <div className="lesson-plan-hub__label">Занятие сегодня</div>
        <div className="lesson-plan-hub__value">
          {sessionPlan
            ? `${sessionSummary.done}/${sessionSummary.total} · продолжить`
            : "Собрать план на сегодня"}
        </div>
      </button>

      <button className="lesson-plan-hub__history-link" onClick={() => setScreen("lesson_plan_history")}>
        История →
      </button>

      {showBuilder && (
        <SessionPlanBuilderSheet
          studentId={student.id}
          periodPlan={periodPlan}
          existingSessionPlan={sessionPlan}
          onClose={handleBuilderClose}
        />
      )}
    </div>
  );
}
