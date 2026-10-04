import { useEffect, useRef, useState } from "react";

// A mini-picker: one button showing the current value as a pictogram, a list of the variants drops down under it.
// The button's name is the group's `label`; the variants are named by their own labels (aria-label only).
const Caret = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 3.5l3 3 3-3" /></svg>
);

export default function Propis2Picker({ label, value, options, onChange, disabled = false }) {
  const [openRaw, setOpen] = useState(false);
  const open = openRaw && !disabled;
  const ref = useRef(null);
  const current = options.find((o) => o.id === value) ?? options[0];

  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  const CurrentIcon = current.Icon;
  return (
    <div className="p2-pick" ref={ref}>
      <button type="button" className={`p2-pick-btn${open ? " is-open" : ""}`} aria-label={label} aria-haspopup="listbox" aria-expanded={open} data-value={current.id} disabled={disabled} onClick={() => setOpen((o) => !o)}>
        <CurrentIcon />
        <Caret />
      </button>
      {open && (
        <div className="p2-pick-list" role="listbox" aria-label={label}>
          {options.map(({ id, label: name, Icon }) => (
            <button key={id} type="button" role="option" aria-selected={id === current.id} aria-pressed={id === current.id} aria-label={name} className={`p2-pick-opt${id === current.id ? " is-on" : ""}`} onClick={() => { setOpen(false); onChange(id); }}>
              <Icon />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
