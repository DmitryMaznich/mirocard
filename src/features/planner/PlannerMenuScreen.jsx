import { useEffect, useState } from 'react';
import { useAppStore } from '@/core/store';
import { getTopicTitle } from '@/shared/utils/format';
import { useTopicFile } from '@/shared/hooks/useTopicFile';
import { getRawRecipeTxt } from '@/core/groupStore';
import Button from '@/shared/components/Button';
import { parseRecipeMetadata } from './recipeParser.js';
import {
  createPlan,
  addDay,
  addRecipeToMeal,
  removeRecipeFromMeal,
  countPlanRecipes,
  MEAL_TYPES,
} from './plannerUtils.js';
import { loadPlan, savePlan } from './plannerApi.js';
import './planner.css';

// ─── RecipePicker sub-components ──────────────────────────────────────────────

function RecipePhoto({ topicId, imagePath }) {
  const url = useTopicFile(topicId, imagePath);
  if (url) return <img src={url} alt="" className="recipe-picker-card__photo" />;
  return <div className="recipe-picker-card__photo--placeholder" />;
}

function RecipePickerCard({ topicId, text, selected, onAdd }) {
  return (
    <button
      className={`recipe-picker-card${selected ? ' recipe-picker-card--selected' : ''}`}
      onClick={onAdd}
      disabled={selected}
    >
      <RecipePhoto topicId={topicId} imagePath={text.image} />
      <span className="recipe-picker-card__title">{getTopicTitle(text.title)}</span>
      {selected && <span className="recipe-picker-card__check">✓</span>}
    </button>
  );
}

function RecipePicker({ mealType, existingIds, onAdd, onClose }) {
  const topicRecords = useAppStore((s) => s.topicRecords);
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const all = [];
      for (const record of topicRecords) {
        if (record.meta?.renderer !== 'reading') continue;
        for (const text of record.texts ?? []) {
          if (text.kind !== 'instruction' || !text.file) continue;
          const content = await getRawRecipeTxt(record.meta.id, text.file);
          if (!content) continue;
          const { tags } = parseRecipeMetadata(content);
          if (!tags.includes(mealType)) continue;
          all.push({ topicId: record.meta.id, text });
        }
      }
      if (!cancelled) { setRecipes(all); setLoading(false); }
    }
    load();
    return () => { cancelled = true; };
  }, [topicRecords, mealType]);

  return (
    <div className="recipe-picker-overlay" onClick={onClose}>
      <div className="recipe-picker-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="recipe-picker-header">
          <span className="recipe-picker-header__title">{mealType}</span>
          <button className="recipe-picker-header__close" onClick={onClose}>✕</button>
        </div>
        {loading ? (
          <div className="recipe-picker-loading">Загрузка…</div>
        ) : recipes.length === 0 ? (
          <div className="recipe-picker-empty">Нет рецептов для «{mealType}»</div>
        ) : (
          <div className="recipe-picker-list">
            {recipes.map(({ topicId, text }) => (
              <RecipePickerCard
                key={`${topicId}_${text.id}`}
                topicId={topicId}
                text={text}
                selected={existingIds.includes(text.id)}
                onAdd={() => { onAdd(text.id); onClose(); }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── DayCard ───────────────────────────────────────────────────────────────────

function DayCard({ day, topicRecords, onAdd, onRemove }) {
  function getTitle(textId) {
    for (const record of topicRecords) {
      const text = (record.texts ?? []).find((t) => t.id === textId);
      if (text) return getTopicTitle(text.title);
    }
    return textId;
  }

  return (
    <div className="planner-day-card">
      <div className="planner-day-title">День {day.dayIndex + 1}</div>
      {MEAL_TYPES.map((mealType) => (
        <div key={mealType} className="planner-meal-section">
          <div className="planner-meal-header">
            <span className="planner-meal-type">{mealType}</span>
            <button className="planner-add-btn" onClick={() => onAdd(mealType)}>
              + добавить
            </button>
          </div>
          {(day.meals[mealType] ?? []).length > 0 && (
            <div className="planner-recipe-chips">
              {day.meals[mealType].map((textId) => (
                <span key={textId} className="planner-recipe-chip">
                  {getTitle(textId)}
                  <button
                    className="planner-recipe-chip__remove"
                    onClick={() => onRemove(day.dayIndex, mealType, textId)}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── PlannerMenuScreen ─────────────────────────────────────────────────────────

export default function PlannerMenuScreen() {
  const setScreen = useAppStore((s) => s.setScreen);
  const students = useAppStore((s) => s.students);
  const topicRecords = useAppStore((s) => s.topicRecords);
  const activeStudentId = useAppStore((s) => s.activeStudentId);
  const student = students.find((s) => s.id === activeStudentId);

  const [plan, setPlan] = useState(null);
  const [picker, setPicker] = useState(null); // { dayIndex, mealType }
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!activeStudentId) return;
    loadPlan(activeStudentId).then((saved) => {
      setPlan(saved ?? createPlan(activeStudentId));
    });
  }, [activeStudentId]);

  function handleAdd(dayIndex, mealType) {
    setPicker({ dayIndex, mealType });
  }

  function handleAddRecipe(textId) {
    if (!picker) return;
    setPlan((p) => addRecipeToMeal(p, picker.dayIndex, picker.mealType, textId));
  }

  function handleRemove(dayIndex, mealType, textId) {
    setPlan((p) => removeRecipeFromMeal(p, dayIndex, mealType, textId));
  }

  async function handleNext() {
    setSaving(true);
    await savePlan(plan);
    setSaving(false);
    setScreen('planner_summary');
  }

  if (!plan) return <div className="screen screen-center">Загрузка…</div>;

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
            topicRecords={topicRecords}
            onAdd={(mealType) => handleAdd(day.dayIndex, mealType)}
            onRemove={handleRemove}
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

      {picker && (
        <RecipePicker
          mealType={picker.mealType}
          existingIds={plan.days[picker.dayIndex]?.meals[picker.mealType] ?? []}
          onAdd={handleAddRecipe}
          onClose={() => setPicker(null)}
        />
      )}
    </div>
  );
}
