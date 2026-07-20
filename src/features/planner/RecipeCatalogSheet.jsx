import { useState } from 'react';
import { BackArrowIcon } from '@/shared/components/ArrowIcons';
import { getTopicTitle } from '@/shared/utils/format';
import { useTopicFile } from '@/shared/hooks/useTopicFile';
import { RECIPE_TAGS, MEAL_ICONS, resolveChosenPortions, pluralizePortionsAccusative, resolveOptionIngredients } from './plannerUtils.js';
import { scaleIngredientQty } from './shoppingUnitConversions.js';
import './planner.css';

const TAB_ALL = 'all';
// Catalog recipes are never tied to a plan — always preview at 1 portion
// (or the recipe's fixed portions), same "not selected yet" fallback the
// real menu detail view uses before a recipe is actually added.
const NO_PLAN = { selectedPortions: {} };

function PlayIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M4.5 3.2v9.6c0 .7.76 1.13 1.36.76l7.5-4.8a.9.9 0 0 0 0-1.52l-7.5-4.8c-.6-.37-1.36.06-1.36.76Z" fill="currentColor" />
    </svg>
  );
}

// Own card, independent from PlannerMenuScreen's RecipeCard/.recipe-gallery-*
// modifiers (__title, __ingr, __add-row) — a change to this catalog's look
// must never risk changing the meal-slot picker's look, and vice versa.
// Only the unmodified base classes (.recipe-gallery-card, __view,
// __photo-btn, __photo, __status) are shared, since those aren't changing.
function CatalogRecipeCard({ recipe, onView, onCook }) {
  const { text, status, topicId } = recipe;
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
        </span>
        <span className="recipe-catalog-card__title">{getTopicTitle(text.title)}</span>
      </button>
      <button type="button" className="recipe-catalog-card__cook-btn" onClick={() => onCook(recipe)}>
        <PlayIcon />
        Готовить
      </button>
    </div>
  );
}

function CatalogRecipeDetail({ recipe, onCook, onBack }) {
  const { topicId, text, ingredients, fixedPortions } = recipe;
  const coverUrl = useTopicFile(topicId, text.photo);
  const resolved = resolveChosenPortions(recipe, NO_PLAN);
  const { chosenPortions, scale } = fixedPortions
    ? resolved
    : { chosenPortions: 1, scale: 1 / resolved.basePortions };
  // The catalog is never plan-aware (NO_PLAN), so any option group (e.g.
  // omelette filling, optional milk) always renders as an on-offer note
  // here — see resolveOptionIngredients in plannerUtils.js.
  const { ingredients: optionIngredients, notes: optionNotes } = resolveOptionIngredients(recipe, NO_PLAN);
  const allIngredients = [...ingredients, ...optionIngredients];

  return (
    <div className="screen planner-screen">
      <div className="planner-header">
        <button className="planner-header__back" onClick={onBack}><BackArrowIcon size={22} /></button>
        <h1 className="planner-header__title">{getTopicTitle(text.title)}</h1>
      </div>

      <div className="recipe-detail-body">
        {coverUrl && <img src={coverUrl} alt="" className="recipe-detail-cover" />}
        <div className="recipe-ingredients">
          <span className="recipe-ingredients__meta">
            {fixedPortions ? '🔒 готовится сразу на ' : 'На '}
            {chosenPortions} {pluralizePortionsAccusative(chosenPortions)}
          </span>
          <ul className="recipe-ingredients__list">
            {allIngredients.map((ing, i) => {
              const scaledQty = scaleIngredientQty(ing.qty, ing.unit, scale, ing.additiveStep, ing.coverDivisor);
              return (
                <li key={i} className="recipe-ingredients__item">
                  <span className="recipe-ingredients__product">{ing.product}</span>
                  <span className="recipe-ingredients__qty">
                    {scaledQty != null ? `${scaledQty} ${ing.unit ?? ''}`.trim() : (ing.unit || 'по вкусу')}
                  </span>
                </li>
              );
            })}
          </ul>
          {optionNotes.length > 0 && (
            <ul className="recipe-ingredients__notes">
              {optionNotes.map((n) => (
                <li key={n.groupId} className="recipe-ingredients__note">{n.text}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="planner-footer">
        <button className="recipe-detail-add" onClick={() => onCook(recipe)}>
          ▶ Готовить
        </button>
      </div>
    </div>
  );
}

export default function RecipeCatalogSheet({ allRecipes, loading, onCook, onClose }) {
  const [activeTab, setActiveTab] = useState(TAB_ALL);
  const [viewingRecipe, setViewingRecipe] = useState(null);
  const filtered = activeTab === TAB_ALL ? allRecipes : allRecipes.filter((r) => r.tags.includes(activeTab));

  if (viewingRecipe) {
    return (
      <div className="recipe-catalog-overlay">
        <CatalogRecipeDetail recipe={viewingRecipe} onCook={onCook} onBack={() => setViewingRecipe(null)} />
      </div>
    );
  }

  return (
    <div className="recipe-catalog-overlay">
      <div className="screen planner-screen">
        <div className="planner-header">
          <button className="planner-header__back" onClick={onClose}><BackArrowIcon size={22} /></button>
          <h1 className="planner-header__title">Рецепты</h1>
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
            {filtered.map((recipe) => (
              <CatalogRecipeCard
                key={`${recipe.topicId}_${recipe.text.id}`}
                recipe={recipe}
                onView={() => setViewingRecipe(recipe)}
                onCook={onCook}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
