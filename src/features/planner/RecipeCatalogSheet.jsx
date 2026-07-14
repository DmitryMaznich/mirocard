import { useState } from 'react';
import { BackArrowIcon } from '@/shared/components/ArrowIcons';
import { RECIPE_TAGS, MEAL_ICONS } from './plannerUtils.js';
import { RecipeCard } from './PlannerMenuScreen.jsx';
import './planner.css';

const TAB_ALL = 'all';

// Same big-photo grid as the "Все" tab of the meal-slot RecipePicker
// (PlannerMenuScreen.jsx) — reuses RecipeCard as-is. Unlike that picker,
// there's no meal slot to add to here: onToggleSelect is omitted, which
// makes RecipeCard hide its "+ Добавить"/"В меню" button, and tapping a
// card (photo or the ▶ button) both just cook it directly, never touching
// the menu.
export default function RecipeCatalogSheet({ allRecipes, loading, onCook, onClose }) {
  const [activeTab, setActiveTab] = useState(TAB_ALL);
  const filtered = activeTab === TAB_ALL ? allRecipes : allRecipes.filter((r) => r.tags.includes(activeTab));

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
              <RecipeCard
                key={`${recipe.topicId}_${recipe.text.id}`}
                recipe={recipe}
                isHere={false}
                otherMeal={null}
                onView={() => onCook(recipe)}
                onCook={onCook}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
