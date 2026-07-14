import { useEffect, useState } from "react";
import Modal from "@/shared/components/Modal";
import { getStoveHeatMapping, saveStoveHeatMapping, pullRecipeKvFromServer } from "@/core/groupStore";

const STOVE_HEAT_LEVELS = [
  { key: "weak",       label: "Слабый огонь" },
  { key: "medium",     label: "Средний огонь" },
  { key: "strong",     label: "Сильный огонь" },
  { key: "veryStrong", label: "Очень сильный огонь" },
];

/**
 * One family-wide setting (not per-recipe — it's a property of the stove,
 * not the dish): maps each qualitative heat level recipes use to the
 * family's own dial number. Reused from both the Планировщик "Меню" screen
 * and the per-recipe start screen — same modal, same storage, so a change
 * made from either place is immediately visible from the other.
 */
export default function StoveHeatModal({ onClose }) {
  const [mapping, setMapping] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      await pullRecipeKvFromServer().catch(() => {});
      const saved = await getStoveHeatMapping().catch(() => null);
      if (!cancelled) setMapping(saved);
    }
    load();
    return () => { cancelled = true; };
  }, []);

  function handleFieldChange(key, value) {
    const num = value === "" ? null : Math.max(1, Math.min(20, parseInt(value, 10) || 1));
    setMapping((prev) => ({ ...prev, [key]: num }));
  }

  async function handleSave() {
    await saveStoveHeatMapping(mapping).catch(() => {});
    onClose?.();
  }

  return (
    <Modal title="Цифры на плите" onClose={onClose}>
      <p className="stove-heat-modal__hint">
        У всех плит разная шкала. Впишите, какой цифре на вашей плите
        соответствует каждый уровень нагрева из рецептов — эта цифра
        будет показываться рядом с огоньками во время готовки.
      </p>
      {STOVE_HEAT_LEVELS.map(({ key, label }) => (
        <div className="stove-heat-modal__row" key={key}>
          <label htmlFor={`stove-heat-${key}`}>{label}</label>
          <input
            id={`stove-heat-${key}`}
            type="number"
            min="1"
            max="20"
            inputMode="numeric"
            value={mapping?.[key] ?? ""}
            onChange={(e) => handleFieldChange(key, e.target.value)}
          />
        </div>
      ))}
      <button type="button" className="menu-shopping-btn" onClick={handleSave}>
        Сохранить
      </button>
    </Modal>
  );
}
