# Меню-first Planner flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Меню the Planner's single entry point — four meal-slot questions (Завтрак/Обед/Ужин/Перекус) each opening a recipe picker that auto-assigns on add — retiring the standalone "Рецепты" hub card and its free-standing recipe browser.

**Architecture:** No data-model changes — `plan.selectedRecipes`/`mealAssignments`/`selectedPortions`/`ingredientDecisions` are untouched. `PlannerMenuScreen.jsx`'s three-view model (`'recipes' | 'plan' | 'detail'`) becomes (`'menu' | 'picker' | 'detail'`): `'menu'` is the one landing page (four `MealSlotSection`s + the existing ingredients/reset/send/shopping-CTA footer), `'picker'` is today's recipe browser repurposed to open for one target meal type and auto-assign on add, `'detail'` is unchanged. The hub drops its "Рецепты" card and always keeps "Меню" unlocked.

**Tech Stack:** React 19 (function components + hooks) — this is a screen-restructuring task with no new pure logic, so it's verified manually per this codebase's existing convention for screen components (no dedicated component tests exist for `PlannerMenuScreen.jsx` or `HomeScreen.jsx` today).

## Global Constraints

- All four meal types (Завтрак, Обед, Ужин, Перекус) are equal question blocks — no special-casing Перекус. Напитки stays a browsing-only tag inside the picker, not a fifth slot.
- A meal slot can hold any number of recipes (soup + salad for lunch, several breakfast options, etc.) — unchanged from today's data model, which already lets multiple recipes share one `mealAssignments` value.
- Adding a recipe from a slot's picker auto-assigns it to that slot's meal type immediately — no separate tagging step.
- A recipe already assigned to a *different* meal, shown in another slot's picker, displays a small "already: {meal}" badge; tapping it there re-assigns (moves) it to the current slot. This is the only reassignment mechanism.
- The picker's target meal type is fixed to whichever slot opened it, even if the user switches the tag-filter tabs inside the picker to browse a different category — filtering and the add-target are independent (see Task 1 for the concrete resolution of the "which tab, which target" question left open by the spec).
- Full spec: `docs/superpowers/specs/2026-07-04-menu-first-flow-design.md`.

---

## Task 1: Restructure `PlannerMenuScreen.jsx` around meal slots

**Files:**
- Modify: `src/features/planner/PlannerMenuScreen.jsx` (full-file replacement — the view model, every screen-level component, and the wiring between them all change together; see rationale below)
- Modify: `src/features/planner/planner.css` (two new classes)

**Interfaces:**
- Consumes: `createPlan, isRecipeSelected, selectRecipe, deselectRecipe, resetPlan, setMealAssignment, setSelectedPortions, setIngredientDecision, buildSelectedIngredientsSummary, isMenuFullyDecided, MEAL_TYPES, RECIPE_TAGS` (all already exported from `plannerUtils.js`, unchanged), `loadPlan, savePlan, sendPlanToStudent, loadAllRecipes, resetShoppingData` (all already exported from `plannerApi.js`, unchanged).
- Produces: nothing new is exported — this is a default-export screen component. Its behavior (what it renders for the `planner_menu` screen key) is what Task 2 relies on when simplifying the hub's Меню card.

**Why a full-file replacement instead of incremental diffs:** the view model itself changes (`'recipes' | 'plan' | 'detail'` → `'menu' | 'picker' | 'detail'`), and nearly every component in the file (`RecipeBrowser` → `RecipePicker`, `SelectedPool` → `MealSlotSection` ×4, `PlanView` → `MenuLandingView`, `RecipeCard`'s selection prop) changes shape together. Presenting this as a sequence of small edits against a file whose structure is simultaneously changing underneath them would be more error-prone than replacing the whole file once against a clearly-specified target state.

- [ ] **Step 1: Replace the entire file**

Replace the full contents of `src/features/planner/PlannerMenuScreen.jsx` with:

```jsx
import { useEffect, useState } from 'react';
import { useAppStore } from '@/core/store';
import { getTopicTitle } from '@/shared/utils/format';
import { useTopicFile } from '@/shared/hooks/useTopicFile';
import { BackArrowIcon, ForwardArrowIcon } from '@/shared/components/ArrowIcons';
import {
  createPlan, isRecipeSelected, selectRecipe, deselectRecipe, resetPlan,
  setMealAssignment, setSelectedPortions,
  setIngredientDecision, buildSelectedIngredientsSummary, isMenuFullyDecided,
  MEAL_TYPES, RECIPE_TAGS,
} from './plannerUtils.js';
import { loadPlan, savePlan, sendPlanToStudent, loadAllRecipes, resetShoppingData, PANTRY_ITEMS } from './plannerApi.js';
import './planner.css';

const MEAL_ICONS = { завтрак: '🌅', обед: '☀️', ужин: '🌙', перекус: '🍎', напитки: '🥤' };

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function pluralizePortions(n) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'порция';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'порции';
  return 'порций';
}

function keyIngredients(ingredients) {
  return ingredients
    .filter((i) => i.product && !PANTRY_ITEMS.has(i.product))
    .slice(0, 3)
    .map((i) => i.product)
    .join(', ');
}

// ─── Recipe ingredients (what you need, no step-by-step) ─────────────────────

function RecipeIngredients({ recipe, plan, onToggleSelect, onBack }) {
  const { topicId, text, ingredients, portions, fixedPortions } = recipe;
  const coverUrl = useTopicFile(topicId, text.photo);
  const selected = isRecipeSelected(plan, text.id);
  const basePortions = fixedPortions || portions || 1;

  return (
    <div className="screen planner-screen">
      <div className="planner-header">
        <button className="planner-header__back" onClick={onBack}><BackArrowIcon size={22} /></button>
        <h1 className="planner-header__title">{getTopicTitle(text.title)}</h1>
      </div>

      <div className="recipe-detail-body">
        {coverUrl && <img src={coverUrl} alt="" className="recipe-detail-cover" />}
        {selected && (
          <div className="recipe-detail-hint">Отобрано в меню</div>
        )}
        <div className="recipe-ingredients">
          <span className="recipe-ingredients__meta">
            {fixedPortions ? '🔒 готовится сразу на ' : 'На '}
            {basePortions} {pluralizePortions(basePortions)}
          </span>
          <ul className="recipe-ingredients__list">
            {ingredients.map((ing, i) => (
              <li key={i} className="recipe-ingredients__item">
                <span className="recipe-ingredients__product">{ing.product}</span>
                <span className="recipe-ingredients__qty">
                  {ing.qty != null ? `${ing.qty} ${ing.unit ?? ''}`.trim() : 'по вкусу'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="planner-footer">
        <button className="recipe-detail-add" onClick={onToggleSelect}>
          {selected ? '✓ Убрать из меню' : '+ Добавить в меню'}
        </button>
      </div>
    </div>
  );
}

// ─── Recipe card (tap to view, or select for a meal slot) ────────────────────

function PlayIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M4.5 3.2v9.6c0 .7.76 1.13 1.36.76l7.5-4.8a.9.9 0 0 0 0-1.52l-7.5-4.8c-.6-.37-1.36.06-1.36.76Z" fill="currentColor" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M3 4.5h10M6.5 4.5V3a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1.5M6.5 7.5v4M9.5 7.5v4M4 4.5l.6 8a1.5 1.5 0 0 0 1.5 1.4h3.8a1.5 1.5 0 0 0 1.5-1.4l.6-8"
        stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function RecipeCard({ recipe, isHere, otherMeal, onView, onCook, onToggleSelect }) {
  const { topicId, text, ingredients, status } = recipe;
  const photoUrl = useTopicFile(topicId, text.photo);

  return (
    <div className="recipe-gallery-card">
      <button className="recipe-gallery-card__view" onClick={onView}>
        <span className="recipe-gallery-card__photo-btn">
          {photoUrl
            ? <img src={photoUrl} alt="" className="recipe-gallery-card__photo" />
            : <span className="recipe-gallery-card__photo-placeholder" />
          }
          <span className={`recipe-gallery-card__status recipe-gallery-card__status--${status}`}>
            {status === 'final' ? 'Финал' : 'Черновик'}
          </span>
          {isHere && <span className="recipe-gallery-card__badge">✓</span>}
          {otherMeal && <span className="recipe-gallery-card__badge recipe-gallery-card__badge--other">{otherMeal}</span>}
        </span>
        <span className="recipe-gallery-card__info">
          <span className="recipe-gallery-card__title">{getTopicTitle(text.title)}</span>
          <span className="recipe-gallery-card__ingr">{keyIngredients(ingredients)}</span>
        </span>
      </button>

      <div className="recipe-gallery-card__add-row">
        <button
          type="button"
          className="recipe-gallery-card__cook-btn"
          onClick={() => onCook(recipe)}
          aria-label="Готовить по шагам"
        >
          <PlayIcon />
        </button>
        <button
          type="button"
          className={`recipe-gallery-card__add-btn${isHere ? ' recipe-gallery-card__add-btn--active' : ''}`}
          onClick={onToggleSelect}
        >
          {isHere ? '✓ В меню' : otherMeal ? `Перенести из «${otherMeal}»` : '+ Добавить'}
        </button>
      </div>
    </div>
  );
}

// ─── Portions prompt (asked once, when a recipe is first added) ─────────────

function PortionsPromptSheet({ recipe, onConfirm, onClose }) {
  const { portions: basePortions, maxPortions } = recipe;
  const [portions, setPortions] = useState(basePortions || 1);

  return (
    <div className="portions-sheet-backdrop" onClick={onClose}>
      <div className="portions-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="portions-sheet__handle" />
        <h2 className="portions-sheet__title">{getTopicTitle(recipe.text.title)}</h2>
        <p className="portions-sheet__label">Сколько порций планируете?</p>
        <div className="portions-sheet__stepper">
          <button
            type="button"
            disabled={portions <= 1}
            onClick={() => setPortions((p) => Math.max(1, p - 1))}
            aria-label="Меньше порций"
          >
            −
          </button>
          <span className="portions-sheet__value">{portions} {pluralizePortions(portions)}</span>
          <button
            type="button"
            disabled={portions >= maxPortions}
            onClick={() => setPortions((p) => Math.min(maxPortions, p + 1))}
            aria-label="Больше порций"
          >
            +
          </button>
        </div>
        <div className="portions-sheet__actions">
          <button type="button" className="portions-sheet__cancel" onClick={onClose}>
            Отменить
          </button>
          <button type="button" className="portions-sheet__confirm" onClick={() => onConfirm(portions)}>
            Добавить в меню
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Recipe picker (category tabs + grid, opened for one meal slot) ─────────

const TAB_ALL = 'all';

function RecipePicker({ plan, allRecipes, loading, targetMealType, onView, onCook, onBack, onToggleSelect }) {
  const [activeTab, setActiveTab] = useState(targetMealType);
  const filtered = activeTab === TAB_ALL ? allRecipes : allRecipes.filter((r) => r.tags.includes(activeTab));

  return (
    <div className="screen planner-screen">
      <div className="planner-header">
        <button className="planner-header__back" onClick={onBack}><BackArrowIcon size={22} /></button>
        <h1 className="planner-header__title">{MEAL_ICONS[targetMealType]} {capitalize(targetMealType)}</h1>
      </div>

      <div className="gallery-meal-tabs">
        <button
          className={`gallery-meal-tab${activeTab === TAB_ALL ? ' gallery-meal-tab--active' : ''}`}
          onClick={() => setActiveTab(TAB_ALL)}
        >
          Все
        </button>
        {RECIPE_TAGS.map((mt) => (
          <button
            key={mt}
            className={`gallery-meal-tab${activeTab === mt ? ' gallery-meal-tab--active' : ''}`}
            onClick={() => setActiveTab(mt)}
          >
            {MEAL_ICONS[mt]} {mt}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="planner-loading">Загружаем рецепты…</div>
      ) : filtered.length === 0 ? (
        <div className="gallery-empty">
          {activeTab === TAB_ALL ? 'Рецептов пока нет' : `Нет рецептов для «${activeTab}»`}
        </div>
      ) : (
        <div className="recipe-gallery-grid">
          {filtered.map((recipe) => {
            const assigned = plan.mealAssignments[recipe.text.id] ?? null;
            const isHere = isRecipeSelected(plan, recipe.text.id) && assigned === targetMealType;
            const otherMeal = isRecipeSelected(plan, recipe.text.id) && assigned && assigned !== targetMealType ? assigned : null;
            return (
              <RecipeCard
                key={`${recipe.topicId}_${recipe.text.id}`}
                recipe={recipe}
                isHere={isHere}
                otherMeal={otherMeal}
                onView={() => onView(recipe)}
                onCook={onCook}
                onToggleSelect={() => onToggleSelect(recipe, targetMealType)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Meal slot section (one of the four question blocks) ────────────────────

function MealSlotSection({ mealType, plan, allRecipes, onSetPortions, onDeselect, onViewRecipe, onOpenPicker }) {
  const recipesHere = plan.selectedRecipes.filter((textId) => plan.mealAssignments[textId] === mealType);

  return (
    <div className="menu-pool">
      <h2 className="menu-pool__title">{MEAL_ICONS[mealType]} {capitalize(mealType)}</h2>
      {recipesHere.length > 0 && (
        <div className="menu-pool__list">
          {recipesHere.map((textId) => {
            const recipe = allRecipes.find((r) => r.text.id === textId);
            if (!recipe) return null;
            const { fixedPortions, portions: basePortions, maxPortions } = recipe;
            const chosenPortions = fixedPortions || plan.selectedPortions[textId] || basePortions || 1;
            return (
              <div key={textId} className="menu-pool__row">
                <div className="menu-pool__row-top">
                  <button className="menu-pool__name" onClick={() => onViewRecipe(recipe, mealType)}>
                    <span className="menu-pool__title-text">{getTopicTitle(recipe.text.title)}</span>
                  </button>
                  {fixedPortions ? (
                    <span className="menu-pool__fixed">🔒 {fixedPortions}</span>
                  ) : (
                    <div className="menu-pool__stepper">
                      <button
                        type="button"
                        disabled={chosenPortions <= 1}
                        onClick={() => onSetPortions(textId, Math.max(1, chosenPortions - 1))}
                        aria-label="Меньше порций"
                      >
                        −
                      </button>
                      <span className="menu-pool__stepper-value">{chosenPortions}</span>
                      <button
                        type="button"
                        disabled={chosenPortions >= maxPortions}
                        onClick={() => onSetPortions(textId, Math.min(maxPortions, chosenPortions + 1))}
                        aria-label="Больше порций"
                      >
                        +
                      </button>
                    </div>
                  )}
                  <button type="button" className="menu-pool__remove" onClick={() => onDeselect(textId)} aria-label="Убрать">
                    <TrashIcon />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <button type="button" className="menu-slot-add-btn" onClick={() => onOpenPicker(mealType)}>
        + Добавить рецепт
      </button>
    </div>
  );
}

// ─── Ingredients summary (all selected recipes, merged) ──────────────────────

function IngredientTriToggle({ value, onChange }) {
  return (
    <div className="ingr-toggle">
      <button
        type="button"
        className={`ingr-toggle__btn ingr-toggle__btn--have${value === 'have' ? ' ingr-toggle__btn--active' : ''}`}
        onClick={() => onChange(value === 'have' ? null : 'have')}
      >
        Есть дома
      </button>
      <span className="ingr-toggle__mid" aria-hidden="true" />
      <button
        type="button"
        className={`ingr-toggle__btn ingr-toggle__btn--buy${value === 'buy' ? ' ingr-toggle__btn--active' : ''}`}
        onClick={() => onChange(value === 'buy' ? null : 'buy')}
      >
        Надо купить
      </button>
    </div>
  );
}

function MenuIngredientsSummary({ plan, allRecipes, onSetDecision }) {
  if (plan.selectedRecipes.length === 0) return null;

  const items = buildSelectedIngredientsSummary(plan, allRecipes)
    .slice()
    .sort((a, b) => a.product.localeCompare(b.product, 'ru'));

  if (items.length === 0) return null;

  return (
    <div className="menu-ingredients">
      <h2 className="menu-ingredients__title">Ингредиенты</h2>
      <div className="menu-ingredients__list">
        {items.map((item) => {
          const key = item.product.toLowerCase();
          return (
            <div key={key} className="menu-ingr-row">
              <span className="menu-ingr-row__product">{item.product}</span>
              <span className="menu-ingr-row__qty">
                {item.qty != null ? `${Math.round(item.qty * 10) / 10} ${item.unit ?? ''}`.trim() : 'по вкусу'}
              </span>
              <IngredientTriToggle
                value={plan.ingredientDecisions[key] ?? null}
                onChange={(decision) => onSetDecision(item.product, decision)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Menu landing view (the one Меню page: slots + ingredients + footer) ────

function MenuLandingView({ plan, allRecipes, onSetPortions, onDeselect, onViewRecipe, onOpenPicker, onSetIngredientDecision, onReset, onBack, onGoShopping, onSendToStudent }) {
  const [confirmReset, setConfirmReset] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState(null);

  async function handleSend() {
    setSending(true);
    setSendError(null);
    try {
      await onSendToStudent();
      setSent(true);
    } catch (err) {
      setSendError(err?.message ?? 'Ошибка отправки');
    } finally {
      setSending(false);
    }
  }

  // The transition to Покупки is gated: every ingredient must have an
  // explicit Дома/Купить decision first (see MenuIngredientsSummary) —
  // no silent defaults, and nothing to buy if the pool is empty.
  const ingredientItems = buildSelectedIngredientsSummary(plan, allRecipes);
  const allDecided = isMenuFullyDecided(plan, allRecipes);

  return (
    <div className="screen planner-screen">
      <div className="planner-header">
        <button className="planner-header__back" onClick={onBack}><BackArrowIcon size={22} /></button>
        <h1 className="planner-header__title">Меню</h1>
      </div>

      <div className="planner-body">
        {MEAL_TYPES.map((mealType) => (
          <MealSlotSection
            key={mealType}
            mealType={mealType}
            plan={plan}
            allRecipes={allRecipes}
            onSetPortions={onSetPortions}
            onDeselect={onDeselect}
            onViewRecipe={onViewRecipe}
            onOpenPicker={onOpenPicker}
          />
        ))}
        <MenuIngredientsSummary
          plan={plan}
          allRecipes={allRecipes}
          onSetDecision={onSetIngredientDecision}
        />
        <button type="button" className="menu-reset-link" onClick={() => setConfirmReset(true)}>
          Начать меню заново
        </button>
        {sendError && <div className="menu-send-error">{sendError}</div>}
        {sent ? (
          <div className="menu-send-link menu-send-link--sent">✓ Отправлено ученику</div>
        ) : (
          <button type="button" className="menu-send-link" disabled={sending} onClick={handleSend}>
            {sending ? 'Отправляем…' : 'Отправить меню ученику ↗'}
          </button>
        )}
      </div>

      <div className="planner-footer">
        <button
          type="button"
          className="menu-shopping-btn"
          disabled={!allDecided}
          onClick={onGoShopping}
        >
          Список покупок <ForwardArrowIcon size={16} />
        </button>
        {!allDecided && (
          <div className="menu-shopping-hint">
            {ingredientItems.length === 0
              ? 'Сначала выбери рецепты'
              : 'Отметь «Дома» или «Купить» для каждого продукта'}
          </div>
        )}
      </div>

      {confirmReset && (
        <div className="menu-reset-bar">
          <span className="menu-reset-bar__text">Точно начать заново? Всё меню будет удалено.</span>
          <div className="menu-reset-bar__actions">
            <button type="button" className="menu-reset-bar__cancel" onClick={() => setConfirmReset(false)}>Нет</button>
            <button type="button" className="menu-reset-bar__ok" onClick={() => { setConfirmReset(false); onReset(); }}>Да</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── PlannerMenuScreen ────────────────────────────────────────────────────────

export default function PlannerMenuScreen() {
  const setScreen = useAppStore((s) => s.setScreen);
  const activeStudentId = useAppStore((s) => s.activeStudentId);
  const topicRecords = useAppStore((s) => s.topicRecords);
  const setActiveTopicId = useAppStore((s) => s.setActiveTopicId);
  const setActiveText = useAppStore((s) => s.setActiveText);
  const setActiveModeId = useAppStore((s) => s.setActiveModeId);
  const setSessionReturnScreen = useAppStore((s) => s.setSessionReturnScreen);

  const [plan, setPlan] = useState(null);
  const [allRecipes, setAllRecipes] = useState([]);
  const [loadingRecipes, setLoadingRecipes] = useState(false);

  // view: 'menu' | 'picker' | 'detail'
  const [view, setView] = useState('menu');
  const [pickerMealType, setPickerMealType] = useState(null);
  const [detailRecipe, setDetailRecipe] = useState(null);
  const [detailPrev, setDetailPrev] = useState('menu');
  const [detailMealType, setDetailMealType] = useState(null);
  // Recipe (+ the meal slot it's being added for) currently awaiting a
  // portions choice before it's added — set only when adding (never when
  // removing) and only for recipes where portions is an actual choice (not
  // fixed_portions).
  const [portionsPrompt, setPortionsPrompt] = useState(null);

  // Load saved plan
  useEffect(() => {
    if (!activeStudentId) return;
    loadPlan(activeStudentId).then((saved) => {
      setPlan(saved ?? createPlan(activeStudentId));
    });
  }, [activeStudentId]);

  // Persist on every change (skips the initial null -> plan transition's redundant write only in that it's harmless either way)
  useEffect(() => {
    if (plan) savePlan(plan);
  }, [plan]);

  // Load all recipes with metadata once
  useEffect(() => {
    if (!topicRecords.length) return;
    let cancelled = false;
    async function load() {
      setLoadingRecipes(true);
      const all = await loadAllRecipes(topicRecords);
      if (!cancelled) { setAllRecipes(all); setLoadingRecipes(false); }
    }
    load();
    return () => { cancelled = true; };
  }, [topicRecords]);

  function openPicker(mealType) {
    setPickerMealType(mealType);
    setView('picker');
  }

  function openDetail(recipe, from, mealType) {
    setDetailRecipe(recipe);
    setDetailPrev(from);
    setDetailMealType(mealType);
    setView('detail');
  }

  // Removing needs no prompt. Adding a fixed_portions recipe has nothing to
  // choose (the batch size is inherent to the dish), so it's added
  // immediately too. Everything else asks for portions first, so the count
  // is always something the user actually chose — never a silent default
  // that happens to equal the recipe's own base serving size.
  //
  // A recipe already selected for a *different* meal type re-assigns
  // (moves) instead of being removed — this is how the picker's "already:
  // X" badge becomes an actual reassignment when tapped from another slot.
  function handleToggleSelect(recipe, mealType) {
    if (isRecipeSelected(plan, recipe.text.id)) {
      if (mealType && plan.mealAssignments[recipe.text.id] !== mealType) {
        setPlan((p) => setMealAssignment(p, recipe.text.id, mealType));
        return;
      }
      setPlan((p) => deselectRecipe(p, recipe.text.id));
      return;
    }
    if (recipe.fixedPortions) {
      setPlan((p) => setMealAssignment(selectRecipe(p, recipe.text.id), recipe.text.id, mealType));
      return;
    }
    setPortionsPrompt({ recipe, mealType });
  }

  function handleConfirmPortions(portions) {
    const { recipe, mealType } = portionsPrompt;
    setPlan((p) => setMealAssignment(
      setSelectedPortions(selectRecipe(p, recipe.text.id), recipe.text.id, portions),
      recipe.text.id,
      mealType
    ));
    setPortionsPrompt(null);
  }

  function handleCook(recipe) {
    setActiveTopicId(recipe.topicId);
    setActiveText(recipe.text);
    setActiveModeId('follow_instruction');
    setSessionReturnScreen('planner_menu');
    setScreen('params');
  }

  if (!plan) return <div className="screen screen-center">Загрузка…</div>;

  let content;
  if (view === 'detail' && detailRecipe) {
    content = (
      <RecipeIngredients
        recipe={detailRecipe}
        plan={plan}
        onToggleSelect={() => handleToggleSelect(detailRecipe, detailMealType)}
        onBack={() => setView(detailPrev)}
      />
    );
  } else if (view === 'picker') {
    content = (
      <RecipePicker
        plan={plan}
        allRecipes={allRecipes}
        loading={loadingRecipes}
        targetMealType={pickerMealType}
        onView={(recipe) => openDetail(recipe, 'picker', pickerMealType)}
        onCook={handleCook}
        onBack={() => setView('menu')}
        onToggleSelect={handleToggleSelect}
      />
    );
  } else {
    content = (
      <MenuLandingView
        plan={plan}
        allRecipes={allRecipes}
        onSetPortions={(textId, portions) =>
          setPlan((p) => setSelectedPortions(p, textId, portions))
        }
        onDeselect={(textId) => setPlan((p) => deselectRecipe(p, textId))}
        onViewRecipe={(recipe, mealType) => openDetail(recipe, 'menu', mealType)}
        onOpenPicker={openPicker}
        onSetIngredientDecision={(product, decision) =>
          setPlan((p) => setIngredientDecision(p, product, decision))
        }
        onReset={() => {
          setPlan(resetPlan(activeStudentId));
          resetShoppingData(activeStudentId).catch(() => {});
        }}
        onBack={() => setScreen('home')}
        onGoShopping={() => setScreen('planner_shopping')}
        onSendToStudent={() => sendPlanToStudent(activeStudentId, plan)}
      />
    );
  }

  return (
    <>
      {content}
      {portionsPrompt && (
        <PortionsPromptSheet
          recipe={portionsPrompt.recipe}
          onConfirm={handleConfirmPortions}
          onClose={() => setPortionsPrompt(null)}
        />
      )}
    </>
  );
}
```

- [ ] **Step 2: Add the two new CSS classes**

Append to the end of `src/features/planner/planner.css`:

```css
/* ── Menu slot "add recipe" button (MealSlotSection) ───────────────── */
.menu-slot-add-btn {
  width: 100%;
  margin-top: 8px;
  padding: 10px;
  border-radius: 12px;
  border: 1.5px dashed #4a9b8f;
  background: none;
  color: #2f5b57;
  font-size: 13px;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
}

/* ── "Already assigned to another meal" badge (RecipeCard in the picker) ── */
.recipe-gallery-card__badge--other {
  background: #d68910;
  font-size: 10px;
  padding: 0 6px;
  white-space: nowrap;
}
```

- [ ] **Step 3: Run the full test suite**

Run: `npx vitest run src/features/planner`
Expected: all planner tests pass (this task only touches a screen component and CSS — `plannerUtils.js`/`plannerApi.js`/`plannerShoppingUtils.js` and their tests are untouched, so this confirms nothing broke by accident).

- [ ] **Step 4: Run lint**

Run: `npx eslint src/features/planner/PlannerMenuScreen.jsx`
Expected: no errors. (The old file had none either, so any error here is new and must be fixed before moving on.)

- [ ] **Step 5: Manual verification**

Using the `run` skill: open Меню directly (via the hub, still showing 4 cards at this point since Task 2 hasn't landed yet) and confirm it lands on the new slot-based page with four sections (Завтрак/Обед/Ужин/Перекус), each with a "+ Добавить рецепт" button. Tap it under Завтрак — confirm the picker opens with the Завтрак tab active. Add a recipe (through the portions prompt if it has one) — confirm it appears back on the Меню page under Завтрак immediately, no separate tagging step. Open the Обед picker and find that same recipe (switch its tab filter to "Завтрак" or "Все" to see it) — confirm it shows a "Перенести из «завтрак»" button; tap it — confirm the recipe now appears under Обед and is gone from Завтрак. Confirm the portions stepper, remove button, ingredients Дома/Купить section, reset link (and its confirmation bar), the minimized send-to-student link, and the "Список покупок" gate/CTA all still work exactly as before. Confirm recipe detail view (tap a card's photo/title) still opens and its add/remove button still works.

- [ ] **Step 6: Commit**

```bash
git add src/features/planner/PlannerMenuScreen.jsx src/features/planner/planner.css
git commit -m "feat(planner): restructure Меню around four meal-slot pickers, retiring the standalone recipe browser view"
```

---

## Task 2: Simplify the Planner hub to 3 cards

**Files:**
- Modify: `src/features/home/HomeScreen.jsx`

**Interfaces:**
- Consumes: nothing new — `planner_menu` (Task 1's restructured screen) is reached the same way any screen key is reached, via `setScreen('planner_menu')`.
- Produces: nothing new — final hub-side integration.

- [ ] **Step 1: Remove the "Рецепты" card and simplify "Меню"**

In `src/features/home/HomeScreen.jsx`, change:

```jsx
        <HubCard
          state={hasSelection ? 'done' : 'active'}
          icon="🍽️"
          title="Рецепты"
          value={hasSelection ? `${selectedCount} отобрано` : 'Смотри рецепты и добавляй в меню'}
          onClick={() => setScreen('planner_menu')}
        />

        <HubCard
          state={!hasSelection ? 'locked' : menuDone ? 'done' : 'active'}
          icon="📋"
          title="Меню"
          value={!hasSelection ? 'Сначала рецепты' : menuDone ? 'Готово' : (scheduledCount > 0 ? `${scheduledCount} распределено` : 'Пока не распределено')}
          onClick={() => {
            setPlannerInitialView('plan');
            setScreen('planner_menu');
          }}
          disabled={!hasSelection}
        />
```

to:

```jsx
        <HubCard
          state={menuDone ? 'done' : 'active'}
          icon="📋"
          title="Меню"
          value={menuDone ? 'Готово' : hasSelection ? `${selectedCount} рецептов отобрано` : 'Что будем готовить?'}
          onClick={() => setScreen('planner_menu')}
        />
```

- [ ] **Step 2: Remove the now-unused `setPlannerInitialView` hook and `scheduledCount` variable**

In `src/features/home/HomeScreen.jsx`, change:

```jsx
function PlannerTab({ student, setScreen }) {
  const setPlannerInitialView = useAppStore((s) => s.setPlannerInitialView);
  const topicRecords = useAppStore((s) => s.topicRecords);
```

to:

```jsx
function PlannerTab({ student, setScreen }) {
  const topicRecords = useAppStore((s) => s.topicRecords);
```

Then change:

```jsx
  const hasSelection = !!existingPlan && existingPlan.selectedRecipes.length > 0;
  const selectedCount = hasSelection ? existingPlan.selectedRecipes.length : 0;
  const scheduledCount = hasSelection
    ? existingPlan.selectedRecipes.filter((id) => existingPlan.mealAssignments?.[id]).length
    : 0;
  const menuDone = hasSelection && allRecipes.length > 0 && isMenuFullyDecided(existingPlan, allRecipes);
```

to:

```jsx
  const hasSelection = !!existingPlan && existingPlan.selectedRecipes.length > 0;
  const selectedCount = hasSelection ? existingPlan.selectedRecipes.length : 0;
  const menuDone = hasSelection && allRecipes.length > 0 && isMenuFullyDecided(existingPlan, allRecipes);
```

(`scheduledCount` counted recipes with a meal assignment — now that every added recipe is assigned at add time, it would always equal `selectedCount`, so it no longer carries information and is dropped along with the card copy that used it.)

- [ ] **Step 2: Run the full test suite**

Run: `npx vitest run src/features/planner`
Expected: all planner tests pass.

- [ ] **Step 3: Run lint**

Run: `npx eslint src/features/home/HomeScreen.jsx`
Expected: only whatever pre-existing issues this file already had before this plan (the `isChatPractice` unused-var error and the `loadPlan`/`Promise.all` `set-state-in-effect` errors already identified in earlier work on this file) — no new errors from this task's changes.

- [ ] **Step 4: Manual verification**

Using the `run` skill: open the Planner tab on the hub and confirm exactly 3 cards show (Меню, Покупки, Раскладка), with Меню always tappable regardless of whether a menu exists yet. Confirm Покупки/Раскладка still gate on `hasSelection`/`boughtCount` exactly as before.

- [ ] **Step 5: Commit**

```bash
git add src/features/home/HomeScreen.jsx
git commit -m "feat(planner): drop the standalone Рецепты hub card, Меню is now the entry point"
```

---

## Task 3: Remove the now-dead `plannerInitialView` store field

**Files:**
- Modify: `src/core/store.js`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing — this is a dead-code cleanup enabled by Tasks 1 and 2 (after both land, `plannerInitialView`/`setPlannerInitialView` have zero remaining callers anywhere in the codebase).

- [ ] **Step 1: Confirm there are no remaining references**

Run: `grep -rn "plannerInitialView" src/`
Expected: only the two definition lines in `src/core/store.js` (no usages left in `PlannerMenuScreen.jsx` or `HomeScreen.jsx`, since both were removed in Tasks 1 and 2).

- [ ] **Step 2: Remove the field and its comment**

In `src/core/store.js`, change:

```js
  // Which sub-view PlannerMenuScreen should open on next mount (e.g. the
  // hub's "Меню" card wants the day-by-day view, not the recipe browser
  // default). Read once on mount, then cleared.
  plannerInitialView: null,
  setPlannerInitialView: (plannerInitialView) => set({ plannerInitialView }),
  // Which Home tab ("session" | "planner") to land on. HomeScreen's own
```

to:

```js
  // Which Home tab ("session" | "planner") to land on. HomeScreen's own
```

- [ ] **Step 3: Run the full test suite**

Run: `npx vitest run src/features/planner`
Expected: all planner tests pass.

- [ ] **Step 4: Run lint on the whole project**

Run: `npm run lint`
Expected: no new errors compared to before this plan (this codebase already has a number of pre-existing lint errors unrelated to the Planner; this step only needs to confirm this specific removal didn't break anything referencing the removed field).

- [ ] **Step 5: Manual verification**

Using the `run` skill: exercise the full Planner flow once more end to end (Меню → add recipes to a couple of slots → decide ingredients → Покупки → Раскладка → "Начинаем готовить") to confirm removing the dead store field didn't regress anything.

- [ ] **Step 6: Commit**

```bash
git add src/core/store.js
git commit -m "chore(planner): remove plannerInitialView, dead since Меню became the only landing view"
```
