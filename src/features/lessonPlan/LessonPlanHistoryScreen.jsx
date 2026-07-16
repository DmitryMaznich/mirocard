import { useEffect, useState } from "react";
import { useAppStore } from "@/core/store";
import { BackArrowIcon } from "@/shared/components/ArrowIcons";
import { getPeriodPlans, getSessionsForPeriod } from "./lessonPlanApi";
import { countTouchedGoals, sessionOccasionSummary } from "./lessonPlanUtils";
import "./lessonPlan.css";

const RU_MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
function formatDate(ts) {
  const d = new Date(ts);
  return `${d.getDate()} ${RU_MONTHS[d.getMonth()]}`;
}

export default function LessonPlanHistoryScreen() {
  const setScreen = useAppStore((s) => s.setScreen);
  const activeStudentId = useAppStore((s) => s.activeStudentId);
  const [periods, setPeriods] = useState(undefined);
  const [selectedPeriodId, setSelectedPeriodId] = useState(null);
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    if (!activeStudentId) return;
    getPeriodPlans(activeStudentId).then((list) => {
      setPeriods([...list].sort((a, b) => b.startedAt - a.startedAt));
    });
  }, [activeStudentId]);

  useEffect(() => {
    if (!selectedPeriodId) { setSessions([]); return; }
    getSessionsForPeriod(activeStudentId, selectedPeriodId).then(setSessions);
  }, [selectedPeriodId, activeStudentId]);

  if (periods === undefined) return <div className="screen-center">Загрузка…</div>;

  const selectedPeriod = periods.find((p) => p.id === selectedPeriodId) ?? null;

  return (
    <div className="screen lesson-plan-history-screen">
      <div className="screen-header">
        <button
          className="icon-btn"
          onClick={() => (selectedPeriod ? setSelectedPeriodId(null) : setScreen("home"))}
          aria-label="Назад"
        >
          <BackArrowIcon />
        </button>
        <div>История</div>
      </div>

      {!selectedPeriod ? (
        <ul className="lesson-plan-add-sheet__list" style={{ padding: 16 }}>
          {periods.length === 0 && <li style={{ color: "#888" }}>Пока нет периодов</li>}
          {periods.map((period) => {
            const touched = countTouchedGoals(period);
            return (
              <li key={period.id}>
                <button
                  onClick={() => setSelectedPeriodId(period.id)}
                  style={{ width: "100%", textAlign: "left", padding: "10px 0", background: "none", border: "none" }}
                >
                  <div>{formatDate(period.startedAt)} — {formatDate(period.startedAt + period.durationDays * 86400000)}</div>
                  <div style={{ fontSize: 13, color: "#888" }}>
                    {touched.touched} из {touched.total} целей задето{period.status === "active" ? " · текущий" : ""}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div style={{ padding: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Рекап по целям</div>
          <ul className="lesson-plan-add-sheet__list">
            {selectedPeriod.items.map((item) => {
              const progress = selectedPeriod.progress[item.id] ?? { count: 0, notes: [] };
              return (
                <li key={item.id} style={{ padding: "8px 0" }}>
                  <div>{item.label ?? item.text} <span style={{ color: "#1a73e8" }}>×{progress.count}</span></div>
                  {progress.notes.length > 0 && (
                    <div style={{ fontSize: 12, color: "#888" }}>
                      {progress.notes.map((n, i) => <span key={i}>«{n.text}» </span>)}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          <div style={{ fontWeight: 600, margin: "16px 0 8px" }}>Таймлайн занятий</div>
          <ul className="lesson-plan-add-sheet__list">
            {sessions.length === 0 && <li style={{ color: "#888" }}>Занятий пока не было</li>}
            {sessions.map((session) => {
              const summary = sessionOccasionSummary(session);
              return (
                <li key={session.id} style={{ padding: "6px 0", fontSize: 13 }}>
                  <b>{formatDate(session.createdAt)}</b> — {session.items.map((i) => i.label ?? i.text).join(", ")} ({summary.done}/{summary.total})
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
