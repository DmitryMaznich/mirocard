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

// ─── helpers ────────────────────────────────────────────────────────────────

function sName(step) { return step.text.replace(/:$/, "").trim(); }
function planKey(name, ii) { return `${name}_${ii}`; }

async function loadShoppingData(topicId, task) {
  await pullRecipeKvFromServer().catch(() => {});
  const [raw, savedOrder, savedPlan] = await Promise.all([
    getRawRecipeTxt(topicId, task.text?.file).catch(() => null),
    getShoppingOrder(topicId).catch(() => null),
    getShoppingPlan(topicId).catch(() => ({})),
  ]);
  let rawSteps = raw
    ? parseRecipeTxt(raw).filter((s) => s.type === "checklist" || s.type === "action")
    : (task.text?.steps ?? []).filter((s) => s.type === "checklist" || s.type === "action");
  const rawIcons = task.text?.categoryIcons ?? [];
  const { steps, categoryIcons } = applyShoppingOrder(rawSteps, rawIcons, savedOrder);
  return { rawSteps, rawIcons, steps, categoryIcons, savedPlan: savedPlan ?? {} };
}

// ─── SortablePlanTile ────────────────────────────────────────────────────────

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
      className={`shop-tile${count > 0 ? " shop-tile--active" : ""} shop-tile--sortable${isDragging ? " shop-tile--dragging" : ""}`}
      {...attributes}
      {...listeners}
    >
      <span className="shop-tile-drag-handle">⠿</span>
      <span className="shop-tile-icon">{icon}</span>
      <span className="shop-tile-name">{name}</span>
      {count > 0 && <span className="shop-tile-badge">{count}</span>}
    </div>
  );
}

// ─── PlanMode ────────────────────────────────────────────────────────────────

function PlanMode({ task, topicId, onGoToShop }) {
  const [steps, setSteps] = useState([]);
  const [categoryIcons, setCategoryIcons] = useState([]);
  const [planned, setPlanned] = useState({});
  const [view, setView] = useState("grid"); // "grid" | number
  const [sortMode, setSortMode] = useState(false);
  const [pressingTile, setPressingTile] = useState(null);
  const rawStepsRef = useRef([]);
  const rawIconsRef = useRef([]);
  const longPressTimerRef = useRef(null);
  const didLongPressRef = useRef(false);

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
    const ni2 = arrayMove(categoryIcons, oi, ni);
    setSteps(ns);
    setCategoryIcons(ni2);
    saveShoppingOrder(topicId, ns.map((s) => sName(s))).catch(() => {});
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

  // ── Detail view ────────────────────────────────────────────
  if (typeof view === "number") {
    const step = steps[view];
    const items = step?.items ?? [];
    const name = sName(step);
    const icon = categoryIcons[view] ?? "📦";
    const pCount = plannedInStep(step);

    return (
      <div className="session-body shop-body">
        <div className="shop-detail-header">
          <button className="shop-back-btn" onClick={() => setView("grid")} aria-label="К категориям">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
              <rect x="2" y="2" width="7" height="7" rx="1.5" fill="currentColor"/>
              <rect x="11" y="2" width="7" height="7" rx="1.5" fill="currentColor"/>
              <rect x="2" y="11" width="7" height="7" rx="1.5" fill="currentColor"/>
              <rect x="11" y="11" width="7" height="7" rx="1.5" fill="currentColor"/>
            </svg>
          </button>
          <span className="shop-detail-icon">{icon}</span>
          <span className="shop-detail-title">{step?.text.replace(/:$/, "")}</span>
          <span className="shop-detail-count">{pCount}/{items.length}</span>
          {view + 1 < steps.length && (
            <button className="shop-next-btn" onClick={() => setView(view + 1)} aria-label="Следующая категория">
              <span>{categoryIcons[view + 1] ?? "📦"}</span>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                <path d="M5 2.5l4.5 4.5L5 11.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )}
        </div>
        <ul className="shop-items">
          {items.map((item, ii) => {
            const subs = step?.itemSubgroups;
            const subgroup = subs?.[ii] ?? null;
            const showSub = subgroup && subgroup !== (subs?.[ii - 1] ?? null);
            const isPlanned = !!planned[planKey(name, ii)];
            return (
              <Fragment key={ii}>
                {showSub && <li className="shop-subgroup-header">{subgroup}</li>}
                <li
                  role="checkbox"
                  aria-checked={isPlanned}
                  className={`shop-item${isPlanned ? " shop-item--planned" : ""}`}
                  onClick={() => toggleItem(step, ii)}
                >
                  <span className="shop-item-check">{isPlanned ? "✓" : ""}</span>
                  <span className="shop-item-label">{item}</span>
                </li>
              </Fragment>
            );
          })}
        </ul>
      </div>
    );
  }

  // ── Grid view ──────────────────────────────────────────────
  return (
    <div className="session-body shop-body">
      <div className="shop-grid-header">
        {totalPlanned > 0 ? `Выбрано: ${totalPlanned}` : "Что нужно купить?"}
      </div>
      {sortMode ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={steps.map((s) => s.text)} strategy={rectSortingStrategy}>
            <div className="shop-grid">
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
        <div className="shop-grid">
          {steps.map((step, si) => {
            const count = plannedInStep(step);
            const isPressing = pressingTile === si;
            return (
              <button
                key={step.id ?? si}
                className={`shop-tile${count > 0 ? " shop-tile--active" : ""}${isPressing ? " shop-tile--pressing" : ""}`}
                onClick={() => { if (!didLongPressRef.current) setView(si); }}
                onPointerDown={() => startLongPress(si)}
                onPointerUp={cancelLongPress}
                onPointerLeave={cancelLongPress}
                onPointerCancel={cancelLongPress}
              >
                <span className="shop-tile-icon">{categoryIcons[si] ?? "📦"}</span>
                <span className="shop-tile-name">{sName(step)}</span>
                {count > 0 && <span className="shop-tile-badge">{count}</span>}
              </button>
            );
          })}
        </div>
      )}
      <div className="shop-actions">
        {sortMode ? (
          <>
            <button className="shop-btn shop-btn--primary" onClick={() => setSortMode(false)}>✓ Готово</button>
            <button className="shop-btn shop-btn--ghost" onClick={resetOrder}>Сбросить порядок</button>
          </>
        ) : totalPlanned > 0 ? (
          <button className="shop-btn shop-btn--go" onClick={onGoToShop}>
            → В магазин ({totalPlanned})
          </button>
        ) : (
          <div className="shop-hint">Нажми на категорию, чтобы выбрать продукты</div>
        )}
      </div>
    </div>
  );
}

// ─── ShopMode ────────────────────────────────────────────────────────────────

function ShopMode({ task, topicId, onGoToPlan }) {
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

  if (!isLoaded) return <div className="session-body shop-body" />;

  if (totalPlanned === 0) {
    return (
      <div className="session-body shop-body shop-body--center">
        <div className="shop-empty">
          <div className="shop-empty-icon">🛒</div>
          <div className="shop-empty-title">Список пуст</div>
          <div className="shop-empty-hint">Сначала составь список покупок</div>
          <button className="shop-btn shop-btn--primary" onClick={onGoToPlan}>
            ← Составить список
          </button>
        </div>
      </div>
    );
  }

  if (allDone) {
    return (
      <div className="session-body shop-body shop-body--center">
        <div className="shop-success">
          <div className="shop-success-icon">🎉</div>
          <div className="shop-success-title">Всё куплено!</div>
          <div className="shop-success-count">{totalPlanned} продуктов</div>
          <button className="shop-btn shop-btn--primary" onClick={clearPlan}>
            Начать новый список
          </button>
        </div>
      </div>
    );
  }

  const progress = totalPlanned > 0 ? (totalDone / totalPlanned) * 100 : 0;

  return (
    <div className="session-body shop-body">
      <div className="shop-progress">
        <div className="shop-progress__bar">
          <div className="shop-progress__fill" style={{ width: `${progress}%` }} />
        </div>
        <span className="shop-progress__label">{totalDone} / {totalPlanned}</span>
      </div>

      <ul className="shop-list">
        {shoppingList.map(({ step, name, icon, plannedItems }) => {
          const catDone = plannedItems.every(({ ii }) => done[planKey(name, ii)]);
          return (
            <Fragment key={name}>
              <li className={`shop-section-header${catDone ? " shop-section-header--done" : ""}`}>
                <span className="shop-section-icon">{icon}</span>
                <span className="shop-section-name">{step.text.replace(/:$/, "")}</span>
                {catDone && <span className="shop-section-check">✓</span>}
              </li>
              {plannedItems.map(({ item, ii, subgroup }, idx) => {
                const prevSub = idx > 0 ? plannedItems[idx - 1].subgroup : null;
                const showSub = subgroup && subgroup !== prevSub;
                const isDone = !!done[planKey(name, ii)];
                return (
                  <Fragment key={`${name}_${ii}`}>
                    {showSub && <li className="shop-subgroup-header">{subgroup}</li>}
                    <li
                      role="checkbox"
                      aria-checked={isDone}
                      className={`shop-row${isDone ? " shop-row--done" : ""}`}
                      onClick={() => toggleDone(step, ii)}
                    >
                      <span className="shop-row-check">{isDone ? "✓" : ""}</span>
                      <span className="shop-row-label">{item}</span>
                    </li>
                  </Fragment>
                );
              })}
            </Fragment>
          );
        })}
      </ul>

      <div className="shop-actions">
        <button className="shop-btn shop-btn--ghost" onClick={clearPlan}>
          Новый список
        </button>
      </div>
    </div>
  );
}

// ─── Main renderer ────────────────────────────────────────────────────────────

export default function ShoppingRenderer({ task, topicId }) {
  const [modeView, setModeView] = useState(task?.type ?? "plan");
  const setActiveModeId = useAppStore((s) => s.setActiveModeId);

  function switchToShop() { setModeView("shop"); setActiveModeId("shop"); }
  function switchToPlan() { setModeView("plan"); setActiveModeId("plan"); }

  if (modeView === "plan") return <PlanMode task={task} topicId={topicId} onGoToShop={switchToShop} />;
  if (modeView === "shop") return <ShopMode task={task} topicId={topicId} onGoToPlan={switchToPlan} />;
  return null;
}
