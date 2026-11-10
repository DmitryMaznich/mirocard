import { useEffect, useRef, useState } from "react";
import { useHint } from "./Propis2Hint";
import { usePopupPos } from "./usePopupPos";

// A mini-picker: one button showing the current value as a pictogram, a list of the variants drops down under it.
// The button's name is the group's `label`; the variants are named by their own labels (aria-label only). A variant with `disabled` is
// shown but cannot be picked (it does not apply to this paper).
const Caret = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 3.5l3 3 3-3" /></svg>
);

function Option({ id, name, Icon, text, on, onPick, disabled = false }) {
  const { bind, tip } = useHint(name, "right");
  return (
    <button type="button" role="option" aria-selected={on} aria-pressed={on} aria-label={name} aria-disabled={disabled || undefined} disabled={disabled} className={`p2-pick-opt${text ? " p2-pick-opt--text" : ""}${on ? " is-on" : ""}`} onClick={() => onPick(id)} {...(text ? {} : bind)}>
      {text ? <span className="p2-pick-text">{text}</span> : <Icon />}
      {!text && tip}
    </button>
  );
}

export default function Propis2Picker({ label, caption, value, options, onChange, disabled = false, mixed = false, kind }) {
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
      <button type="button" ref={btnRef} className={`p2-pick-btn p2-tool${open ? " is-open" : ""}`} aria-label={label} aria-haspopup="listbox" aria-expanded={open} aria-description={mixed ? "в тетради по-разному" : undefined} data-value={current.id} data-kind={kind} disabled={disabled} onClick={() => setOpen((o) => !o)} {...bind}>
        {mixed && <span className="p2-mixed" aria-hidden="true" />}
        <span className="p2-tool-ico">{current.text ? <span className="p2-pick-current-text">{current.text}</span> : <CurrentIcon />}<Caret /></span>
        {caption && <span className="p2-cap">{caption}</span>}
        {tip}
      </button>
      {open && (
        <div className="p2-pick-list" role="listbox" aria-label={label} style={listStyle ?? undefined}>
          {options.map(({ id, label: name, Icon, text, disabled: off }) => (
            <Option key={id} id={id} name={name} Icon={Icon} text={text} disabled={off} on={id === current.id} onPick={(v) => { setOpen(false); onChange(v); }} />
          ))}
        </div>
      )}
    </div>
  );
}
