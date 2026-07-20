/**
 * Choice group for one recipe "option" group (e.g. topping choices, or an
 * exclusive filling swap) — shared between the meal planner's add-to-menu
 * flow and the per-recipe cook-start screen, so both read/write the same
 * shape: { [groupId]: string[] } of chosen product names.
 *
 * mode "multi" (default): any subset or none, empty array meaning none
 * chosen (a valid, deliberate choice — not "not yet decided") — used for
 * toppings. mode "single": clicking a choice always replaces the selection
 * with just that one product — never toggles off, never empties — used for
 * an exclusive swap like "which filling" where exactly one must be chosen.
 * Same pill visuals in both modes; only the click behavior differs.
 *
 * Each choice may carry a `qtyLabel` (e.g. "8 кружочков", "1 горсть") —
 * already scaled and formatted by the caller (see ParamsScreen.jsx /
 * PlannerMenuScreen.jsx), since portions-scaling needs the same
 * scalePortionQty logic the flat ingredient ledger uses. This component
 * only renders whatever string it's given.
 */
export default function OptionsPicker({ label, choices, selected, onChange, mode = "multi" }) {
  const selectedSet = new Set(selected ?? []);

  function toggle(product) {
    if (mode === "single") {
      onChange([product]);
      return;
    }
    const next = selectedSet.has(product)
      ? (selected ?? []).filter((p) => p !== product)
      : [...(selected ?? []), product];
    onChange(next);
  }

  return (
    <div className="options-picker">
      {label && <div className="options-picker__label">{label}</div>}
      <div className="options-picker__choices">
        {choices.map(({ product, qtyLabel }) => (
          <button
            key={product}
            type="button"
            className={`options-picker__choice${selectedSet.has(product) ? ' options-picker__choice--active' : ''}`}
            onClick={() => toggle(product)}
            aria-pressed={selectedSet.has(product)}
          >
            {product}
            {qtyLabel && <span className="options-picker__choice-qty">{qtyLabel}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
