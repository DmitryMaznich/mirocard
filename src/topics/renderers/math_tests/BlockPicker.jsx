import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BLOCK_KINDS, GROUPS, KIND_IDS, SOON } from "./blocks.js";
import { IconPlus } from "./icons";

// «Блок»: the catalogue of block kinds, by area; areas still to come are listed as «Скоро».
// The menu is drawn in a portal at a fixed place under the button: on a phone and a tablet the button
// sits in a toolbar that scrolls sideways (`.mt-strip`, overflow-x: auto), and an absolute menu inside
// it was clipped to the toolbar's height — the button seemed to do nothing (2026-11-11).
export default function BlockPicker({ onPick, caption = "Блок" }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const [host, setHost] = useState(null);
  const ref = useRef(null);
  const popRef = useRef(null);
  useLayoutEffect(() => {
    if (!open) return undefined;
    const place = () => {
      const r = ref.current?.getBoundingClientRect();
      if (!r) return;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const width = Math.min(440, vw - 24);
      const top = r.bottom + 6;
      const safeBottom = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--app-safe-bottom")) || 0; // iPhone home indicator
      setPos({ top, left: Math.max(12, Math.min(r.left, vw - width - 12)), width, maxHeight: Math.max(200, Math.min(620, vh - top - 12 - safeBottom)) });
    };
    setHost(ref.current?.closest(".mt-root") ?? document.body);
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [open]);
  useEffect(() => {
    if (!open) return undefined;
    const inside = (t) => ref.current?.contains(t) || popRef.current?.contains(t);
    const close = (e) => { if (!inside(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === "Escape") setOpen(false); };
    // the toolbar scrolled sideways: the menu would stay where the button was
    const scrolled = (e) => { if (!popRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", esc);
    document.addEventListener("scroll", scrolled, true);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", esc);
      document.removeEventListener("scroll", scrolled, true);
    };
  }, [open]);
  return (
    <div className="mt-picker" ref={ref}>
      <button type="button" className={`mt-tool${open ? " is-on" : ""}`} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} title="Добавить блок">
        <span className="mt-tool-ico"><IconPlus /></span><span className="mt-cap">{caption}</span>
      </button>
      {open && pos && host && createPortal((
        <div className="mt-picker-pop" role="menu" ref={popRef} style={pos}>
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
      ), host)}
    </div>
  );
}
