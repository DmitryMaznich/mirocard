import { useEffect, useState } from 'react';
import { useAppStore } from '@/core/store';
import { getTopicTitle } from '@/shared/utils/format';
import { useTopicFile } from '@/shared/hooks/useTopicFile';
import { getRawRecipeTxt } from '@/core/groupStore';
import { parseRecipeMetadata } from './recipeParser.js';
import { BackArrowIcon } from '@/shared/components/ArrowIcons';
import {
  createPlan, addDay, addRecipeToMeal, removeRecipeFromMeal,
  findRecipePlacements, isRecipeSelected, selectRecipe, deselectRecipe, resetPlan,
  setIngredientDecision, buildSelectedIngredientsSummary,
  MEAL_TYPES, RECIPE_TAGS,
} from './plannerUtils.js';
import { loadPlan, savePlan, PANTRY_ITEMS } from './plannerApi.js';
import './planner.css';

const MEAL_ICONS = { завтрак: '🌅', обед: '☀️', ужин: '🌙', перекус: '🍎', напитки: '🥤' };

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

function RecipeIngredients({ recipe, plan, onOpenAddSheet, onBack }) {
  const { topicId, text, ingredients, portions, fixedPortions } = recipe;
  const coverUrl = useTopicFile(topicId, text.photo);
  const placements = findRecipePlacements(plan, text.id);
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
        {placements.length > 0 ? (
          <div className="recipe-detail-placements">
            <span className="recipe-detail-placements__label">Уже в меню</span>
            {placements.map((p, i) => (
              <span key={i} className="recipe-detail-placements__chip">
                {MEAL_ICONS[p.mealType]} День {p.dayIndex + 1} · {p.mealType}
                {p.portions > 1 ? ` ×${p.portions}` : ''}
              </span>
            ))}
          </div>
        ) : selected ? (
          <div className="recipe-detail-placements">
            <span className="recipe-detail-placements__hint">Отобрано, пока без дня</span>
          </div>
        ) : null}
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
        <button className="recipe-detail-add" onClick={onOpenAddSheet}>
          + Добавить в меню
        </button>
      </div>
    </div>
  );
}

// ─── Recipe card (tap to view, or select for the menu pool) ──────────────────

function PlayIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M4.5 3.2v9.6c0 .7.76 1.13 1.36.76l7.5-4.8a.9.9 0 0 0 0-1.52l-7.5-4.8c-.6-.37-1.36.06-1.36.76Z" fill="currentColor" />
    </svg>
  );
}

function RecipeCard({ recipe, selected, onView, onCook, onToggleSelect }) {
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
          {selected && <span className="recipe-gallery-card__badge">✓</span>}
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
          className={`recipe-gallery-card__add-btn${selected ? ' recipe-gallery-card__add-btn--active' : ''}`}
          onClick={() => onToggleSelect(recipe)}
        >
          {selected ? '✓ В меню' : '+ Добавить'}
        </button>
      </div>
    </div>
  );
}

// ─── Recipe browser (category tabs + grid) ───────────────────────────────────

const TAB_ALL = 'all';

function RecipeBrowser({ plan, allRecipes, loading, selectedCount, onView, onCook, onOpenPlan, onBack, onToggleSelect }) {
  const [mealType, setMealType] = useState(TAB_ALL);
  const filtered = mealType === TAB_ALL ? allRecipes : allRecipes.filter((r) => r.tags.includes(mealType));

  return (
    <div className="screen planner-screen">
      <div className="planner-header">
        <button className="planner-header__back" onClick={onBack}><BackArrowIcon size={22} /></button>
        <h1 className="planner-header__title">Рецепты</h1>
        <button className="planner-plan-pill" onClick={onOpenPlan}>
          Меню{selectedCount > 0 ? ` · ${selectedCount}` : ''}
        </button>
      </div>

      <div className="gallery-meal-tabs">
        <button
          className={`gallery-meal-tab${mealType === TAB_ALL ? ' gallery-meal-tab--active' : ''}`}
          onClick={() => setMealType(TAB_ALL)}
        >
          Все
        </button>
        {RECIPE_TAGS.map((mt) => (
          <button
            key={mt}
            className={`gallery-meal-tab${mealType === mt ? ' gallery-meal-tab--active' : ''}`}
            onClick={() => setMealType(mt)}
          >
            {MEAL_ICONS[mt]} {mt}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="planner-loading">Загружаем рецепты…</div>
      ) : filtered.length === 0 ? (
        <div className="gallery-empty">
          {mealType === TAB_ALL ? 'Рецептов пока нет' : `Нет рецептов для «${mealType}»`}
        </div>
      ) : (
        <div className="recipe-gallery-grid">
          {filtered.map((recipe) => (
            <RecipeCard
              key={`${recipe.topicId}_${recipe.text.id}`}
              recipe={recipe}
              selected={isRecipeSelected(plan, recipe.text.id)}
              onView={() => onView(recipe)}
              onCook={onCook}
              onToggleSelect={onToggleSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Add-to-plan sheet (distribute a pool recipe, or move a placement) ───────

function AddToPlanSheet({ recipe, plan, initialDayIndex = 0, initialMealType = null, initialPortions = null, onAddDay, onConfirm, onClose }) {
  const { fixedPortions, maxPortions } = recipe;
  const [dayIndex, setDayIndex] = useState(initialDayIndex);
  const [mealType, setMealType] = useState(initialMealType);
  const [portions, setPortions] = useState(initialPortions ?? (fixedPortions || recipe.portions || 1));

  function handleAddDay() {
    const newIndex = plan.days.length;
    onAddDay();
    setDayIndex(newIndex);
  }

  return (
    <div className="add-sheet-backdrop" onClick={onClose}>
      <div className="add-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="add-sheet__handle" />
        <h2 className="add-sheet__title">{getTopicTitle(recipe.text.title)}</h2>

        <div className="add-sheet__section">
          <span className="add-sheet__label">День</span>
          <div className="add-sheet__chips">
            {plan.days.map((day) => (
              <button
                key={day.dayIndex}
                type="button"
                className={`add-sheet__chip${dayIndex === day.dayIndex ? ' add-sheet__chip--active' : ''}`}
                onClick={() => setDayIndex(day.dayIndex)}
              >
                День {day.dayIndex + 1}
              </button>
            ))}
            {plan.days.length < 7 && (
              <button type="button" className="add-sheet__chip add-sheet__chip--add" onClick={handleAddDay}>
                + День
              </button>
            )}
          </div>
        </div>

        <div className="add-sheet__section">
          <span className="add-sheet__label">Приём пищи</span>
          <div className="add-sheet__meals">
            {MEAL_TYPES.map((mt) => (
              <button
                key={mt}
                type="button"
                className={`add-sheet__meal${mealType === mt ? ' add-sheet__meal--active' : ''}`}
                onClick={() => setMealType(mt)}
              >
                <span className="add-sheet__meal-icon">{MEAL_ICONS[mt]}</span>
                <span className="add-sheet__meal-label">{mt}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="add-sheet__section add-sheet__section--row">
          <span className="add-sheet__label">Порций</span>
          {fixedPortions ? (
            <span className="add-sheet__fixed">🔒 всегда {fixedPortions} — блюдо готовится целиком</span>
          ) : (
            <div className="add-sheet__stepper">
              <button type="button" onClick={() => setPortions((p) => Math.max(1, p - 1))} aria-label="Меньше порций">−</button>
              <span className="add-sheet__stepper-value">{portions}</span>
              <button type="button" onClick={() => setPortions((p) => Math.min(maxPortions, p + 1))} aria-label="Больше порций">+</button>
            </div>
          )}
        </div>

        <div className="add-sheet__actions">
          <button type="button" className="add-sheet__cancel" onClick={onClose}>
            Отменить
          </button>
          <button
            type="button"
            className="add-sheet__confirm"
            disabled={mealType === null}
            onClick={() => onConfirm(dayIndex, mealType, portions)}
          >
            Добавить в меню
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Selected pool (Отобрано) ─────────────────────────────────────────────────

function SelectedPool({ plan, allRecipes, onDistribute, onDeselect, onViewRecipe }) {
  if (plan.selectedRecipes.length === 0) return null;

  return (
    <div className="menu-pool">
      <h2 className="menu-pool__title">Отобрано</h2>
      <div className="menu-pool__list">
        {plan.selectedRecipes.map((textId) => {
          const recipe = allRecipes.find((r) => r.text.id === textId);
          if (!recipe) return null;
          const placements = findRecipePlacements(plan, textId);
          return (
            <div key={textId} className="menu-pool__row">
              <button className="menu-pool__name" onClick={() => onViewRecipe(recipe)}>
                <span className="menu-pool__title-text">{getTopicTitle(recipe.text.title)}</span>
                <span className="menu-pool__ingr">{keyIngredients(recipe.ingredients)}</span>
              </button>
              {placements.length > 0 && (
                <span className="menu-pool__badge">×{placements.length}</span>
              )}
              <button type="button" className="menu-pool__distribute" onClick={() => onDistribute(recipe)}>
                Распределить
              </button>
              <button type="button" className="menu-pool__remove" onClick={() => onDeselect(textId)}>
                Убрать
              </button>
            </div>
          );
        })}
      </div>
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
              <div className="menu-ingr-row__top">
                <span className="menu-ingr-row__product">{item.product}</span>
                <span className="menu-ingr-row__qty">
                  {item.qty != null ? `${Math.round(item.qty * 10) / 10} ${item.unit ?? ''}`.trim() : 'по вкусу'}
                </span>
              </div>
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

// ─── Plan view (day-by-day review) ───────────────────────────────────────────

function PlanDayCard({ day, allRecipes, onRemove, onViewRecipe, onCook, onMove }) {
  function getRecipeObj(textId) {
    return allRecipes.find((r) => r.text.id === textId) ?? null;
  }

  const filledMeals = MEAL_TYPES.filter((mt) => (day.meals[mt] ?? []).length > 0);

  return (
    <div className="planner-day-card">
      <div className="planner-day-title">День {day.dayIndex + 1}</div>
      {filledMeals.length === 0 ? (
        <div className="planner-day-card__empty">Пока пусто</div>
      ) : (
        filledMeals.map((mealType) => (
          <div key={mealType} className="planner-meal-section">
            <div className="planner-meal-header">
              <span className="planner-meal-type">{MEAL_ICONS[mealType]} {mealType}</span>
            </div>
            <div className="planner-recipe-chips">
              {day.meals[mealType].map(({ textId, portions }) => {
                const r = getRecipeObj(textId);
                const title = r ? getTopicTitle(r.text.title) : textId;
                return (
                  <span key={textId} className="planner-recipe-chip">
                    {r && (
                      <button
                        className="planner-recipe-chip__cook"
                        onClick={() => onCook(r)}
                        aria-label="Готовить по шагам"
                      >
                        <PlayIcon />
                      </button>
                    )}
                    <button
                      className="planner-recipe-chip__name"
                      onClick={() => r && onViewRecipe(r)}
                      disabled={!r}
                    >
                      {title}{portions > 1 ? ` ×${portions}` : ''}
                    </button>
                    {r && (
                      <button
                        className="planner-recipe-chip__move"
                        onClick={() => onMove(r, day.dayIndex, mealType, portions)}
                        aria-label="Перенести на другой день или приём пищи"
                      >
                        ↻
                      </button>
                    )}
                    <button
                      className="planner-recipe-chip__remove"
                      onClick={() => onRemove(day.dayIndex, mealType, textId)}
                    >
                      ×
                    </button>
                  </span>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function PlanView({ plan, allRecipes, onAddDay, onRemove, onViewRecipe, onCook, onMove, onDistribute, onDeselect, onSetIngredientDecision, onReset, onBack }) {
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <div className="screen planner-screen">
      <div className="planner-header">
        <button className="planner-header__back" onClick={onBack}><BackArrowIcon size={22} /></button>
        <h1 className="planner-header__title">Меню</h1>
      </div>

      <div className="planner-body">
        <SelectedPool
          plan={plan}
          allRecipes={allRecipes}
          onDistribute={onDistribute}
          onDeselect={onDeselect}
          onViewRecipe={onViewRecipe}
        />
        <MenuIngredientsSummary
          plan={plan}
          allRecipes={allRecipes}
          onSetDecision={onSetIngredientDecision}
        />
        {plan.days.map((day) => (
          <PlanDayCard
            key={day.dayIndex}
            day={day}
            allRecipes={allRecipes}
            onRemove={onRemove}
            onViewRecipe={onViewRecipe}
            onCook={onCook}
            onMove={onMove}
          />
        ))}
        {plan.days.length < 7 && (
          <button className="planner-add-day" onClick={onAddDay}>
            + Добавить день
          </button>
        )}
        <button type="button" className="menu-reset-link" onClick={() => setConfirmReset(true)}>
          Начать меню заново
        </button>
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
  const plannerInitialView = useAppStore((s) => s.plannerInitialView);
  const setPlannerInitialView = useAppStore((s) => s.setPlannerInitialView);

  const [plan, setPlan] = useState(null);
  const [allRecipes, setAllRecipes] = useState([]);
  const [loadingRecipes, setLoadingRecipes] = useState(false);

  // view: 'recipes' | 'plan' | 'detail'
  const [view, setView] = useState(() => plannerInitialView ?? 'recipes');
  const [detailRecipe, setDetailRecipe] = useState(null);
  const [detailPrev, setDetailPrev] = useState('recipes');
  // Shared by three entry points: the detail screen's "+ Добавить в меню",
  // Меню's "Распределить" (adds a placement), and "↻" move (replaces one
  // placement) — moveFrom distinguishes add vs. replace on confirm.
  const [addSheet, setAddSheet] = useState(null); // { recipe, moveFrom: {dayIndex, mealType, portions} | null } | null

  // Consume the hub's requested initial view once, so a later visit
  // (without the hub setting it again) defaults back to 'recipes'.
  useEffect(() => {
    if (plannerInitialView) setPlannerInitialView(null);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
      const all = [];
      for (const record of topicRecords) {
        if (record.meta?.renderer !== 'reading') continue;
        for (const text of record.texts ?? []) {
          if (text.kind !== 'instruction' || !text.file) continue;
          const content = await getRawRecipeTxt(record.meta.id, text.file);
          if (!content) continue;
          const { tags, ingredients, portions, fixedPortions, maxPortions, status } = parseRecipeMetadata(content);
          all.push({ topicId: record.meta.id, text, tags, ingredients, portions, fixedPortions, maxPortions, status });
        }
      }
      if (!cancelled) { setAllRecipes(all); setLoadingRecipes(false); }
    }
    load();
    return () => { cancelled = true; };
  }, [topicRecords]);

  function openDetail(recipe, from) {
    setDetailRecipe(recipe);
    setDetailPrev(from);
    setView('detail');
  }

  function openAddSheet(recipe, moveFrom = null) {
    setAddSheet({ recipe, moveFrom });
  }

  function handleConfirmAddSheet(dayIndex, mealType, portions) {
    const { recipe, moveFrom } = addSheet;
    setPlan((p) => {
      let next = selectRecipe(p, recipe.text.id);
      if (moveFrom) {
        next = removeRecipeFromMeal(next, moveFrom.dayIndex, moveFrom.mealType, recipe.text.id);
      }
      return addRecipeToMeal(next, dayIndex, mealType, recipe.text.id, portions);
    });
    setAddSheet(null);
  }

  function handleToggleSelect(recipe) {
    setPlan((p) =>
      isRecipeSelected(p, recipe.text.id)
        ? deselectRecipe(p, recipe.text.id)
        : selectRecipe(p, recipe.text.id)
    );
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
        onOpenAddSheet={() => openAddSheet(detailRecipe)}
        onBack={() => setView(detailPrev)}
      />
    );
  } else if (view === 'plan') {
    content = (
      <PlanView
        plan={plan}
        allRecipes={allRecipes}
        onAddDay={() => setPlan((p) => addDay(p))}
        onRemove={(dayIndex, mealType, textId) =>
          setPlan((p) => removeRecipeFromMeal(p, dayIndex, mealType, textId))
        }
        onViewRecipe={(recipe) => openDetail(recipe, 'plan')}
        onCook={handleCook}
        onMove={(recipe, dayIndex, mealType, portions) =>
          openAddSheet(recipe, { dayIndex, mealType, portions })
        }
        onDistribute={(recipe) => openAddSheet(recipe)}
        onDeselect={(textId) => setPlan((p) => deselectRecipe(p, textId))}
        onSetIngredientDecision={(product, decision) =>
          setPlan((p) => setIngredientDecision(p, product, decision))
        }
        onReset={() => setPlan(resetPlan(activeStudentId))}
        onBack={() => setView('recipes')}
      />
    );
  } else {
    content = (
      <RecipeBrowser
        plan={plan}
        allRecipes={allRecipes}
        loading={loadingRecipes}
        selectedCount={plan.selectedRecipes.length}
        onView={(recipe) => openDetail(recipe, 'recipes')}
        onCook={handleCook}
        onOpenPlan={() => setView('plan')}
        onBack={() => setScreen('home')}
        onToggleSelect={handleToggleSelect}
      />
    );
  }

  return (
    <>
      {content}
      {addSheet && (
        <AddToPlanSheet
          recipe={addSheet.recipe}
          plan={plan}
          initialDayIndex={addSheet.moveFrom?.dayIndex ?? 0}
          initialMealType={addSheet.moveFrom?.mealType ?? null}
          initialPortions={addSheet.moveFrom?.portions ?? null}
          onAddDay={() => setPlan((p) => addDay(p))}
          onConfirm={handleConfirmAddSheet}
          onClose={() => setAddSheet(null)}
        />
      )}
    </>
  );
}
