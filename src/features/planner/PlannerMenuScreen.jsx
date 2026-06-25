import { useEffect, useState, useMemo } from 'react';
import { useAppStore } from '@/core/store';
import { getTopicTitle } from '@/shared/utils/format';
import { useTopicFile } from '@/shared/hooks/useTopicFile';
import { getRawRecipeTxt } from '@/core/groupStore';
import Button from '@/shared/components/Button';
import { parseRecipeMetadata } from './recipeParser.js';
import { parseRecipeTxt } from '@/topics/renderers/reading/parseRecipeTxt.js';
import {
  createPlan, addDay, addRecipeToMeal, removeRecipeFromMeal, countPlanRecipes, MEAL_TYPES,
} from './plannerUtils.js';
import { loadPlan, savePlan, PANTRY_ITEMS } from './plannerApi.js';
import './planner.css';

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

function RecipeDetail({ recipe, isSelected, onAdd, onBack }) {
  const { topicId, text, content } = recipe;
  const coverUrl = useTopicFile(topicId, text.photo);
  const steps = useMemo(() => parseRecipeTxt(content), [content]);

  return (
    <div className="screen planner-screen">
      <div className="planner-header">
        <button className="planner-header__back" onClick={onBack}>←</button>
        <h1 className="planner-header__title">{getTopicTitle(text.title)}</h1>
      </div>

      <div className="recipe-detail-body">
        {coverUrl && <img src={coverUrl} alt="" className="recipe-detail-cover" />}
        <div className="recipe-detail-steps">
          {steps.map((step, i) => (
            <RecipeStepView key={step.id || i} step={step} topicId={topicId} />
          ))}
        </div>
      </div>

      {onAdd && (
        <div className="planner-footer">
          <button
            className={`recipe-detail-add${isSelected ? ' recipe-detail-add--done' : ''}`}
            onClick={onAdd}
          >
            {isSelected ? '✓ Уже в плане' : '+ Добавить в план'}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Gallery card ─────────────────────────────────────────────────────────────

function RecipeGalleryCard({ recipe, isSelected, onView, onToggle }) {
  const { topicId, text, ingredients } = recipe;
  const photoUrl = useTopicFile(topicId, text.photo);

  const keyIngr = ingredients
    .filter((i) => i.product && !PANTRY_ITEMS.has(i.product))
    .slice(0, 3)
    .map((i) => i.product)
    .join(', ');

  return (
    <div className={`recipe-gallery-card${isSelected ? ' recipe-gallery-card--selected' : ''}`}>
      <button className="recipe-gallery-card__photo-btn" onClick={onView} aria-label="Посмотреть рецепт">
        {photoUrl
          ? <img src={photoUrl} alt="" className="recipe-gallery-card__photo" />
          : <div className="recipe-gallery-card__photo-placeholder" />
        }
        {isSelected && <span className="recipe-gallery-card__badge">✓</span>}
      </button>
      <div className="recipe-gallery-card__info">
        <span className="recipe-gallery-card__title">{getTopicTitle(text.title)}</span>
        {keyIngr && <span className="recipe-gallery-card__ingr">{keyIngr}</span>}
      </div>
      <button
        className={`recipe-gallery-card__add${isSelected ? ' recipe-gallery-card__add--done' : ''}`}
        onClick={onToggle}
        aria-label={isSelected ? 'Убрать из плана' : 'Добавить в план'}
      >
        {isSelected ? '✓' : '+'}
      </button>
    </div>
  );
}

// ─── Recipe gallery (full-screen grid) ───────────────────────────────────────

const MEAL_ICONS = { завтрак: '🌅', обед: '☀️', ужин: '🌙', перекус: '🍎' };

function RecipeGallery({ initialMealType, selectedIds, mealCounts, allRecipes, loading, onToggle, onView, onBack }) {
  const [mealType, setMealType] = useState(initialMealType);
  const filtered = allRecipes.filter((r) => r.tags.includes(mealType));

  return (
    <div className="screen planner-screen">
      <div className="planner-header">
        <button className="planner-header__back" onClick={onBack}>←</button>
        <h1 className="planner-header__title">Выбрать блюдо</h1>
      </div>

      <div className="gallery-meal-tabs">
        {MEAL_TYPES.map((mt) => (
          <button
            key={mt}
            className={`gallery-meal-tab${mealType === mt ? ' gallery-meal-tab--active' : ''}`}
            onClick={() => setMealType(mt)}
          >
            {MEAL_ICONS[mt]} {mt}
            {(mealCounts[mt] ?? 0) > 0 && (
              <span className="gallery-meal-tab__count">{mealCounts[mt]}</span>
            )}
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
            <RecipeGalleryCard
              key={`${recipe.topicId}_${recipe.text.id}`}
              recipe={recipe}
              isSelected={selectedIds.includes(recipe.text.id)}
              onView={() => onView(recipe)}
              onToggle={() => onToggle(recipe.text.id, selectedIds.includes(recipe.text.id))}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Day card ─────────────────────────────────────────────────────────────────

function DayCard({ day, allRecipes, onOpenGallery, onRemove, onViewRecipe }) {
  function getRecipeObj(textId) {
    return allRecipes.find((r) => r.text.id === textId) ?? null;
  }

  return (
    <div className="planner-day-card">
      <div className="planner-day-title">День {day.dayIndex + 1}</div>
      {MEAL_TYPES.map((mealType) => {
        const ids = day.meals[mealType] ?? [];
        return (
          <div key={mealType} className="planner-meal-section">
            <div className="planner-meal-header">
              <span className="planner-meal-type">{mealType}</span>
              <button className="planner-add-btn" onClick={() => onOpenGallery(mealType)}>
                + добавить
              </button>
            </div>
            {ids.length > 0 && (
              <div className="planner-recipe-chips">
                {ids.map((textId) => {
                  const r = getRecipeObj(textId);
                  const title = r ? getTopicTitle(r.text.title) : textId;
                  return (
                    <span key={textId} className="planner-recipe-chip">
                      <button
                        className="planner-recipe-chip__name"
                        onClick={() => r && onViewRecipe(r)}
                        disabled={!r}
                      >
                        {title}
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
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── PlannerMenuScreen ────────────────────────────────────────────────────────

export default function PlannerMenuScreen() {
  const setScreen = useAppStore((s) => s.setScreen);
  const students = useAppStore((s) => s.students);
  const topicRecords = useAppStore((s) => s.topicRecords);
  const activeStudentId = useAppStore((s) => s.activeStudentId);
  const student = students.find((s) => s.id === activeStudentId);

  const [plan, setPlan] = useState(null);
  const [saving, setSaving] = useState(false);
  const [allRecipes, setAllRecipes] = useState([]);
  const [loadingRecipes, setLoadingRecipes] = useState(false);

  // view: 'plan' | 'gallery' | 'detail'
  const [view, setView] = useState('plan');
  const [galleryCtx, setGalleryCtx] = useState(null); // { dayIndex, mealType }
  const [detailRecipe, setDetailRecipe] = useState(null);
  const [detailPrev, setDetailPrev] = useState('plan'); // where to go back from detail

  // Load saved plan
  useEffect(() => {
    if (!activeStudentId) return;
    loadPlan(activeStudentId).then((saved) => {
      setPlan(saved ?? createPlan(activeStudentId));
    });
  }, [activeStudentId]);

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
          const { tags, ingredients } = parseRecipeMetadata(content);
          all.push({ topicId: record.meta.id, text, tags, ingredients, content });
        }
      }
      if (!cancelled) { setAllRecipes(all); setLoadingRecipes(false); }
    }
    load();
    return () => { cancelled = true; };
  }, [topicRecords]);

  // IDs selected in the current gallery context meal slot
  const gallerySelectedIds = useMemo(() => {
    if (!plan || !galleryCtx) return [];
    return plan.days[galleryCtx.dayIndex]?.meals[galleryCtx.mealType] ?? [];
  }, [plan, galleryCtx]);

  // Count of selected recipes per meal type for the current day
  const galleryCounts = useMemo(() => {
    if (!plan || !galleryCtx) return {};
    const day = plan.days[galleryCtx.dayIndex];
    const counts = {};
    for (const mt of MEAL_TYPES) counts[mt] = (day?.meals[mt] ?? []).length;
    return counts;
  }, [plan, galleryCtx]);

  // Whether the detail recipe is in the current gallery context
  const detailIsSelected = useMemo(() => {
    if (!detailRecipe || !galleryCtx || !plan) return false;
    return (plan.days[galleryCtx.dayIndex]?.meals[galleryCtx.mealType] ?? [])
      .includes(detailRecipe.text.id);
  }, [detailRecipe, galleryCtx, plan]);

  function openGallery(dayIndex, mealType) {
    setGalleryCtx({ dayIndex, mealType });
    setView('gallery');
  }

  function openDetailFromGallery(recipe) {
    setDetailRecipe(recipe);
    setDetailPrev('gallery');
    setView('detail');
  }

  function openDetailFromPlan(recipe) {
    setDetailRecipe(recipe);
    setDetailPrev('plan');
    setView('detail');
  }

  function handleToggleInGallery(textId, isSelected) {
    if (!galleryCtx || !plan) return;
    if (isSelected) {
      setPlan((p) => removeRecipeFromMeal(p, galleryCtx.dayIndex, galleryCtx.mealType, textId));
    } else {
      setPlan((p) => addRecipeToMeal(p, galleryCtx.dayIndex, galleryCtx.mealType, textId));
    }
  }

  function handleAddFromDetail() {
    if (!galleryCtx || !detailRecipe) return;
    setPlan((p) => addRecipeToMeal(p, galleryCtx.dayIndex, galleryCtx.mealType, detailRecipe.text.id));
    setView('gallery');
  }

  async function handleNext() {
    setSaving(true);
    await savePlan(plan);
    setSaving(false);
    setScreen('planner_summary');
  }

  if (!plan) return <div className="screen screen-center">Загрузка…</div>;

  // ── Gallery ────────────────────────────────────────────────────────────────
  if (view === 'gallery') {
    return (
      <RecipeGallery
        initialMealType={galleryCtx.mealType}
        selectedIds={gallerySelectedIds}
        mealCounts={galleryCounts}
        allRecipes={allRecipes}
        loading={loadingRecipes}
        onToggle={handleToggleInGallery}
        onView={openDetailFromGallery}
        onBack={() => setView('plan')}
      />
    );
  }

  // ── Detail ─────────────────────────────────────────────────────────────────
  if (view === 'detail' && detailRecipe) {
    return (
      <RecipeDetail
        recipe={detailRecipe}
        isSelected={detailIsSelected}
        onAdd={galleryCtx && !detailIsSelected ? handleAddFromDetail : detailIsSelected ? () => setView(detailPrev) : null}
        onBack={() => setView(detailPrev)}
      />
    );
  }

  // ── Plan ───────────────────────────────────────────────────────────────────
  return (
    <div className="screen planner-screen">
      <div className="planner-header">
        <button className="planner-header__back" onClick={() => setScreen('home')}>←</button>
        <h1 className="planner-header__title">
          Меню{student ? ` для ${student.name}` : ''}
        </h1>
      </div>

      <div className="planner-body">
        {plan.days.map((day) => (
          <DayCard
            key={day.dayIndex}
            day={day}
            allRecipes={allRecipes}
            onOpenGallery={(mealType) => openGallery(day.dayIndex, mealType)}
            onRemove={(dayIndex, mealType, textId) =>
              setPlan((p) => removeRecipeFromMeal(p, dayIndex, mealType, textId))
            }
            onViewRecipe={openDetailFromPlan}
          />
        ))}
        {plan.days.length < 7 && (
          <button className="planner-add-day" onClick={() => setPlan((p) => addDay(p))}>
            + Добавить день
          </button>
        )}
      </div>

      <div className="planner-footer">
        <Button
          fullWidth
          disabled={countPlanRecipes(plan) === 0 || saving}
          onClick={handleNext}
        >
          {saving ? 'Сохраняем…' : 'Далее →'}
        </Button>
      </div>
    </div>
  );
}
