import { useState, useEffect, Fragment } from 'react';
import { useAppStore } from '@/core/store';
import { getRawRecipeTxt, getPlannerShopPlan, savePlannerShopPlan, getPlannerShopCustomData, savePlannerShopCustomData } from '@/core/groupStore';
import { loadPlan, PANTRY_ITEMS } from './plannerApi.js';
import { getPlanRecipes } from './plannerUtils.js';
import { generateShoppingList } from './shoppingListGenerator.js';
import { buildPlannerShoppingData, customDataToSteps } from './plannerShoppingUtils.js';
import { BackArrowIcon, ForwardArrowIcon } from '@/shared/components/ArrowIcons';
import './planner.css';

function sName(step) { return step.text.replace(/:$/, '').trim(); }
function planKey(name, ii) { return `${name}_${ii}`; }
function isDupSub(sub, cat) { return sub.replace(/^\S+\s+/, '').trim() === cat; }

function noteFor(planned, key) {
  const v = planned[key];
  return v && typeof v === 'object' ? (v.note ?? '') : '';
}

// ── Grid view ─────────────────────────────────────────────────────────────────

function PlanGrid({ steps, icons, planned, onDetail, onShop, onReset }) {
  const total = steps.reduce((s, step) => {
    const n = sName(step);
    return s + (step.items ?? []).filter((_, ii) => planned[planKey(n, ii)]).length;
  }, 0);

  return (
    <div className="shopping-body">
      <div className="shopping-grid-header">
        <span>{total > 0 ? `🛒 ${total} выбрано` : 'Что нужно купить?'}</span>
        <div className="shopping-grid-header-actions">
          <button className="shopping-clear-btn" onClick={onReset} title="Пересоставить из рецептов">⟳</button>
        </div>
      </div>
      <div className="shopping-grid">
        {steps.map((step, si) => {
          const n = sName(step);
          const count = (step.items ?? []).filter((_, ii) => planned[planKey(n, ii)]).length;
          const total = (step.items ?? []).length;
          const done = count === total && total > 0;
          return (
            <button
              key={si}
              className={`shopping-tile${done ? ' shopping-tile--done' : count > 0 ? ' shopping-tile--partial' : ''}`}
              onClick={() => onDetail(si)}
            >
              <span className="shopping-tile-icon">{icons[si] ?? '📦'}</span>
              <span className="shopping-tile-name">{n}</span>
              {count > 0 && <span className="shopping-tile-badge">{count}</span>}
            </button>
          );
        })}
      </div>
      <div className="shopping-actions">
        {total > 0
          ? <button className="shop-go-btn" onClick={onShop}><ForwardArrowIcon size={16} /> В магазин ({total})</button>
          : <div className="shop-hint">Нажми на категорию, чтобы выбрать продукты</div>
        }
      </div>
    </div>
  );
}

// ── Detail view ───────────────────────────────────────────────────────────────

function PlanDetail({ steps, icons, planned, idx, onToggle, onNote, onNext }) {
  const [editingNote, setEditingNote] = useState(null);
  const step = steps[idx];
  const items = step?.items ?? [];
  const name = sName(step);
  const pCount = items.filter((_, ii) => planned[planKey(name, ii)]).length;

  function saveNote(key, raw) {
    const note = raw.trim();
    onNote(key, note ? { note } : true);
    setEditingNote(null);
  }

  return (
    <div className="shopping-body">
      <div className="shopping-detail-header">
        <span className="shopping-detail-icon">{icons[idx] ?? '📦'}</span>
        <span className="shopping-detail-title">{step?.text.replace(/:$/, '')}</span>
        <span className="shopping-detail-count">{pCount}/{items.length}</span>
        {idx + 1 < steps.length && (
          <button className="shopping-next-btn" onClick={onNext}>
            <span>{icons[idx + 1] ?? '📦'}</span>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
              <path d="M5 2.5l4.5 4.5L5 11.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}
      </div>
      <ul className="shopping-items">
        {items.map((item, ii) => {
          const subs = step?.itemSubgroups;
          const sub = subs?.[ii] ?? null;
          const showSub = sub && sub !== (subs?.[ii - 1] ?? null) && !isDupSub(sub, name);
          const key = planKey(name, ii);
          const isPlanned = !!planned[key];
          const note = noteFor(planned, key);
          const isEditing = editingNote?.key === key;
          return (
            <Fragment key={ii}>
              {showSub && <li className="shopping-subgroup-header">{sub}</li>}
              <li role="checkbox" aria-checked={isPlanned}
                className={`shopping-item${isPlanned ? ' shopping-item--done' : ''}`}
              >
                <span className="shopping-checkbox" onClick={() => onToggle(step, ii)}>
                  {isPlanned ? '✓' : ''}
                </span>
                <span className="shopping-item-body"
                  onClick={() => isPlanned ? setEditingNote({ key, value: note }) : onToggle(step, ii)}
                >
                  <span className="shopping-item-label">{item}</span>
                  {isPlanned && (
                    isEditing ? (
                      <input
                        className="shopping-item-note-input" autoFocus
                        value={editingNote.value}
                        onChange={(e) => setEditingNote({ key, value: e.target.value })}
                        onBlur={() => saveNote(key, editingNote.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                        placeholder="Заметка…"
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span className={`shopping-item-note${note ? ' shopping-item-note--set' : ''}`}>
                        {note || '+ заметка'}
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

// ── Shop (in-store) view ──────────────────────────────────────────────────────

function ShopView({ steps, icons, planned, onBack }) {
  const [done, setDone] = useState({});

  const list = steps.map((step, si) => {
    const name = sName(step);
    const icon = icons[si] ?? '📦';
    const items = (step.items ?? [])
      .map((item, ii) => ({ item, ii, sub: step.itemSubgroups?.[ii] ?? null }))
      .filter(({ ii }) => planned[planKey(name, ii)]);
    return { step, name, icon, items };
  }).filter(({ items }) => items.length > 0);

  const total = list.reduce((s, { items }) => s + items.length, 0);
  const totalDone = list.reduce((s, { name, items }) =>
    s + items.filter(({ ii }) => done[planKey(name, ii)]).length, 0);
  const allDone = total > 0 && totalDone === total;
  const progress = total > 0 ? (totalDone / total) * 100 : 0;

  function toggle(step, ii) {
    const key = planKey(sName(step), ii);
    setDone((p) => ({ ...p, [key]: !p[key] }));
  }

  if (total === 0) return (
    <div className="shopping-body shop-center">
      <div className="shop-state">
        <div className="shop-state__icon">🛒</div>
        <div className="shop-state__title">Список пуст</div>
        <div className="shop-state__hint">Выбери продукты в списке покупок</div>
        <button className="shopping-view-btn" style={{ marginTop: 8 }} onClick={onBack}><BackArrowIcon size={16} /> Выбрать продукты</button>
      </div>
    </div>
  );

  if (allDone) return (
    <div className="shopping-body shop-center">
      <div className="shop-state">
        <div className="shop-state__icon">🎉</div>
        <div className="shop-state__title">Всё куплено!</div>
        <div className="shop-state__hint">{total} продуктов</div>
        <button className="shopping-view-btn" style={{ marginTop: 8 }} onClick={onBack}><BackArrowIcon size={16} /> К списку</button>
      </div>
    </div>
  );

  return (
    <div className="shopping-body">
      <div className="shop-progress">
        <div className="shop-progress__bar">
          <div className="shop-progress__fill" style={{ width: `${progress}%` }} />
        </div>
        <span className="shop-progress__label">{totalDone} / {total}</span>
      </div>
      <ul className="shopping-items">
        {list.map(({ step, name, icon, items }) => {
          const catDone = items.every(({ ii }) => done[planKey(name, ii)]);
          return (
            <Fragment key={name}>
              <li className={`shop-section-header${catDone ? ' shop-section-header--done' : ''}`}>
                <span>{icon}</span>
                <span>{step.text.replace(/:$/, '')}</span>
                {catDone && <span className="shop-section-check"> ✓</span>}
              </li>
              {items.map(({ item, ii, sub }, idx) => {
                const prevSub = idx > 0 ? items[idx - 1].sub : null;
                const showSub = sub && sub !== prevSub && !isDupSub(sub, name);
                const isDoneItem = !!done[planKey(name, ii)];
                const note = noteFor(planned, planKey(name, ii));
                return (
                  <Fragment key={`${name}_${ii}`}>
                    {showSub && <li className="shopping-subgroup-header">{sub}</li>}
                    <li role="checkbox" aria-checked={isDoneItem}
                      className={`shopping-item${isDoneItem ? ' shopping-item--done' : ''}`}
                      onClick={() => toggle(step, ii)}
                    >
                      <span className="shopping-checkbox">{isDoneItem ? '✓' : ''}</span>
                      <span className="shopping-item-body">
                        <span className="shopping-item-label">{item}</span>
                        {note && <span className="shopping-item-note shopping-item-note--set">{note}</span>}
                      </span>
                      {!isDoneItem && <span className="shopping-tap-hint">взял</span>}
                    </li>
                  </Fragment>
                );
              })}
            </Fragment>
          );
        })}
      </ul>
      <div className="shopping-actions">
        <button className="shopping-view-btn" onClick={onBack}><BackArrowIcon size={16} /> К списку</button>
      </div>
    </div>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function PlannerShoppingScreen() {
  const setScreen    = useAppStore((s) => s.setScreen);
  const studentId    = useAppStore((s) => s.activeStudentId);
  const topicRecords = useAppStore((s) => s.topicRecords);

  // view: 'grid' | number (detail idx) | 'shop'
  const [view, setView]    = useState('grid');
  const [loading, setLoading]   = useState(true);
  const [steps, setSteps]       = useState([]);
  const [icons, setIcons]       = useState([]);
  const [planned, setPlanned]   = useState({});
  const [confirmReset, setConfirmReset] = useState(false);

  async function loadAndApply(forceRegen = false) {
    setLoading(true);
    if (!forceRegen) {
      const [savedCustom, savedPlan] = await Promise.all([
        getPlannerShopCustomData(studentId),
        getPlannerShopPlan(studentId),
      ]);
      if (savedCustom) {
        setSteps(customDataToSteps(savedCustom));
        setIcons(savedCustom.categories.map((c) => c.icon));
        setPlanned(savedPlan ?? {});
        setLoading(false);
        return;
      }
    }

    // Generate from current meal plan
    const plan = await loadPlan(studentId);
    if (!plan) { setLoading(false); return; }

    const planRecipes = getPlanRecipes(plan);
    const recipesWithContent = await Promise.all(
      planRecipes.map(async ({ textId, portionMultiplier }) => {
        for (const record of topicRecords) {
          if (record.meta?.renderer !== 'reading') continue;
          const text = (record.texts ?? []).find((t) => t.id === textId);
          if (!text?.file) continue;
          const content = await getRawRecipeTxt(record.meta.id, text.file);
          if (content) return { textId, content, portionMultiplier };
        }
        return null;
      })
    );

    const items = generateShoppingList(recipesWithContent.filter(Boolean), PANTRY_ITEMS);
    const { customData, plan: newPlan } = buildPlannerShoppingData(items);

    await savePlannerShopCustomData(studentId, customData);
    await savePlannerShopPlan(studentId, newPlan);

    setSteps(customDataToSteps(customData));
    setIcons(customData.categories.map((c) => c.icon));
    setPlanned(newPlan);
    setLoading(false);
  }

  useEffect(() => {
    if (studentId) loadAndApply();
  }, [studentId]);

  function toggleItem(step, ii) {
    const key = planKey(sName(step), ii);
    setPlanned((prev) => {
      const next = { ...prev };
      if (next[key]) { delete next[key]; } else { next[key] = true; }
      savePlannerShopPlan(studentId, next).catch(() => {});
      return next;
    });
  }

  function saveNote(key, value) {
    setPlanned((prev) => {
      const next = { ...prev, [key]: value };
      savePlannerShopPlan(studentId, next).catch(() => {});
      return next;
    });
  }

  async function handleReset() {
    await savePlannerShopCustomData(studentId, null);
    await savePlannerShopPlan(studentId, {});
    setConfirmReset(false);
    setView('grid');
    loadAndApply(true);
  }

  function handleBack() {
    if (view === 'shop') { setView('grid'); return; }
    if (typeof view === 'number') { setView('grid'); return; }
    setScreen('planner_summary');
  }

  const headerTitle =
    view === 'shop' ? 'В магазине' :
    typeof view === 'number' ? null :
    'Список покупок';

  if (loading) return <div className="screen screen-center">Составляем список…</div>;

  return (
    <div className="screen planner-screen">
      <div className="planner-header">
        <button className="planner-header__back" onClick={handleBack}><BackArrowIcon size={22} /></button>
        {headerTitle && <h1 className="planner-header__title">{headerTitle}</h1>}
      </div>

      {view === 'shop' ? (
        <ShopView steps={steps} icons={icons} planned={planned} onBack={() => setView('grid')} />
      ) : typeof view === 'number' ? (
        <PlanDetail
          steps={steps} icons={icons} planned={planned}
          idx={view}
          onToggle={toggleItem}
          onNote={saveNote}
          onNext={() => setView(view + 1)}
        />
      ) : (
        <PlanGrid
          steps={steps} icons={icons} planned={planned}
          onDetail={setView}
          onShop={() => setView('shop')}
          onReset={() => setConfirmReset(true)}
        />
      )}

      {confirmReset && (
        <div className="shopping-confirm-bar">
          <span className="shopping-confirm-text">Пересоставить список из текущего меню? Изменения будут потеряны.</span>
          <div className="shopping-confirm-actions">
            <button className="shopping-confirm-cancel" onClick={() => setConfirmReset(false)}>Нет</button>
            <button className="shopping-confirm-ok" onClick={handleReset}>Да</button>
          </div>
        </div>
      )}
    </div>
  );
}
