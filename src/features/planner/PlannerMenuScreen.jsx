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
