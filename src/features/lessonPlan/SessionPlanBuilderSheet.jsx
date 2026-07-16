import { useState } from "react";
import Modal from "@/shared/components/Modal";
import Button from "@/shared/components/Button";
import { startSessionPlan, closeSessionPlan } from "./lessonPlanApi";

export default function SessionPlanBuilderSheet({ studentId, periodPlan, existingSessionPlan, onClose }) {
  const [checkedPeriodItems, setCheckedPeriodItems] = useState(() => {
    if (existingSessionPlan) {
      return new Set(
        existingSessionPlan.items.filter((i) => i.origin === "period").map((i) => i.periodItemId)
      );
    }
    return new Set((periodPlan?.items ?? []).map((i) => i.id));
  });
  const [adhocText, setAdhocText] = useState("");
  const [adhocItems, setAdhocItems] = useState(() =>
    existingSessionPlan ? existingSessionPlan.items.filter((i) => i.origin === "adhoc").map((i) => i.text) : []
  );
  const [saving, setSaving] = useState(false);

  function togglePeriodItem(itemId) {
    setCheckedPeriodItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId); else next.add(itemId);
      return next;
    });
  }

  function addAdhoc() {
    const text = adhocText.trim();
    if (!text) return;
    setAdhocItems((prev) => [...prev, text]);
    setAdhocText("");
  }

  function removeAdhoc(index) {
    setAdhocItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleStart() {
    setSaving(true);
    await startSessionPlan(studentId, {
      periodItemIds: Array.from(checkedPeriodItems),
      adhocTexts: adhocItems,
      periodPlanId: periodPlan?.id ?? null,
    });
    setSaving(false);
    onClose();
  }

  async function handleCloseExisting() {
    setSaving(true);
    await closeSessionPlan(studentId);
    setSaving(false);
    onClose();
  }

  const totalCount = checkedPeriodItems.size + adhocItems.length;

  return (
    <Modal title="Собрать план на сегодня" onClose={onClose}>
      {periodPlan && periodPlan.items.length > 0 && (
        <>
          <div style={{ fontSize: 12, color: "#888", textTransform: "uppercase", margin: "8px 0 6px" }}>
            Из плана периода
          </div>
          <ul className="lesson-plan-add-sheet__list">
            {periodPlan.items.map((item) => (
              <li key={item.id} style={{ padding: "6px 0" }}>
                <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={checkedPeriodItems.has(item.id)}
                    onChange={() => togglePeriodItem(item.id)}
                  />
                  <span>{item.label ?? item.text}</span>
                </label>
              </li>
            ))}
          </ul>
        </>
      )}

      <div style={{ fontSize: 12, color: "#888", textTransform: "uppercase", margin: "12px 0 6px" }}>
        Разовое на сегодня
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <input
          className="lesson-plan-add-sheet__input"
          style={{ flex: 1 }}
          value={adhocText}
          onChange={(e) => setAdhocText(e.target.value)}
          placeholder="Например, «повторить стишок»"
        />
        <Button variant="secondary" onClick={addAdhoc} disabled={!adhocText.trim()}>+</Button>
      </div>
      {adhocItems.length > 0 && (
        <ul className="lesson-plan-add-sheet__list">
          {adhocItems.map((text, i) => (
            <li key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
              <span>{text}</span>
              <button onClick={() => removeAdhoc(i)} aria-label="Удалить">×</button>
            </li>
          ))}
        </ul>
      )}

      <Button onClick={handleStart} disabled={saving || totalCount === 0}>
        {existingSessionPlan ? `Обновить план (${totalCount})` : `Начать занятие (${totalCount})`}
      </Button>
      {existingSessionPlan && (
        <div style={{ textAlign: "center", marginTop: 8 }}>
          <button
            style={{ background: "none", border: "none", color: "#c00", fontSize: 13 }}
            onClick={handleCloseExisting}
            disabled={saving}
          >
            Закрыть текущий чек-лист
          </button>
        </div>
      )}
    </Modal>
  );
}
