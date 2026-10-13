import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ElementPicker } from "./Propis2Field";

// The text of the whole page as a mini text editor, for wide screens (PC, landscape tablet): it fills the free white area of the side
// panel, one line = one row of the page, line numbers on the left (the row of the sheet each line starts at; a long running text
// wraps, its number stays at its first visual line). The caret decides which row is selected; tapping a row on the sheet puts the
// caret on its line (`caretRequest.line`). `bar`: what stands in the header next to the «Элемент» button (the problem marks).
export default function Propis2TextEditor({ value, onChange, onCaret, placeholder, elements, onInsertElement, caretRequest, numbers, activeLine, bar }) {
  const ref = useRef(null);
  const measureRef = useRef(null);
  const [heights, setHeights] = useState([]);
  const [width, setWidth] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const lines = String(value ?? "").split("\n");

  // the width the text wraps at is the textarea's own: measured so that the line numbers can follow the wrapped lines
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const read = () => setWidth(el.clientWidth);
    read();
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useLayoutEffect(() => {
    const box = measureRef.current;
    if (!box) return;
    setHeights(Array.from(box.children).map((c) => c.offsetHeight));
  }, [value, width]);

  // put the caret where the parent asks: a position (after an element was inserted) or the start of a line (a row was tapped on the sheet)
  useEffect(() => {
    const el = ref.current;
    if (!el || !caretRequest) return;
    let pos = caretRequest.pos;
    if (pos == null && Number.isInteger(caretRequest.line)) {
      const all = el.value.split("\n");
      const k = Math.min(caretRequest.line, all.length - 1);
      pos = all.slice(0, k).reduce((n, l) => n + l.length + 1, 0);
    }
    if (pos == null) return;
    el.focus({ preventScroll: false });
    el.setSelectionRange(pos, pos);
  }, [caretRequest]);

  const report = () => { const el = ref.current; if (el) onCaret?.(el.selectionStart ?? 0); };

  return (
    <div className="p2-ed" data-testid="propis2-text-editor">
      <div className="p2-ed-bar">
        <ElementPicker elements={elements} onInsert={(text) => onInsertElement(text, ref.current?.selectionStart ?? value.length)} />
        <div className="p2-ed-bar-main">
          <strong className="p2-ed-title">Текст страницы</strong>
          {bar}
        </div>
      </div>
      <div className="p2-ed-body">
        <div className="p2-ed-gutter" aria-hidden="true">
          <div className="p2-ed-gutter-in" style={{ transform: `translateY(${-scrollTop}px)` }}>
            {lines.map((_, i) => (
              <div key={i} className={`p2-ed-num${i === activeLine ? " is-active" : ""}`} style={heights[i] ? { height: heights[i] } : undefined}>{numbers?.[i] ?? ""}</div>
            ))}
          </div>
        </div>
        <textarea
          ref={ref}
          className="p2-ed-text"
          value={value}
          placeholder={placeholder}
          aria-label="Текст страницы"
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => onChange(e.target.value, e.target.selectionStart ?? e.target.value.length)}
          onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
          onSelect={report}
          onKeyUp={report}
          onClick={report}
        />
        {/* the same text laid out invisibly at the textarea's width: the height of each line (wrapped or not) for the numbers */}
        <div className="p2-ed-measure" ref={measureRef} aria-hidden="true" style={width ? { width } : undefined}>
          {lines.map((l, i) => <div key={i}>{l || " "}</div>)}
        </div>
      </div>
      <p className="p2-ed-hint">Enter — новая строка страницы. Слово без пробелов — образец, фраза с пробелами — связный текст, пустая строка — место для письма. Цифры и знаки + − = &lt; &gt; набирайте с клавиатуры, элементы вставляйте кнопкой слева вверху.</p>
    </div>
  );
}
