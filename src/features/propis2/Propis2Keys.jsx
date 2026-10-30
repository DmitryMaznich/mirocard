import { useEffect } from "react";

// Typing straight onto the sheet (owner, 2026-10-23): the page's text lives in a textarea nobody sees. It is what the keyboard types
// into (a phone shows its keyboard only for a focused field), and it does the caret, the selection, Enter, Backspace, the arrows,
// paste and the composing of an input method natively; the editor draws the caret and the letters on the copybook rows.
// `request` { pos, anchor? }: put the caret (a selection from `anchor`) there; Ctrl/Cmd+Z and Ctrl+Y / Ctrl+Shift+Z go to the
// editor's own undo (the textarea's native one knows nothing of the page).
// `onEdgeKey(key, pos)`: Backspace with the caret at the start of a line / Delete at its end; true = handled (the row's printed letter at that end was taken off), the key does nothing else
export default function Propis2Keys({ inputRef, value, onChange, onSelect, onFocusChange, onUndo, onRedo, onEdgeKey, request, readOnly = false }) {
  useEffect(() => {
    const el = inputRef.current;
    if (!el || !request) return;
    const pos = Math.max(0, Math.min(el.value.length, request.pos));
    const anchor = Math.max(0, Math.min(el.value.length, request.anchor ?? pos));
    if (document.activeElement !== el) el.focus({ preventScroll: true });
    el.setSelectionRange(Math.min(anchor, pos), Math.max(anchor, pos), pos < anchor ? "backward" : "forward");
    onSelect?.({ start: el.selectionStart, end: el.selectionEnd });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);

  const report = (e) => onSelect?.({ start: e.currentTarget.selectionStart ?? 0, end: e.currentTarget.selectionEnd ?? 0 });
  const onKeyDown = (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && !e.altKey && (e.key === "z" || e.key === "Z" || e.key === "я" || e.key === "Я")) { e.preventDefault(); (e.shiftKey ? onRedo : onUndo)?.(); return; }
    if (mod && !e.altKey && (e.key === "y" || e.key === "Y" || e.key === "н" || e.key === "Н")) { e.preventDefault(); onRedo?.(); return; }
    if (e.key === "Escape") e.currentTarget.blur();
    if ((e.key === "Backspace" || e.key === "Delete") && !mod && !e.altKey && onEdgeKey) {
      const el = e.currentTarget;
      const pos = el.selectionStart ?? 0;
      const atStart = pos === 0 || el.value[pos - 1] === "\n";
      const atEnd = pos === el.value.length || el.value[pos] === "\n";
      if (pos === el.selectionEnd && (e.key === "Backspace" ? atStart : atEnd) && onEdgeKey(e.key, pos)) e.preventDefault();
    }
  };

  return (
    <textarea
      ref={inputRef}
      className="p2-keys"
      wrap="off"
      value={value}
      readOnly={readOnly}
      aria-label="Текст страницы"
      autoCapitalize="off"
      autoCorrect="off"
      autoComplete="off"
      spellCheck={false}
      onChange={(e) => onChange(e.target.value, e.target.selectionStart ?? e.target.value.length)}
      onSelect={report}
      onKeyUp={report}
      onKeyDown={onKeyDown}
      onFocus={() => onFocusChange?.(true)}
      onBlur={() => onFocusChange?.(false)}
    />
  );
}
