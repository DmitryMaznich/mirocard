import { useEffect, useState, useMemo } from 'react';
import { useAppStore } from '@/core/store';
import { getTopicTitle } from '@/shared/utils/format';
import { getRawRecipeTxt, getShoppingCustomData, saveShoppingCustomData, getShoppingPlan, saveShoppingPlan } from '@/core/groupStore';
import Button from '@/shared/components/Button';
import { getPlanRecipes, MEAL_TYPES } from './plannerUtils.js';
import { loadPlan, sendPlanToStudent, PANTRY_ITEMS } from './plannerApi.js';
import { generateShoppingList } from './shoppingListGenerator.js';
import './planner.css';

// ─── PlanDaySummary ────────────────────────────────────────────────────────────

function PlanDaySummary({ plan, topicRecords }) {
  function getTitle(textId) {
    for (const record of topicRecords) {
      const text = (record.texts ?? []).find((t) => t.id === textId);
      if (text) return getTopicTitle(text.title);
    }
    return textId;
  }

  return (
    <div className="plan-days-summary">
      {plan.days.map((day) => {
        const filledMeals = MEAL_TYPES.filter((m) => (day.meals[m] ?? []).length > 0);
        if (filledMeals.length === 0) return null;
        return (
          <div key={day.dayIndex} className="plan-day-summary">
            <p className="plan-day-summary__title">День {day.dayIndex + 1}</p>
            {filledMeals.map((mealType) => (
              <div key={mealType} className="plan-meal-row">
                <span className="plan-meal-row__type">{mealType}:</span>
                {day.meals[mealType].map((textId) => (
                  <span key={textId} className="plan-meal-row__recipe">
                    {getTitle(textId)}
                  </span>
                ))}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ─── ShoppingListPreview ───────────────────────────────────────────────────────

function ShoppingListPreview({ items }) {
  const included = items.filter((i) => i.include);
  const pantry = items.filter((i) => !i.include);

  return (
    <div className="shopping-preview">
      <p className="shopping-preview__title">Список покупок — {included.length} поз.</p>
      <ul className="shopping-preview-list">
        {included.map((item) => (
          <li key={item.product} className="shopping-item">
            <span className="shopping-item__name">{item.product}</span>
            {item.qty != null && (
              <span className="shopping-item__qty">
                {Math.round(item.qty * 10) / 10}
                {item.unit ? ` ${item.unit}` : ''}
              </span>
            )}
          </li>
        ))}
      </ul>
      {pantry.length > 0 && (
        <p className="shopping-pantry">
          Обычно есть дома: {pantry.map((i) => i.product).join(', ')}
        </p>
      )}
    </div>
  );
}

// ─── PlannerSummaryScreen ──────────────────────────────────────────────────────

export default function PlannerSummaryScreen() {
  const setScreen = useAppStore((s) => s.setScreen);
  const students = useAppStore((s) => s.students);
  const topicRecords = useAppStore((s) => s.topicRecords);
  const activeStudentId = useAppStore((s) => s.activeStudentId);
  const student = students.find((s) => s.id === activeStudentId);

  const [plan, setPlan] = useState(null);
  const [shoppingList, setShoppingList] = useState(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [pushing, setPushing] = useState(false);
  const [pushed, setPushed] = useState(false);

  const shoppingTopicId = useMemo(() => {
    const record = topicRecords.find((r) => r.meta?.renderer === 'shopping');
    return record?.meta?.id ?? null;
  }, [topicRecords]);

  useEffect(() => {
    if (!activeStudentId) return;
    loadPlan(activeStudentId).then((p) => {
      if (!p) { setScreen('planner_menu'); return; }
      setPlan(p);
    });
  }, [activeStudentId]);

  useEffect(() => {
    if (!plan || !topicRecords.length) return;
    let cancelled = false;
    async function generate() {
      const planRecipes = getPlanRecipes(plan);
      const recipesWithContent = await Promise.all(
        planRecipes.map(async ({ textId, portionMultiplier }) => {
          for (const record of topicRecords) {
            if (record.meta?.renderer !== 'reading') continue;
            const text = (record.texts ?? []).find((t) => t.id === textId);
            if (!text?.file) continue;
            const content = await getRawRecipeTxt(record.meta.id, text.file);
            if (!content) continue;
            return { textId, content, portionMultiplier };
          }
          return null;
        })
      );
      if (cancelled) return;
      const valid = recipesWithContent.filter(Boolean);
      setShoppingList(generateShoppingList(valid, PANTRY_ITEMS));
    }
    generate();
    return () => { cancelled = true; };
  }, [plan, topicRecords]);

  async function handleSend() {
    if (!plan) return;
    setSending(true);
    setSendError(null);
    try {
      await sendPlanToStudent(plan.studentId, plan);
      setSent(true);
    } catch (err) {
      setSendError(err?.message ?? 'Ошибка отправки');
    } finally {
      setSending(false);
    }
  }

  async function handlePushToShopping() {
    if (!shoppingList || !shoppingTopicId) return;
    setPushing(true);
    try {
      const items = shoppingList
        .filter((i) => i.include)
        .map((i) => {
          const qty = i.qty != null ? Math.round(i.qty * 10) / 10 : null;
          return qty != null
            ? `${i.product} ${qty}${i.unit ? ' ' + i.unit : ''}`
            : i.product;
        });

      if (!items.length) return;

      let customData = await getShoppingCustomData(shoppingTopicId);
      if (!customData) customData = { categories: [] };

      // Replace the planner category (keep all other custom categories)
      const filtered = customData.categories.filter((c) => c.id !== 'planner_menu');
      const plannerCat = {
        id: 'planner_menu',
        name: 'Из меню',
        icon: '📋',
        subgroups: [{ name: null, items }],
      };
      await saveShoppingCustomData(shoppingTopicId, {
        ...customData,
        categories: [plannerCat, ...filtered],
      });

      // Mark all planner items as planned
      const savedPlan = await getShoppingPlan(shoppingTopicId);
      const newPlan = { ...savedPlan };
      items.forEach((_, ii) => { newPlan[`Из меню_${ii}`] = true; });
      await saveShoppingPlan(shoppingTopicId, newPlan);

      setPushed(true);
    } catch (e) {
      console.error('Shopping push error:', e);
    } finally {
      setPushing(false);
    }
  }

  if (!plan) return <div className="screen screen-center">Загрузка…</div>;

  return (
    <div className="screen planner-screen">
      <div className="planner-header">
        <button className="planner-header__back" onClick={() => setScreen('planner_menu')}>←</button>
        <h1 className="planner-header__title">
          Меню{student ? ` для ${student.name}` : ''}
        </h1>
      </div>

      <div className="planner-body">
        <PlanDaySummary plan={plan} topicRecords={topicRecords} />
        {shoppingList ? (
          <ShoppingListPreview items={shoppingList} />
        ) : (
          <div className="planner-loading">Формирую список покупок…</div>
        )}
      </div>

      <div className="planner-footer">
        {/* Shopping push */}
        {shoppingTopicId && (
          pushed ? (
            <div className="shopping-push-success">✓ Добавлено в «Список покупок»</div>
          ) : (
            <button
              className="shopping-push-btn"
              disabled={pushing || !shoppingList}
              onClick={handlePushToShopping}
            >
              {pushing ? 'Отправляем…' : '🛒 Добавить в Список покупок'}
            </button>
          )
        )}

        {/* Send to student */}
        {sent ? (
          <div className="planner-sent">✓ Отправлено ученику</div>
        ) : (
          <>
            {sendError && (
              <div style={{ color: 'red', fontSize: 13, marginBottom: 8, textAlign: 'center' }}>
                {sendError}
              </div>
            )}
            <Button
              fullWidth
              disabled={sending || !shoppingList}
              onClick={handleSend}
              style={{ marginTop: 8 }}
            >
              {sending ? 'Отправляем…' : 'Отправить ученику →'}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
