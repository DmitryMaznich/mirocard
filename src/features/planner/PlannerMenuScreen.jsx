import { useEffect, useState, useMemo } from 'react';
import { useAppStore } from '@/core/store';
import { getTopicTitle } from '@/shared/utils/format';
import { useTopicFile } from '@/shared/hooks/useTopicFile';
import { getRawRecipeTxt } from '@/core/groupStore';
import { parseRecipeMetadata } from './recipeParser.js';
import { parseRecipeTxt } from '@/topics/renderers/reading/parseRecipeTxt.js';
import {
  createPlan, addDay, addRecipeToMeal, removeRecipeFromMeal, countPlanRecipes,
  findRecipePlacements, MEAL_TYPES,
} from './plannerUtils.js';
import { loadPlan, savePlan, PANTRY_ITEMS } from './plannerApi.js';
import './planner.css';

const MEAL_ICONS = { завтрак: '🌅', обед: '☀️', ужин: '🌙', перекус: '🍎', напитки: '🥤' };

// ─── Step image ───────────────────────────────────────────────────────────────

function StepImage({ topicId, filePath }) {
  const url = useTopicFile(topicId, filePath);
  if (!url) return null;
  return <img src={url} alt="" className="recipe-step-img" />;
}

// ─── Recipe step ──────────────────────────────────────────────────────────────

function RecipeStepView({ step, topicId }) {
  if (step.type === 'image') return <StepImage topicId={topicId} filePath={step.file} />;
  if (step.type === 'heading') {
    return <div className="recipe-step recipe-step--heading">{step.text}</div>;
  }
  if (step.type === 'warning') {
    return (
      <div className="recipe-step recipe-step--warning">
        <span className="recipe-step__warn-icon">⚠</span>
        <span>{step.text}</span>
      </div>
    );
  }
  return (
    <div className="recipe-step">
      <span className="recipe-step__text">{step.text}</span>
      {step.image && <StepImage topicId={topicId} filePath={step.image} />}
      {step.items && (
        <ul className="recipe-step__items">
          {step.items.map((item, i) => <li key={i}>{item}</li>)}
        </ul>
      )}
    </div>
  );
}

// ─── Recipe detail (inline viewer) ───────────────────────────────────────────

function RecipeDetail({ recipe, plan, onOpenAddSheet, onBack }) {
  const { topicId, text, content } = recipe;
  const coverUrl = useTopicFile(topicId, text.photo);
  const steps = useMemo(() => parseRecipeTxt(content), [content]);
  const placements = findRecipePlacements(plan, text.id);

  return (
    <div className="screen planner-screen">
      <div className="planner-header">
        <button className="planner-header__back" onClick={onBack}>←</button>
        <h1 className="planner-header__title">{getTopicTitle(text.title)}</h1>
      </div>

      <div className="recipe-detail-body">
        {coverUrl && <img src={coverUrl} alt="" className="recipe-detail-cover" />}
        {placements.length > 0 && (
          <div className="recipe-detail-placements">
            <span className="recipe-detail-placements__label">Уже в плане</span>
            {placements.map((p, i) => (
              <span key={i} className="recipe-detail-placements__chip">
                {MEAL_ICONS[p.mealType]} День {p.dayIndex + 1} · {p.mealType}
                {p.portions > 1 ? ` ×${p.portions}` : ''}
              </span>
            ))}
          </div>
        )}
        <div className="recipe-detail-steps">
          {steps.map((step, i) => (
            <RecipeStepView key={step.id || i} step={step} topicId={topicId} />
          ))}
        </div>
      </div>

      <div className="planner-footer">
        <button className="recipe-detail-add" onClick={onOpenAddSheet}>
          + Добавить в план
        </button>
      </div>
    </div>
  );
}

// ─── Recipe card (tap to view, or add straight from the grid) ────────────────

function RecipeCard({ recipe, plan, mealType, onView, onToggleDay, onAddDay }) {
  const { topicId, text, ingredients, fixedPortions } = recipe;
  const photoUrl = useTopicFile(topicId, text.photo);
  const [portions, setPortions] = useState(fixedPortions || recipe.portions || 1);
  const [popoverOpen, setPopoverOpen] = useState(false);

  const placements = findRecipePlacements(plan, text.id);
  const placedInTab = new Set(
    placements.filter((p) => p.mealType === mealType).map((p) => p.dayIndex)
  );

  const keyIngr = ingredients
    .filter((i) => i.product && !PANTRY_ITEMS.has(i.product))
    .slice(0, 3)
    .map((i) => i.product)
    .join(', ');

  return (
    <div className="recipe-gallery-card">
      <button className="recipe-gallery-card__view" onClick={onView}>
        <span className="recipe-gallery-card__photo-btn">
          {photoUrl
            ? <img src={photoUrl} alt="" className="recipe-gallery-card__photo" />
            : <span className="recipe-gallery-card__photo-placeholder" />
          }
          {placements.length > 0 && (
            <span className="recipe-gallery-card__badge">{placements.length}</span>
          )}
        </span>
        <span className="recipe-gallery-card__info">
          <span className="recipe-gallery-card__title">{getTopicTitle(text.title)}</span>
          <span className="recipe-gallery-card__ingr">{keyIngr}</span>
        </span>
      </button>

      <div className="recipe-gallery-card__add-row">
        <button
          type="button"
          className={`recipe-gallery-card__add-btn${placedInTab.size > 0 ? ' recipe-gallery-card__add-btn--active' : ''}`}
          onClick={() => setPopoverOpen((o) => !o)}
        >
          {placedInTab.size > 0 ? `В плане · ${placedInTab.size}` : '+ Добавить'}
        </button>
      </div>

      {popoverOpen && (
        <>
          <div className="card-popover-backdrop" onClick={() => setPopoverOpen(false)} />
          <div className="card-popover">
            <div className="card-popover__row">
              <span className="card-popover__label">Порций</span>
              {fixedPortions ? (
                <span className="card-popover__fixed">🔒 всегда {fixedPortions}</span>
              ) : (
                <div className="card-popover__stepper">
                  <button type="button" onClick={() => setPortions((p) => Math.max(1, p - 1))} aria-label="Меньше порций">−</button>
                  <span>{portions}</span>
                  <button type="button" onClick={() => setPortions((p) => p + 1)} aria-label="Больше порций">+</button>
                </div>
              )}
            </div>
            <div className="card-popover__days">
              {plan.days.map((day) => (
                <label key={day.dayIndex} className="card-popover__day">
                  <input
                    type="checkbox"
                    checked={placedInTab.has(day.dayIndex)}
                    onChange={() => onToggleDay(recipe, day.dayIndex, mealType, placedInTab.has(day.dayIndex), portions)}
                  />
                  <span>День {day.dayIndex + 1}</span>
                </label>
              ))}
              {plan.days.length < 7 && (
                <button type="button" className="card-popover__day card-popover__day--add" onClick={onAddDay}>
                  + День
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Recipe browser (category tabs + grid) ───────────────────────────────────

function RecipeBrowser({ plan, allRecipes, loading, planRecipeCount, onView, onOpenPlan, onBack, onToggleDay, onAddDay }) {
  const [mealType, setMealType] = useState(MEAL_TYPES[0]);
  const filtered = allRecipes.filter((r) => r.tags.includes(mealType));

  return (
    <div className="screen planner-screen">
      <div className="planner-header">
        <button className="planner-header__back" onClick={onBack}>←</button>
        <h1 className="planner-header__title">Рецепты</h1>
        <button className="planner-plan-pill" onClick={onOpenPlan}>
          Мой план{planRecipeCount > 0 ? ` · ${planRecipeCount}` : ''}
        </button>
      </div>

      <div className="gallery-meal-tabs">
        {MEAL_TYPES.map((mt) => (
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
        <div className="gallery-empty">Нет рецептов для «{mealType}»</div>
      ) : (
        <div className="recipe-gallery-grid">
          {filtered.map((recipe) => (
            <RecipeCard
              key={`${recipe.topicId}_${recipe.text.id}`}
              recipe={recipe}
              plan={plan}
              mealType={mealType}
              onView={() => onView(recipe)}
              onToggleDay={onToggleDay}
              onAddDay={onAddDay}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Add-to-plan sheet ────────────────────────────────────────────────────────

function AddToPlanSheet({ recipe, plan, onAddDay, onConfirm, onClose }) {
  const { fixedPortions } = recipe;
  const [dayIndex, setDayIndex] = useState(0);
  const [mealType, setMealType] = useState(null);
  const [portions, setPortions] = useState(fixedPortions || recipe.portions || 1);

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
              <button type="button" onClick={() => setPortions((p) => p + 1)} aria-label="Больше порций">+</button>
            </div>
          )}
        </div>

        <button
          type="button"
          className="add-sheet__confirm"
          disabled={mealType === null}
          onClick={() => onConfirm(dayIndex, mealType, portions)}
        >
          Добавить в план
        </button>
      </div>
    </div>
  );
}

// ─── Plan view (day-by-day review) ───────────────────────────────────────────

function PlanDayCard({ day, allRecipes, onRemove, onViewRecipe }) {
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
                    <button
                      className="planner-recipe-chip__name"
                      onClick={() => r && onViewRecipe(r)}
                      disabled={!r}
                    >
                      {title}{portions > 1 ? ` ×${portions}` : ''}
                    </button>
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

function PlanView({ plan, allRecipes, onAddDay, onRemove, onViewRecipe, onBack }) {
  return (
    <div className="screen planner-screen">
      <div className="planner-header">
        <button className="planner-header__back" onClick={onBack}>←</button>
        <h1 className="planner-header__title">Мой план</h1>
      </div>

      <div className="planner-body">
        {plan.days.map((day) => (
          <PlanDayCard
            key={day.dayIndex}
            day={day}
            allRecipes={allRecipes}
            onRemove={onRemove}
            onViewRecipe={onViewRecipe}
          />
        ))}
        {plan.days.length < 7 && (
          <button className="planner-add-day" onClick={onAddDay}>
            + Добавить день
          </button>
        )}
      </div>
    </div>
  );
}

// ─── PlannerMenuScreen ────────────────────────────────────────────────────────

export default function PlannerMenuScreen() {
  const setScreen = useAppStore((s) => s.setScreen);
  const activeStudentId = useAppStore((s) => s.activeStudentId);
  const topicRecords = useAppStore((s) => s.topicRecords);

  const [plan, setPlan] = useState(null);
  const [allRecipes, setAllRecipes] = useState([]);
  const [loadingRecipes, setLoadingRecipes] = useState(false);

  // view: 'recipes' | 'plan' | 'detail'
  const [view, setView] = useState('recipes');
  const [detailRecipe, setDetailRecipe] = useState(null);
  const [detailPrev, setDetailPrev] = useState('recipes');
  const [addSheetOpen, setAddSheetOpen] = useState(false);

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
          const { tags, ingredients, portions, fixedPortions } = parseRecipeMetadata(content);
          all.push({ topicId: record.meta.id, text, tags, ingredients, portions, fixedPortions, content });
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

  function handleConfirmAdd(dayIndex, mealType, portions) {
    setPlan((p) => addRecipeToMeal(p, dayIndex, mealType, detailRecipe.text.id, portions));
    setAddSheetOpen(false);
  }

  function handleToggleDay(recipe, dayIndex, mealType, currentlyPlaced, portions) {
    setPlan((p) =>
      currentlyPlaced
        ? removeRecipeFromMeal(p, dayIndex, mealType, recipe.text.id)
        : addRecipeToMeal(p, dayIndex, mealType, recipe.text.id, portions)
    );
  }

  if (!plan) return <div className="screen screen-center">Загрузка…</div>;

  if (view === 'detail' && detailRecipe) {
    return (
      <>
        <RecipeDetail
          recipe={detailRecipe}
          plan={plan}
          onOpenAddSheet={() => setAddSheetOpen(true)}
          onBack={() => setView(detailPrev)}
        />
        {addSheetOpen && (
          <AddToPlanSheet
            recipe={detailRecipe}
            plan={plan}
            onAddDay={() => setPlan((p) => addDay(p))}
            onConfirm={handleConfirmAdd}
            onClose={() => setAddSheetOpen(false)}
          />
        )}
      </>
    );
  }

  if (view === 'plan') {
    return (
      <PlanView
        plan={plan}
        allRecipes={allRecipes}
        onAddDay={() => setPlan((p) => addDay(p))}
        onRemove={(dayIndex, mealType, textId) =>
          setPlan((p) => removeRecipeFromMeal(p, dayIndex, mealType, textId))
        }
        onViewRecipe={(recipe) => openDetail(recipe, 'plan')}
        onBack={() => setView('recipes')}
      />
    );
  }

  return (
    <RecipeBrowser
      plan={plan}
      allRecipes={allRecipes}
      loading={loadingRecipes}
      planRecipeCount={countPlanRecipes(plan)}
      onView={(recipe) => openDetail(recipe, 'recipes')}
      onOpenPlan={() => setView('plan')}
      onBack={() => setScreen('home')}
      onToggleDay={handleToggleDay}
      onAddDay={() => setPlan((p) => addDay(p))}
    />
  );
}
