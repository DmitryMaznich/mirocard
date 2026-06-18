import { useEffect, useRef, useState, Fragment } from "react";
import { useAppStore } from "@/core/store";
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, useSortable, arrayMove, rectSortingStrategy } from "@dnd-kit/sortable";
import { CSS as DndCSS } from "@dnd-kit/utilities";
import { parseRecipeTxt } from "../reading/parseRecipeTxt";
import {
  getRawRecipeTxt, pullRecipeKvFromServer,
  getShoppingOrder, saveShoppingOrder, applyShoppingOrder,
  getShoppingPlan, saveShoppingPlan,
  getShoppingHistory, saveShoppingHistory,
  getShoppingStores, saveShoppingStores,
} from "@/core/groupStore";

// ─── helpers ─────────────────────────────────────────────────────────────────

function sName(step) { return step.text.replace(/:$/, "").trim(); }

const RU_DAYS   = ["воскресенье","понедельник","вторник","среда","четверг","пятница","суббота"];
const RU_MONTHS = ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];
function formatTodayRu() {
  const d = new Date();
  return `${d.getDate()} ${RU_MONTHS[d.getMonth()]}, ${RU_DAYS[d.getDay()]}`;
}

function formatHistoryDate(d) {
  return `${d.getDate()} ${RU_MONTHS[d.getMonth()]} • ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function pluralItems(n) {
  const abs = Math.abs(n) % 100;
  const m = abs % 10;
  if (abs >= 11 && abs <= 19) return "товаров";
  if (m === 1) return "товар";
  if (m >= 2 && m <= 4) return "товара";
  return "товаров";
}

// ─── Store picker ──────────────────────────────────────────────────────────────

const DEFAULT_STORES = ["Меркатор", "Спар", "Лидл", "Хофер"];

function StorePicker({ storeList, onSelect, onSaveList, onBack }) {
  const [editingIdx, setEditingIdx] = useState(null);
  const [editVal, setEditVal] = useState("");
  const [adding, setAdding] = useState(false);
  const [addVal, setAddVal] = useState("");

  function startEdit(i) { setEditingIdx(i); setEditVal(storeList[i]); }
  function saveEdit() {
    if (!editVal.trim()) return;
    const next = storeList.map((s, i) => (i === editingIdx ? editVal.trim() : s));
    onSaveList(next);
    setEditingIdx(null);
  }
  function deleteStore(i) { onSaveList(storeList.filter((_, j) => j !== i)); }
  function saveAdd() {
    if (!addVal.trim()) return;
    onSaveList([...storeList, addVal.trim()]);
    setAddVal(""); setAdding(false);
  }

  return (
    <div className="session-body reading-body shopping-body">
      <div className="store-picker-header">
        {onBack && (
          <button className="shopping-back-btn" onClick={onBack} aria-label="Назад">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
              <rect x="2" y="2" width="7" height="7" rx="1.5" fill="currentColor"/>
              <rect x="11" y="2" width="7" height="7" rx="1.5" fill="currentColor"/>
              <rect x="2" y="11" width="7" height="7" rx="1.5" fill="currentColor"/>
              <rect x="11" y="11" width="7" height="7" rx="1.5" fill="currentColor"/>
            </svg>
          </button>
        )}
        <span className="store-picker-title">В какой магазин?</span>
      </div>

      <div className="store-picker-list">
        {storeList.map((s, i) => (
          editingIdx === i ? (
            <div key={i} className="store-row store-row--editing">
              <input
                className="store-edit-input"
                autoFocus
                value={editVal}
                onChange={(e) => setEditVal(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveEdit()}
              />
              <button className="store-edit-ok" onClick={saveEdit} disabled={!editVal.trim()}>✓</button>
              <button className="store-edit-cancel" onClick={() => setEditingIdx(null)}>✕</button>
            </div>
          ) : (
            <div key={i} className="store-row">
              <button className="store-row-name" onClick={() => onSelect(s)}>{s}</button>
              <button className="store-row-edit" onClick={() => startEdit(i)} aria-label="Переименовать">✏️</button>
              <button className="store-row-delete" onClick={() => deleteStore(i)} aria-label="Удалить">×</button>
            </div>
          )
        ))}

        {adding ? (
          <div className="store-row store-row--editing">
            <input
              className="store-edit-input"
              autoFocus
              value={addVal}
              onChange={(e) => setAddVal(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveAdd()}
              placeholder="Название магазина"
            />
            <button className="store-edit-ok" onClick={saveAdd} disabled={!addVal.trim()}>✓</button>
            <button className="store-edit-cancel" onClick={() => { setAdding(false); setAddVal(""); }}>✕</button>
          </div>
        ) : (
          <button className="store-add-btn" onClick={() => setAdding(true)}>+ Добавить магазин</button>
        )}
      </div>

      <div className="store-picker-footer">
        <button className="store-skip-btn" onClick={() => onSelect(null)}>Без магазина</button>
      </div>
    </div>
  );
}

function printShoppingList(allItems, todayStr, store) {
  let listHtml = "";
  let prevCat = null;
  let prevSub = null;
  for (const { item, category, subgroup, note } of allItems) {
    if (category && category !== prevCat) {
      listHtml += `<li class="cat">${category}</li>`;
      prevSub = null;
    }
    if (subgroup && subgroup !== prevSub && !isDupSubgroup(subgroup, category)) {
      listHtml += `<li class="sub">${subgroup}</li>`;
    }
    listHtml += `<li class="item">&#9744;&nbsp;${item}${note ? ` <em>(${note})</em>` : ""}</li>`;
    prevCat = category;
    prevSub = subgroup;
  }
  const title = store ? `Список покупок для похода в ${store}` : "Список покупок";
  const html = `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><title>${title}</title><style>
*{box-sizing:border-box;margin:0;padding:0}
@page{size:A4;margin:18mm 22mm}
body{font-family:Arial,Helvetica,sans-serif;color:#111}
h1{font-size:20pt;font-weight:900;text-transform:uppercase;margin:0 0 3pt;line-height:1.2}
.meta{font-size:11pt;color:#666;margin-bottom:3pt}
hr{border:none;border-top:1.5pt solid #bbb;margin:8pt 0}
ul{list-style:none}
li.cat{font-size:13pt;font-weight:900;color:#1a6a55;padding:7pt 0 2pt;margin-top:4pt;border-top:1pt solid #d0eae5}
li.cat:first-child{border-top:none;margin-top:0}
li.sub{font-size:9pt;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#fff;background:#4a9a82;padding:2pt 8pt;margin:5pt 0 2pt;border-radius:3pt;display:inline-block}
li.item{font-size:13pt;padding:2.5pt 0 2.5pt 6pt;line-height:1.4}
li.item em{color:#555;font-style:normal}
</style></head><body>
<h1>${title}</h1>
<div class="meta">${todayStr}</div><hr>
<ul>${listHtml}</ul>
<script>window.addEventListener('load',function(){window.print();window.addEventListener('afterprint',function(){window.close();});})</script>
</body></html>`;
  const win = window.open("about:blank", "_blank");
  if (!win) return;
  win.document.open();
  win.document.write(html);
  win.document.close();
}
function planKey(name, ii) { return `${name}_${ii}`; }

function stripEmoji(s) { return s.replace(/^\S+\s+/, "").trim(); }
function isDupSubgroup(subgroup, categoryName) { return stripEmoji(subgroup) === categoryName; }

async function loadShoppingData(topicId, task) {
  await pullRecipeKvFromServer().catch(() => {});
  const [raw, savedOrder, savedPlan] = await Promise.all([
    getRawRecipeTxt(topicId, task.text?.file).catch(() => null),
    getShoppingOrder(topicId).catch(() => null),
    getShoppingPlan(topicId).catch(() => ({})),
  ]);
  const rawSteps = raw
    ? parseRecipeTxt(raw).filter((s) => s.type === "checklist" || s.type === "action")
    : (task.text?.steps ?? []).filter((s) => s.type === "checklist" || s.type === "action");
  const rawIcons = task.text?.categoryIcons ?? [];
  const { steps, categoryIcons } = applyShoppingOrder(rawSteps, rawIcons, savedOrder);
  return { rawSteps, rawIcons, steps, categoryIcons, savedPlan: savedPlan ?? {} };
}

// ─── SortablePlanTile  (uses same shopping-tile CSS as reading renderer) ──────

function SortablePlanTile({ id, icon, name, count }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: DndCSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
    zIndex: isDragging ? 10 : undefined,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`shopping-tile shopping-tile--sortable${count > 0 ? " shopping-tile--partial" : ""}${isDragging ? " shopping-tile--dragging" : ""}`}
      {...attributes}
      {...listeners}
    >
      <span className="shopping-tile-drag-handle">⠿</span>
      <span className="shopping-tile-icon">{icon}</span>
      <span className="shopping-tile-name">{name}</span>
      {count > 0 && <span className="shopping-tile-badge">{count}</span>}
    </div>
  );
}

// ─── PlanMode ─────────────────────────────────────────────────────────────────
// Uses the same shopping-* CSS classes as ShoppingListTask in reading renderer.

function PlanMode({ task, topicId, store, onGoToShop, onChangeStore, onExit }) {
  const [steps, setSteps] = useState([]);
  const [categoryIcons, setCategoryIcons] = useState([]);
  const [planned, setPlanned] = useState({});
  const [history, setHistory] = useState([]);
  const [view, setView] = useState("grid"); // "grid" | "history" | "preview" | number
  const [sortMode, setSortMode] = useState(false);
  const [pressingTile, setPressingTile] = useState(null);
  const [editingNote, setEditingNote] = useState(null); // { key, value } | null
  const [confirmClear, setConfirmClear] = useState(false);
  const rawStepsRef = useRef([]);
  const rawIconsRef = useRef([]);
  const longPressTimerRef = useRef(null);
  const didLongPressRef = useRef(false);

  function noteFor(key) {
    const v = planned[key];
    return v && typeof v === "object" ? (v.note ?? "") : "";
  }

  function clearAll() {
    const next = {};
    setPlanned(next);
    saveShoppingPlan(topicId, next).catch(() => {});
    setConfirmClear(false);
  }

  function saveNote(key, rawValue) {
    const note = rawValue.trim();
    setPlanned((prev) => {
      const next = { ...prev };
      next[key] = note ? { note } : true;
      saveShoppingPlan(topicId, next).catch(() => {});
      return next;
    });
    setEditingNote(null);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
  );

  useEffect(() => {
    loadShoppingData(topicId, task).then(({ rawSteps, rawIcons, steps, categoryIcons, savedPlan }) => {
      rawStepsRef.current = rawSteps;
      rawIconsRef.current = rawIcons;
      setSteps(steps);
      setCategoryIcons(categoryIcons);
      setPlanned(savedPlan);
    });
    getShoppingHistory(topicId).then(setHistory).catch(() => {});
  }, [topicId, task.text?.id, task.text?.file]);

  function toggleItem(step, ii) {
    const key = planKey(sName(step), ii);
    setPlanned((prev) => {
      const next = { ...prev };
      if (next[key]) { delete next[key]; } else { next[key] = true; }
      saveShoppingPlan(topicId, next).catch(() => {});
      return next;
    });
  }

  function plannedInStep(step) {
    const name = sName(step);
    return (step.items ?? []).filter((_, ii) => planned[planKey(name, ii)]).length;
  }

  const totalPlanned = steps.reduce((sum, s) => sum + plannedInStep(s), 0);

  function handleDragEnd({ active, over }) {
    if (!over || active.id === over.id) return;
    const ids = steps.map((s) => s.text);
    const oi = ids.indexOf(active.id), ni = ids.indexOf(over.id);
    if (oi < 0 || ni < 0) return;
    const ns = arrayMove(steps, oi, ni);
    const nc = arrayMove(categoryIcons, oi, ni);
    setSteps(ns);
    setCategoryIcons(nc);
    saveShoppingOrder(topicId, ns.map(sName)).catch(() => {});
  }

  function resetOrder() {
    saveShoppingOrder(topicId, null).catch(() => {});
    setSteps(rawStepsRef.current);
    setCategoryIcons(rawIconsRef.current);
    setSortMode(false);
  }

  function startLongPress(si) {
    didLongPressRef.current = false;
    setPressingTile(si);
    longPressTimerRef.current = setTimeout(() => {
      didLongPressRef.current = true;
      setPressingTile(null);
      setSortMode(true);
      if (navigator.vibrate) navigator.vibrate(60);
    }, 5000);
  }

  function cancelLongPress() {
    clearTimeout(longPressTimerRef.current);
    setPressingTile(null);
  }

  // ── Detail view ────────────────────────────────────────────────────────────
  if (typeof view === "number") {
    const step = steps[view];
    const items = step?.items ?? [];
    const name = sName(step);
    const icon = categoryIcons[view] ?? "📦";
    const pCount = plannedInStep(step);

    return (
      <div className="session-body reading-body shopping-body">
        <div className="shopping-detail-header">
          <button className="shopping-back-btn" onClick={() => setView("grid")} aria-label="К категориям">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
              <rect x="2" y="2" width="7" height="7" rx="1.5" fill="currentColor"/>
              <rect x="11" y="2" width="7" height="7" rx="1.5" fill="currentColor"/>
              <rect x="2" y="11" width="7" height="7" rx="1.5" fill="currentColor"/>
              <rect x="11" y="11" width="7" height="7" rx="1.5" fill="currentColor"/>
            </svg>
          </button>
          <span className="shopping-detail-icon">{icon}</span>
          <span className="shopping-detail-title">{step?.text.replace(/:$/, "")}</span>
          <span className="shopping-detail-count">{pCount}/{items.length}</span>
          {view + 1 < steps.length && (
            <button className="shopping-next-btn" onClick={() => setView(view + 1)} aria-label="Следующая категория">
              <span>{categoryIcons[view + 1] ?? "📦"}</span>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                <path d="M5 2.5l4.5 4.5L5 11.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )}
        </div>
        <ul className="shopping-items">
          {items.map((item, ii) => {
            const subs = step?.itemSubgroups;
            const subgroup = subs?.[ii] ?? null;
            const showSub = subgroup && subgroup !== (subs?.[ii - 1] ?? null) && !isDupSubgroup(subgroup, name);
            const key = planKey(name, ii);
            const isPlanned = !!planned[key];
            const note = noteFor(key);
            const isEditing = editingNote?.key === key;
            return (
              <Fragment key={ii}>
                {showSub && <li className="shopping-subgroup-header">{subgroup}</li>}
                <li
                  role="checkbox"
                  aria-checked={isPlanned}
                  className={`shopping-item${isPlanned ? " shopping-item--done" : ""}`}
                >
                  <span className="shopping-checkbox" onClick={() => toggleItem(step, ii)}>
                    {isPlanned ? "✓" : ""}
                  </span>
                  <span
                    className="shopping-item-body"
                    onClick={() => isPlanned ? setEditingNote({ key, value: note }) : toggleItem(step, ii)}
                  >
                    <span className="shopping-item-label">{item}</span>
                    {isPlanned && (
                      isEditing ? (
                        <input
                          className="shopping-item-note-input"
                          autoFocus
                          value={editingNote.value}
                          onChange={(e) => setEditingNote({ key, value: e.target.value })}
                          onBlur={() => saveNote(key, editingNote.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }}
                          placeholder="Заметка..."
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span className={`shopping-item-note${note ? " shopping-item-note--set" : ""}`}>
                          {note || "+ заметка"}
                        </span>
                      )
                    )}
                  </span>
                  {!isPlanned && <span className="shopping-tap-hint">нажми</span>}
                </li>
              </Fragment>
            );
          })}
        </ul>
      </div>
    );
  }

  // ── History view ───────────────────────────────────────────────────────────
  if (view === "history") {
    return (
      <div className="session-body reading-body shopping-body">
        <div className="shopping-detail-header">
          <button className="shopping-back-btn" onClick={() => setView("grid")} aria-label="К категориям">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
              <rect x="2" y="2" width="7" height="7" rx="1.5" fill="currentColor"/>
              <rect x="11" y="2" width="7" height="7" rx="1.5" fill="currentColor"/>
              <rect x="2" y="11" width="7" height="7" rx="1.5" fill="currentColor"/>
              <rect x="11" y="11" width="7" height="7" rx="1.5" fill="currentColor"/>
            </svg>
          </button>
          <span className="shopping-detail-title">История списков</span>
        </div>
        <div className="shop-history-list">
          {history.length === 0 ? (
            <div className="shop-history-empty">История пока пуста</div>
          ) : history.map((entry) => (
            <div key={entry.id} className="shop-history-entry">
              <div className="shop-history-meta">
                <span className="shop-history-date">{entry.date}</span>
                {entry.store && <span className="shop-history-store">{entry.store}</span>}
                <span className="shop-history-count">{entry.count} {pluralItems(entry.count)}</span>
              </div>
              <button className="shop-history-restore" onClick={() => {
                setPlanned(entry.plan);
                saveShoppingPlan(topicId, entry.plan).catch(() => {});
                setView("grid");
              }}>Открыть</button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Preview / print view ──────────────────────────────────────────────────
  if (view === "preview") {
    const todayStr = formatTodayRu();
    const allItems = steps.flatMap((step) => {
      const name = sName(step);
      return (step.items ?? [])
        .map((item, ii) => {
          const key = planKey(name, ii);
          if (!planned[key]) return null;
          return {
            item,
            category: name,
            subgroup: step.itemSubgroups?.[ii] ?? null,
            note: noteFor(key),
          };
        })
        .filter(Boolean);
    });
    return (
      <div className="session-body reading-body shopping-body">
        <div className="shopping-preview-header">
          <button className="shopping-back-btn" onClick={() => setView("grid")} aria-label="К категориям">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
              <rect x="2" y="2" width="7" height="7" rx="1.5" fill="currentColor"/>
              <rect x="11" y="2" width="7" height="7" rx="1.5" fill="currentColor"/>
              <rect x="2" y="11" width="7" height="7" rx="1.5" fill="currentColor"/>
              <rect x="11" y="11" width="7" height="7" rx="1.5" fill="currentColor"/>
            </svg>
          </button>
          <span className="shopping-preview-title">Список покупок</span>
        </div>
        <div className="shopping-preview-content">
          <div className="shopping-print-header">
            {store && <div className="shopping-preview-store">для похода в {store}</div>}
            <div className="shopping-preview-date">{todayStr}</div>
          </div>
          <div className="shopping-preview-separator" />
          <ul className="shopping-preview-items">
            {allItems.map(({ item, category, subgroup, note }, i) => {
              const prevCat = allItems[i - 1]?.category ?? null;
              const prevSub = allItems[i - 1]?.subgroup ?? null;
              return (
                <Fragment key={i}>
                  {category && category !== prevCat && (
                    <li className="shopping-preview-category">{category}</li>
                  )}
                  {subgroup && subgroup !== prevSub && !isDupSubgroup(subgroup, category) && (
                    <li className="shopping-preview-subgroup">{subgroup}</li>
                  )}
                  <li className="shopping-preview-item">
                    ☐&nbsp;{item}
                    {note && <em className="shopping-preview-note">&nbsp;({note})</em>}
                  </li>
                </Fragment>
              );
            })}
          </ul>
        </div>
        <div className="shopping-actions">
          <button className="shopping-print-btn" onClick={() => printShoppingList(allItems, todayStr, store)}>
            🖨 Печать / PDF
          </button>
        </div>
      </div>
    );
  }

  // ── Grid view ──────────────────────────────────────────────────────────────
  return (
    <div className="session-body reading-body shopping-body">
      <div className="shopping-grid-header">
        <span>{totalPlanned > 0 ? `Выбрано: ${totalPlanned}` : "Что нужно купить?"}</span>
        <div className="shopping-grid-header-actions">
          <button className="shop-store-chip" onClick={onChangeStore} aria-label="Сменить магазин">
            {store || "🛒"}
          </button>
          {history.length > 0 && (
            <button className="shopping-clear-btn" onClick={() => setView("history")} aria-label="История списков">🕐</button>
          )}
          {totalPlanned > 0 && (
            <button className="shopping-clear-btn" onClick={() => setView("preview")} aria-label="Предпросмотр и печать">🖨</button>
          )}
          {totalPlanned > 0 && (
            <button className="shopping-clear-btn" onClick={() => setConfirmClear(true)} aria-label="Очистить список">🗑</button>
          )}
          {onExit && (
            <button className="shopping-exit-btn" onClick={onExit} aria-label="Выйти">✕</button>
          )}
        </div>
      </div>
      {sortMode ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={steps.map((s) => s.text)} strategy={rectSortingStrategy}>
            <div className="shopping-grid">
              {steps.map((step, si) => (
                <SortablePlanTile
                  key={step.text}
                  id={step.text}
                  icon={categoryIcons[si] ?? "📦"}
                  name={sName(step)}
                  count={plannedInStep(step)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="shopping-grid">
          {steps.map((step, si) => {
            const count = plannedInStep(step);
            const total = (step.items ?? []).length;
            const allDone = count === total && total > 0;
            const isPressing = pressingTile === si;
            return (
              <button
                key={step.id ?? si}
                className={`shopping-tile${allDone ? " shopping-tile--done" : count > 0 ? " shopping-tile--partial" : ""}${isPressing ? " shopping-tile--pressing" : ""}`}
                onClick={() => { if (!didLongPressRef.current) setView(si); }}
                onPointerDown={() => startLongPress(si)}
                onPointerUp={cancelLongPress}
                onPointerLeave={cancelLongPress}
                onPointerCancel={cancelLongPress}
              >
                <span className="shopping-tile-icon">{categoryIcons[si] ?? "📦"}</span>
                <span className="shopping-tile-name">{sName(step)}</span>
                {count > 0 && <span className="shopping-tile-badge">{count}</span>}
              </button>
            );
          })}
        </div>
      )}
      {confirmClear && (
        <div className="shopping-confirm-bar">
          <span className="shopping-confirm-text">Очистить весь список?</span>
          <div className="shopping-confirm-actions">
            <button className="shopping-confirm-cancel" onClick={() => setConfirmClear(false)}>Нет</button>
            <button className="shopping-confirm-ok" onClick={clearAll}>Да, очистить</button>
          </div>
        </div>
      )}
      <div className="shopping-actions">
        {sortMode ? (
          <>
            <button className="shopping-sort-done-btn" onClick={() => setSortMode(false)}>✓ Готово</button>
            <button className="shopping-sort-reset-btn" onClick={resetOrder}>Сбросить порядок</button>
          </>
        ) : totalPlanned > 0 ? (
          <button className="shop-go-btn" onClick={onGoToShop}>
            → В магазин ({totalPlanned})
          </button>
        ) : (
          <div className="shop-hint">Нажми на категорию, чтобы выбрать продукты</div>
        )}
      </div>
    </div>
  );
}

// ─── ShopMode ─────────────────────────────────────────────────────────────────

function ShopMode({ task, topicId, store, onGoToPlan, onExit }) {
  const [steps, setSteps] = useState([]);
  const [categoryIcons, setCategoryIcons] = useState([]);
  const [planned, setPlanned] = useState({});
  const [done, setDone] = useState({});
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    loadShoppingData(topicId, task).then(({ steps, categoryIcons, savedPlan }) => {
      setSteps(steps);
      setCategoryIcons(categoryIcons);
      setPlanned(savedPlan);
      setIsLoaded(true);
    });
  }, [topicId, task.text?.id, task.text?.file]);

  function toggleDone(step, ii) {
    const key = planKey(sName(step), ii);
    setDone((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const shoppingList = steps.map((step, si) => {
    const name = sName(step);
    const icon = categoryIcons[si] ?? "📦";
    const plannedItems = (step.items ?? [])
      .map((item, ii) => ({ item, ii, subgroup: step.itemSubgroups?.[ii] ?? null }))
      .filter(({ ii }) => planned[planKey(name, ii)]);
    return { step, name, icon, plannedItems };
  }).filter(({ plannedItems }) => plannedItems.length > 0);

  const totalPlanned = shoppingList.reduce((sum, { plannedItems }) => sum + plannedItems.length, 0);
  const totalDone = shoppingList.reduce((sum, { name, plannedItems }) =>
    sum + plannedItems.filter(({ ii }) => done[planKey(name, ii)]).length, 0);
  const allDone = totalPlanned > 0 && totalDone === totalPlanned;

  async function clearPlanAndGo() {
    if (Object.keys(planned).length > 0) {
      const now = new Date();
      const entry = {
        id: now.getTime(),
        date: formatHistoryDate(now),
        store: store ?? null,
        plan: { ...planned },
        count: Object.keys(planned).length,
      };
      try {
        const hist = await getShoppingHistory(topicId);
        await saveShoppingHistory(topicId, [entry, ...hist].slice(0, 5));
      } catch {}
    }
    saveShoppingPlan(topicId, {}).catch(() => {});
    setPlanned({});
    setDone({});
    onGoToPlan();
  }

  if (!isLoaded) return <div className="session-body reading-body shopping-body" />;

  // Empty state
  if (totalPlanned === 0) {
    return (
      <div className="session-body reading-body shopping-body shop-center">
        <div className="shop-state">
          <div className="shop-state__icon">🛒</div>
          <div className="shop-state__title">Список пуст</div>
          <div className="shop-state__hint">Сначала составь список покупок</div>
          <button className="shopping-view-btn" style={{ marginTop: 8 }} onClick={onGoToPlan}>
            ← Составить список
          </button>
        </div>
      </div>
    );
  }

  // Success state
  if (allDone) {
    return (
      <div className="session-body reading-body shopping-body shop-center">
        <div className="shop-state">
          <div className="shop-state__icon">🎉</div>
          <div className="shop-state__title">Всё куплено!</div>
          <div className="shop-state__hint">{totalPlanned} продуктов{store ? ` • ${store}` : ""}</div>
          <button className="shopping-view-btn" style={{ marginTop: 8 }} onClick={onGoToPlan}>
            ← К списку
          </button>
          <button className="shopping-view-btn" style={{ marginTop: 8, background: "#4caf90" }} onClick={clearPlanAndGo}>
            Начать новый список
          </button>
        </div>
      </div>
    );
  }

  const progress = totalPlanned > 0 ? (totalDone / totalPlanned) * 100 : 0;

  return (
    <div className="session-body reading-body shopping-body">
      <div className="shop-progress">
        <div className="shop-progress__bar">
          <div className="shop-progress__fill" style={{ width: `${progress}%` }} />
        </div>
        <span className="shop-progress__label">{totalDone} / {totalPlanned}</span>
        {store && <span className="shop-store-label">{store}</span>}
        {onExit && (
          <button className="shopping-exit-btn" onClick={onExit} aria-label="Выйти">✕</button>
        )}
      </div>

      <ul className="shopping-items">
        {shoppingList.map(({ step, name, icon, plannedItems }) => {
          const catDone = plannedItems.every(({ ii }) => done[planKey(name, ii)]);
          return (
            <Fragment key={name}>
              <li className={`shop-section-header${catDone ? " shop-section-header--done" : ""}`}>
                <span>{icon}</span>
                <span>{step.text.replace(/:$/, "")}</span>
                {catDone && <span className="shop-section-check"> ✓</span>}
              </li>
              {plannedItems.map(({ item, ii, subgroup }, idx) => {
                const prevSub = idx > 0 ? plannedItems[idx - 1].subgroup : null;
                const showSub = subgroup && subgroup !== prevSub && !isDupSubgroup(subgroup, name);
                const isDone = !!done[planKey(name, ii)];
                const noteVal = planned[planKey(name, ii)];
                const note = noteVal && typeof noteVal === "object" ? (noteVal.note ?? "") : "";
                return (
                  <Fragment key={`${name}_${ii}`}>
                    {showSub && <li className="shopping-subgroup-header">{subgroup}</li>}
                    <li
                      role="checkbox"
                      aria-checked={isDone}
                      className={`shopping-item${isDone ? " shopping-item--done" : ""}`}
                      onClick={() => toggleDone(step, ii)}
                    >
                      <span className="shopping-checkbox">{isDone ? "✓" : ""}</span>
                      <span className="shopping-item-body">
                        <span className="shopping-item-label">{item}</span>
                        {note && <span className="shopping-item-note shopping-item-note--set">{note}</span>}
                      </span>
                      {!isDone && <span className="shopping-tap-hint">взял</span>}
                    </li>
                  </Fragment>
                );
              })}
            </Fragment>
          );
        })}
      </ul>

      <div className="shopping-actions">
        <button className="shopping-view-btn" onClick={onGoToPlan}>
          ← К списку
        </button>
        <button className="shopping-close-btn" onClick={clearPlanAndGo}>
          Новый список
        </button>
      </div>
    </div>
  );
}

// ─── Main renderer ────────────────────────────────────────────────────────────

export default function ShoppingRenderer({ task, topicId, onExit }) {
  const [modeView, setModeView] = useState("loading"); // "loading" | "storePicker" | "plan" | "shop"
  const [stores, setStores] = useState(null); // { current: string|null, list: string[] }

  useEffect(() => {
    getShoppingStores(topicId).then((saved) => {
      const data = saved ?? { current: null, list: [...DEFAULT_STORES] };
      setStores(data);
      setModeView(data.current !== null ? "plan" : "storePicker");
    }).catch(() => {
      setStores({ current: null, list: [...DEFAULT_STORES] });
      setModeView("storePicker");
    });
  }, [topicId]);

  function persistStores(next) {
    setStores(next);
    saveShoppingStores(topicId, next).catch(() => {});
  }

  function handleStoreSelect(s) {
    persistStores({ ...stores, current: s });
    setModeView("plan");
  }

  function handleSaveList(list) {
    persistStores({ ...stores, list });
  }

  function handleChangeStore() { setModeView("storePicker"); }
  function switchToShop() { setModeView("shop"); }
  function switchToPlan() { setModeView("plan"); }

  if (modeView === "loading") return <div className="session-body reading-body shopping-body" />;

  if (modeView === "storePicker") return (
    <StorePicker
      storeList={stores?.list ?? DEFAULT_STORES}
      onSelect={handleStoreSelect}
      onSaveList={handleSaveList}
      onBack={stores?.current !== null ? switchToPlan : null}
    />
  );

  if (modeView === "plan") return (
    <PlanMode
      task={task} topicId={topicId}
      store={stores?.current}
      onGoToShop={switchToShop}
      onChangeStore={handleChangeStore}
      onExit={onExit}
    />
  );

  if (modeView === "shop") return (
    <ShopMode
      task={task} topicId={topicId}
      store={stores?.current}
      onGoToPlan={switchToPlan}
      onExit={onExit}
    />
  );

  return null;
}
