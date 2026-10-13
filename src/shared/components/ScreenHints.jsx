import { useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./ScreenHints.css";

export function HintButton({ onClick, className = "", hidden = false }) {
  return <button type="button" className={`screen-hint-button ${className}`} style={hidden ? { visibility: "hidden" } : undefined} onClick={onClick} aria-label="Показать подсказки">💡</button>;
}

// Each screen owns its step descriptions and targets; this component owns
// placement, navigation and dismissal. The highlighted control stays usable.
export default function ScreenHints({ steps, onClose }) {
  const [index, setIndex] = useState(0);
  const [layout, setLayout] = useState(null);
  const cardRef = useRef(null);
  const titleId = useId();
  const step = steps[index];

  useLayoutEffect(() => {
    const previousFocus = document.activeElement;
    cardRef.current?.focus({ preventScroll: true });
    const onKeyDown = (event) => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [onClose]);

  useLayoutEffect(() => {
    const target = step.targetRef.current;
    const card = cardRef.current;
    if (!target || !card) { onClose(); return; }
    target.scrollIntoView?.({ block: "nearest", inline: "nearest", behavior: "instant" });
    const move = () => {
      const rect = target.getBoundingClientRect();
      const width = document.documentElement.clientWidth || window.innerWidth;
      const height = window.innerHeight;
      const cardBox = card.getBoundingClientRect();
      const pad = 12;
      const gap = 18;
      const below = rect.bottom + gap;
      const above = rect.top - cardBox.height - gap;
      const right = rect.right + gap;
      const left = rect.left - cardBox.width - gap;
      let x = Math.max(pad, Math.min(rect.left, width - cardBox.width - pad));
      let y;
      if (below + cardBox.height <= height - pad) y = below;
      else if (above >= pad) y = above;
      else if (right + cardBox.width <= width - pad) { x = right; y = rect.top; }
      else if (left >= pad) { x = left; y = rect.top; }
      else y = below;
      y = Math.max(pad, Math.min(y, height - cardBox.height - pad));
      setLayout({ target: { left: rect.left - 3, top: rect.top - 3, width: rect.width + 6, height: rect.height + 6 }, card: { left: x, top: y } });
    };
    move();
    const observer = new ResizeObserver(move);
    observer.observe(target);
    observer.observe(card);
    window.addEventListener("resize", move);
    document.addEventListener("scroll", move, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", move);
      document.removeEventListener("scroll", move, true);
    };
  }, [step, onClose]);

  return createPortal(<div className="screen-hints">
    {layout && <div className="screen-hints__target" style={layout.target} aria-hidden="true" />}
    <aside ref={cardRef} className="screen-hints__card" style={{ ...layout?.card, visibility: layout ? "visible" : "hidden" }} role="dialog" aria-labelledby={titleId} tabIndex={-1}>
      <button type="button" className="screen-hints__close" onClick={onClose} aria-label="Скрыть подсказки">×</button>
      <span className="screen-hints__eyebrow">ПОДСКАЗКИ · {index + 1} ИЗ {steps.length}</span>
      <strong id={titleId} aria-live="polite">{step.title}</strong>
      <p>{step.text}</p>
      <div className="screen-hints__actions">
        {index > 0 && <button type="button" onClick={() => setIndex(index - 1)}>Назад</button>}
        <button type="button" className="screen-hints__primary" onClick={() => index === steps.length - 1 ? onClose() : setIndex(index + 1)}>{index === steps.length - 1 ? "Готово" : "Далее"}</button>
      </div>
    </aside>
  </div>, document.body);
}
