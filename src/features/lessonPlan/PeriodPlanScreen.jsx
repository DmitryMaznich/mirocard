import { useEffect, useState } from "react";
import { useAppStore } from "@/core/store";
import Button from "@/shared/components/Button";
import { BackArrowIcon } from "@/shared/components/ArrowIcons";
import { getActivePeriodPlan, startPeriodPlan, addPeriodItem } from "./lessonPlanApi";
import { isPeriodExpired } from "./lessonPlanUtils";
import AddPlanItemSheet from "./AddPlanItemSheet";
import PeriodCarryOverSheet from "./PeriodCarryOverSheet";
import "./lessonPlan.css";

const DEFAULT_DURATION_DAYS = 7;

export default function PeriodPlanScreen() {
  const setScreen = useAppStore((s) => s.setScreen);
  const activeStudentId = useAppStore((s) => s.activeStudentId);
  const [period, setPeriod] = useState(undefined);
  const [showAdd, setShowAdd] = useState(false);
  const [showCarryOver, setShowCarryOver] = useState(false);

  async function reload() {
    setPeriod(await getActivePeriodPlan(activeStudentId));
  }

  useEffect(() => { reload(); }, [activeStudentId]);

  async function handleStart() {
    setPeriod(await startPeriodPlan(activeStudentId, DEFAULT_DURATION_DAYS));
  }

  async function handleAddItem(itemInput) {
    setPeriod(await addPeriodItem(activeStudentId, itemInput));
    setShowAdd(false);
  }

  function handleClosed() {
    setShowCarryOver(false);
    reload();
  }

  if (period === undefined) return <div className="screen-center">Загрузка…</div>;

  return (
    <div className="screen lesson-plan-period-screen">
      <div className="screen-header">
        <button className="icon-btn" onClick={() => setScreen("home")} aria-label="Назад"><BackArrowIcon /></button>
        <div>План периода</div>
      </div>

      {!period ? (
        <div style={{ padding: 16 }}>
          <p>Периода пока нет — начните, чтобы вести бэклог целей.</p>
          <Button onClick={handleStart}>Начать период ({DEFAULT_DURATION_DAYS} дней)</Button>
        </div>
      ) : (
        <div style={{ padding: 16 }}>
          <div style={{ fontSize: 13, color: "#888", marginBottom: 12 }}>
            день {Math.min(Math.floor((Date.now() - period.startedAt) / 86400000) + 1, period.durationDays)} из {period.durationDays}
            {isPeriodExpired(period) && <span style={{ color: "#c00" }}> · период завершён</span>}
          </div>

          <ul className="lesson-plan-add-sheet__list">
            {period.items.map((item) => (
              <li key={item.id} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0" }}>
                <span>{item.label ?? item.text}</span>
                <span style={{ color: "#1a73e8", fontWeight: 600 }}>×{period.progress[item.id]?.count ?? 0}</span>
              </li>
            ))}
            {period.items.length === 0 && <li style={{ padding: "10px 0", color: "#888" }}>Пока нет целей</li>}
          </ul>

          <Button variant="secondary" onClick={() => setShowAdd(true)}>+ Добавить цель</Button>
          <div style={{ textAlign: "center", marginTop: 12 }}>
            <button style={{ background: "none", border: "none", color: "#c00", fontSize: 13 }} onClick={() => setShowCarryOver(true)}>
              {isPeriodExpired(period) ? "Завершить период" : "Завершить период досрочно"}
            </button>
          </div>
        </div>
      )}

      {showAdd && <AddPlanItemSheet onPick={handleAddItem} onClose={() => setShowAdd(false)} />}
      {showCarryOver && period && (
        <PeriodCarryOverSheet studentId={activeStudentId} period={period} onClose={handleClosed} />
      )}
    </div>
  );
}
