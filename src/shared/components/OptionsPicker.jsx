/**
 * Checkbox group for one recipe "option" group (e.g. topping choices) —
 * shared between the meal planner's add-to-menu flow and the per-recipe
 * cook-start screen, so both read/write the same shape:
 * { [groupId]: string[] } of chosen product names, empty array meaning
 * none chosen (a valid, deliberate choice — not "not yet decided").
 */
export default function OptionsPicker({ label, choices, selected, onChange }) {
  const selectedSet = new Set(selected ?? []);

  function toggle(product) {
    const next = selectedSet.has(product)
      ? (selected ?? []).filter((p) => p !== product)
      : [...(selected ?? []), product];
    onChange(next);
  }

  return (
    <div className="options-picker">
      {label && <div className="options-picker__label">{label}</div>}
      <div className="options-picker__choices">
        {choices.map(({ product }) => (
          <button
            key={product}
            type="button"
            className={`options-picker__choice${selectedSet.has(product) ? ' options-picker__choice--active' : ''}`}
            onClick={() => toggle(product)}
            aria-pressed={selectedSet.has(product)}
          >
            {product}
          </button>
        ))}
      </div>
    </div>
  );
}
