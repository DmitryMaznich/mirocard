import { useState } from "react";
import Modal from "@/shared/components/Modal";
import Button from "@/shared/components/Button";
import { closePeriodPlan } from "./lessonPlanApi";
import { itemsForCarryOver } from "./lessonPlanUtils";

export default function PeriodCarryOverSheet({ studentId, period, onClose }) {
  const [checked, setChecked] = useState(() => new Set(itemsForCarryOver(period)));
  const [saving, setSaving] = useState(false);

  function toggle(itemId) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId); else next.add(itemId);
      return next;
    });
  }

  async function handleConfirm() {
    setSaving(true);
    await closePeriodPlan(studentId, Array.from(checked));
    setSaving(false);
    onClose();
  }

  return (
    <Modal title="Период закончился" onClose={onClose}>
      <p>Что перенести в новый период?</p>
      <ul className="lesson-plan-add-sheet__list">
        {period.items.map((item) => (
          <li key={item.id}>
            <label style={{ display: "flex", gap: 8, alignItems: "center", padding: "8px 0" }}>
              <input type="checkbox" checked={checked.has(item.id)} onChange={() => toggle(item.id)} />
              <span style={{ flex: 1 }}>{item.label ?? item.text}</span>
              <span style={{ fontSize: 12, color: "#888" }}>сделано {period.progress[item.id]?.count ?? 0} раз</span>
            </label>
          </li>
        ))}
      </ul>
      <Button onClick={handleConfirm} disabled={saving}>
        Начать новый период ({period.durationDays} дней)
      </Button>
    </Modal>
  );
}
