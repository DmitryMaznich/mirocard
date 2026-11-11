import { useEffect, useRef, useState } from "react";
import { BLOCK_KINDS, GROUPS, KIND_IDS, SOON } from "./blocks.js";
import { IconPlus } from "./icons";

// «Блок»: the catalogue of block kinds, by area; areas still to come are listed as «Скоро».
export default function BlockPicker({ onPick, caption = "Блок" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", esc); };
  }, [open]);
  return (
    <div className="mt-picker" ref={ref}>
      <button type="button" className={`mt-tool${open ? " is-on" : ""}`} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} title="Добавить блок">
        <span className="mt-tool-ico"><IconPlus /></span><span className="mt-cap">{caption}</span>
      </button>
      {open && (
        <div className="mt-picker-pop" role="menu">
          <div className="mt-picker-head"><b>Добавить блок</b><span>в конец контрольной</span></div>
          {GROUPS.map((g) => (
            <div key={g.id} className="mt-picker-group">
              <span className="mt-picker-gtitle">{g.title}</span>
              {KIND_IDS.filter((id) => BLOCK_KINDS[id].group === g.id).map((id) => (
                <button key={id} type="button" role="menuitem" className="mt-picker-item" onClick={() => { setOpen(false); onPick(id); }}>
                  <span className="mt-picker-sample">{BLOCK_KINDS[id].sample}</span>
                  <span className="mt-picker-text"><b>{BLOCK_KINDS[id].title}</b><span>{BLOCK_KINDS[id].instruction}</span></span>
                </button>
              ))}
            </div>
          ))}
          <span className="mt-picker-gtitle mt-picker-gtitle--soon">Скоро</span>
          <div className="mt-picker-soon">
            {SOON.map((s) => (
              <div key={s.id} className="mt-picker-soon-item"><b>{s.title}</b><span>{s.sample}</span></div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
