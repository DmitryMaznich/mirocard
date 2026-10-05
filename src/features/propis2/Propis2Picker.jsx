import { useEffect, useRef, useState } from "react";
import { useHint } from "./Propis2Hint";
import { usePopupPos } from "./usePopupPos";

// A mini-picker: one button showing the current value as a pictogram, a list of the variants drops down under it.
// The button's name is the group's `label`; the variants are named by their own labels (aria-label only).
const Caret = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 3.5l3 3 3-3" /></svg>
);

function Option({ id, name, Icon, on, onPick }) {
  const { bind, tip } = useHint(name, "right");
  return (
    <button type="button" role="option" aria-selected={on} aria-pressed={on} aria-label={name} className={`p2-pick-opt${on ? " is-on" : ""}`} onClick={() => onPick(id)} {...bind}>
      <Icon />
      {tip}
    </button>
  );
}

export default function Propis2Picker({ label, caption, value, options, onChange, disabled = false }) {
  const [openRaw, setOpen] = useState(false);
  const open = openRaw && !disabled;
  const ref = useRef(null);
  const btnRef = useRef(null);
  const listStyle = usePopupPos(open, btnRef, 62, () => setOpen(false));
  const current = options.find((o) => o.id === value) ?? options[0];

  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  const { bind, tip } = useHint(label);
  const CurrentIcon = current.Icon;
  return (
    <div className="p2-pick" ref={ref}>
      <button type="button" ref={btnRef} className={`p2-pick-btn p2-tool${open ? " is-open" : ""}`} aria-label={label} aria-haspopup="listbox" aria-expanded={open} data-value={current.id} disabled={disabled} onClick={() => setOpen((o) => !o)} {...bind}>
        <span className="p2-tool-ico"><CurrentIcon /><Caret /></span>
        {caption && <span className="p2-cap">{caption}</span>}
        {tip}
      </button>
      {open && (
        <div className="p2-pick-list" role="listbox" aria-label={label} style={listStyle ?? undefined}>
          {options.map(({ id, label: name, Icon }) => (
            <Option key={id} id={id} name={name} Icon={Icon} on={id === current.id} onPick={(v) => { setOpen(false); onChange(v); }} />
          ))}
        </div>
      )}
    </div>
  );
}
