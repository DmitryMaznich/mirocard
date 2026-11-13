// «Контрольные по математике»: the solving in progress, kept on this device so it is never lost —
// the Android Back button (it sits right under the keypad on some tablets), a reload, the app
// closed in the middle. One draft: the test itself (a ready sheet solved in «Решить контрольную» is not
// saved anywhere else) and what the child has written: values (answers, marks, crossings), the boxes
// locked as right after «Исправить ошибки», the check's marks. Saved on every change; cleared when the
// sheet is solved without mistakes or solved again from the start.
const KEY = "mirocard:math_tests:draft";

export function loadDraft() {
  try {
    const d = JSON.parse(window.localStorage.getItem(KEY) ?? "null");
    return d && d.test && d.test.id ? d : null;
  } catch {
    return null;
  }
}

export function saveDraft(draft) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ ...draft, at: Date.now() }));
  } catch { /* storage full or blocked: the solving goes on, only not kept */ }
}

export function clearDraft() {
  try { window.localStorage.removeItem(KEY); } catch { /* nothing kept */ }
}

// is there anything worth keeping (something written, or a check)?
export const draftHasWork = (d) => Boolean(d && (d.marks || Object.values(d.values ?? {}).some((v) => v !== "" && v != null)));
