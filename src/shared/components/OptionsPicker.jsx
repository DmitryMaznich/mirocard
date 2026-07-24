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
 * mode "single-optional": same replace-on-click behavior as "single", but
 * clicking the currently-selected choice again clears it back to empty —
 * used when at most one choice makes sense at a time (so no combining two
 * different prep instructions in one step) but skipping entirely is also a
 * valid choice (e.g. porridge topping — see oatmeal.txt). Callers relying on
 * a "single" group always resolving to some value (ParamsScreen.jsx /
 * PlannerMenuScreen.jsx's forced-default-to-first-choice) key off the exact
 * string "single", so "single-optional" deliberately does not trigger it.
 * Same pill visuals in every mode; only the click behavior differs.
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
    if (mode === "single-optional") {
      onChange(selectedSet.has(product) ? [] : [product]);
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
