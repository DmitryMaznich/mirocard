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
} from "@/core/groupStore";

// ─── helpers ─────────────────────────────────────────────────────────────────

function sName(step) { return step.text.replace(/:$/, "").trim(); }

const RU_DAYS   = ["воскресенье","понедельник","вторник","среда","четверг","пятница","суббота"];
const RU_MONTHS = ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];
function formatTodayRu() {
  const d = new Date();
  return `${d.getDate()} ${RU_MONTHS[d.getMonth()]}, ${RU_DAYS[d.getDay()]}`;
}

function printShoppingList(allItems, todayStr) {
  let listHtml = "";
  let prevSub = null;
  for (const { item, subgroup, note } of allItems) {
    if (subgroup && subgroup !== prevSub) {
      listHtml += `<li class="sub">${subgroup}</li>`;
    }
    listHtml += `<li class="item">&#9744;&nbsp;${item}${note ? ` <em>(${note})</em>` : ""}</li>`;
    prevSub = subgroup;
  }
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Список покупок</title><style>
@page{size:A4;margin:18mm 22mm}
body{font-family:Arial,Helvetica,sans-serif;margin:0;padding:0;color:#111}
h1{font-size:22pt;font-weight:900;text-transform:uppercase;margin:0 0 4pt}
.meta{font-size:12pt;color:#444;margin-bottom:2pt}
hr{border:none;border-top:1.5pt solid #bbb;margin:8pt 0}
ul{list-style:none;margin:0;padding:0}
li.sub{font-size:8pt;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#3a7a6a;padding:5pt 0 1pt 4pt;margin-top:3pt}
li.item{font-size:14pt;padding:3pt 0;line-height:1.45}
li.item em{font-size:11pt;color:#666}
</style></head><body>
<h1>Список покупок</h1>
<div class="meta">${todayStr}</div><hr>
<ul>${listHtml}</ul>
</body></html>`;
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;width:0;height:0;opacity:0;border:none";
  document.body.appendChild(iframe);
  iframe.contentDocument.open();
  iframe.contentDocument.write(html);
  iframe.contentDocument.close();
  iframe.contentWindow.focus();
  iframe.contentWindow.print();
  setTimeout(() => document.body.removeChild(iframe), 2000);
}
function planKey(name, ii) { return `${name}_${ii}`; }

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

function PlanMode({ task, topicId, onGoToShop, onExit }) {
  const [steps, setSteps] = useState([]);
  const [categoryIcons, setCategoryIcons] = useState([]);
  const [planned, setPlanned] = useState({});
  const [view, setView] = useState("grid"); // "grid" | number
  const [sortMode, setSortMode] = useState(false);
  const [pressingTile, setPressingTile] = useState(null);
  const [editingNote, setEditingNote] = useState(null); // { key, value } | null
  const rawStepsRef = useRef([]);
  const rawIconsRef = useRef([]);
  const longPressTimerRef = useRef(null);
  const didLongPressRef = useRef(false);

  function noteFor(key) {
    const v = planned[key];
    return v && typeof v === "object" ? (v.note ?? "") : "";
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
            const showSub = subgroup && subgroup !== (subs?.[ii - 1] ?? null);
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
            <div className="shopping-preview-date">{todayStr}</div>
          </div>
          <div className="shopping-preview-separator" />
          <ul className="shopping-preview-items">
            {allItems.map(({ item, subgroup, note }, i) => {
              const prevSub = allItems[i - 1]?.subgroup ?? null;
              return (
                <Fragment key={i}>
                  {subgroup && subgroup !== prevSub && (
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
          <button className="shopping-print-btn" onClick={() => printShoppingList(allItems, todayStr)}>
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
        {onExit && (
          <button className="shopping-exit-btn" onClick={onExit} aria-label="Выйти">✕</button>
        )}
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
      <div className="shopping-actions">
        {sortMode ? (
          <>
            <button className="shopping-sort-done-btn" onClick={() => setSortMode(false)}>✓ Готово</button>
            <button className="shopping-sort-reset-btn" onClick={resetOrder}>Сбросить порядок</button>
          </>
        ) : totalPlanned > 0 ? (
          <>
            <button className="shop-go-btn" onClick={onGoToShop}>
              → В магазин ({totalPlanned})
            </button>
            <button className="shopping-print-btn" onClick={() => setView("preview")}>
              🖨 Печать
            </button>
          </>
        ) : (
          <div className="shop-hint">Нажми на категорию, чтобы выбрать продукты</div>
        )}
      </div>
    </div>
  );
}

// ─── ShopMode ─────────────────────────────────────────────────────────────────

function ShopMode({ task, topicId, onGoToPlan, onExit }) {
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

  function clearPlan() {
    saveShoppingPlan(topicId, {}).catch(() => {});
    setPlanned({});
    setDone({});
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
          <div className="shop-state__hint">{totalPlanned} продуктов</div>
          <button className="shopping-view-btn" style={{ marginTop: 8, background: "#4caf90" }} onClick={clearPlan}>
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
                const showSub = subgroup && subgroup !== prevSub;
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
        <button className="shopping-close-btn" onClick={clearPlan}>
          Новый список
        </button>
      </div>
    </div>
  );
}

// ─── Main renderer ────────────────────────────────────────────────────────────

export default function ShoppingRenderer({ task, topicId, onExit }) {
  const [modeView, setModeView] = useState(task?.type ?? "plan");
  const setActiveModeId = useAppStore((s) => s.setActiveModeId);

  function switchToShop() { setModeView("shop"); setActiveModeId("shop"); }
  function switchToPlan() { setModeView("plan"); setActiveModeId("plan"); }

  if (modeView === "plan") return <PlanMode task={task} topicId={topicId} onGoToShop={switchToShop} onExit={onExit} />;
  if (modeView === "shop") return <ShopMode task={task} topicId={topicId} onGoToPlan={switchToPlan} onExit={onExit} />;
  return null;
}
