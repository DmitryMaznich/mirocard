import { useEffect, useRef, useState } from "react";
import { BackArrowIcon } from "@/shared/components/ArrowIcons";
import * as I from "./Propis2Icons";

function dateLabel(ts) {
  try { return new Date(ts).toLocaleDateString("ru-RU"); } catch { return ""; }
}

// A tool of the library: an icon over a short caption (the same family as the editor's strips).
function Tool({ label, caption, onClick, tone = "", children }) {
  return (
    <button type="button" className={`p2-ib p2-tool ${tone}`} aria-label={label} title={label} onClick={onClick}>
      <span className="p2-tool-ico">{children}</span>
      <span className="p2-cap">{caption}</span>
    </button>
  );
}

// The notebook's name: a tap turns it into a field (Enter or leaving it saves, Escape cancels), no need to open the editor.
function NotebookTitle({ title, onRename }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const input = useRef(null);
  useEffect(() => { if (editing) input.current?.select(); }, [editing]);
  const commit = () => { setEditing(false); const t = draft.trim(); if (t && t !== title) onRename(t); };
  if (editing) {
    return (
      <input
        ref={input}
        className="p2-nb-title-input"
        value={draft}
        aria-label="Название тетради"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setDraft(title); setEditing(false); } }}
      />
    );
  }
  return (
    <button type="button" className="p2-nb-title" aria-label={`Переименовать тетрадь ${title}`} title="Переименовать" onClick={() => { setDraft(title); setEditing(true); }}>
      <span>{title || "Без названия"}</span>
      <I.IconRename />
    </button>
  );
}

// «Мои тетради»: the home of the topic. A notebook is the only thing the adult keeps: create one from scratch or from a ready one,
// open it as the student sees it, edit, rename, copy, delete.
export default function Propis2Library({ sets = [], ready = [], onBack, onNew, onOpenReady, onEditReady, onOpenSet, onEditSet, onRenameSet, onDuplicateSet, onDeleteSet }) {
  return (
    <div className="screen propis2-home propis2-lib" data-testid="propis2-library">
      <div className="screen-header">
        <button className="back-btn" onClick={onBack} aria-label="Назад"><BackArrowIcon /></button>
        <h1 className="screen-title">Прописи 2</h1>
      </div>
      <div className="propis2-body">
        <div className="p2-nb-start">
          <button type="button" className="p2-tile p2-tile--primary p2-tile--wide" aria-label="Новая тетрадь" onClick={onNew}>
            <span className="p2-tile-ico"><I.IconAddPage /></span>
            <span className="p2-tile-cap">Новая тетрадь</span>
          </button>
        </div>

        {sets.length > 0 && <h2 className="propis2-h2">Мои тетради</h2>}
        {sets.length > 0 && (
          <ul className="propis2-pages">
            {sets.map((st) => (
              <li key={st.id} className="p2-nb" data-testid="propis2-set-card">
                <div className="p2-nb-head">
                  <span className="p2-nb-ico"><I.IconNotebook /></span>
                  <div className="p2-nb-main">
                    <NotebookTitle title={st.title ?? ""} onRename={(t) => onRenameSet(st.id, t)} />
                    <div className="p2-nb-meta">{st.pageIds.length} стр. · {dateLabel(st.updatedAt)}</div>
                  </div>
                </div>
                <div className="p2-nb-tools" role="group" aria-label="Действия с тетрадью">
                  <Tool label={`Открыть тетрадь ${st.title ?? ""}`} caption="Открыть" tone="p2-tool--go" onClick={() => onOpenSet(st.id)}><I.IconPlay /></Tool>
                  <Tool label={`Изменить тетрадь ${st.title ?? ""}`} caption="Править" onClick={() => onEditSet(st.id)}><I.IconEditPage /></Tool>
                  <Tool label={`Копия тетради ${st.title ?? ""}`} caption="Копия" onClick={() => onDuplicateSet(st.id)}><I.IconDuplicate /></Tool>
                  <Tool label={`Удалить тетрадь ${st.title ?? ""}`} caption="Удалить" tone="p2-ib--danger" onClick={() => onDeleteSet(st.id)}><I.IconTrash /></Tool>
                </div>
              </li>
            ))}
          </ul>
        )}

        {ready.length > 0 && (
          <>
            <h2 className="propis2-h2">Готовые тетради</h2>
            <ul className="propis2-pages">
              {ready.map((r) => (
                <li key={r.id} className="p2-nb p2-nb--ready" data-testid="propis2-ready-card">
                  <div className="p2-nb-head">
                    <span className="p2-nb-ico"><I.IconNotebook /></span>
                    <div className="p2-nb-main">
                      <div className="p2-nb-name">{r.title}</div>
                      <div className="p2-nb-meta">{r.pages} стр.</div>
                    </div>
                  </div>
                  <div className="p2-nb-tools" role="group" aria-label="Действия с тетрадью">
                    <Tool label={`Открыть тетрадь ${r.title}`} caption="Открыть" tone="p2-tool--go" onClick={() => onOpenReady(r.id)}><I.IconPlay /></Tool>
                    <Tool label={`Изменить тетрадь ${r.title}`} caption="Править" onClick={() => onEditReady(r.id)}><I.IconEditPage /></Tool>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
