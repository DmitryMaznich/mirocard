import SHOPPING_TXT_EMBEDDED from '../../../content/shopping/shopping.txt?raw';
import { parseRecipeTxt } from '../../topics/renderers/reading/parseRecipeTxt.js';

export const SHOPPING_STEPS = parseRecipeTxt(SHOPPING_TXT_EMBEDDED).filter(
  (s) => s.type === 'checklist' || s.type === 'action'
);

export const CATEGORY_ICONS = {
  'Овощи': '🥦', 'Фрукты': '🍎', 'Ягоды': '🍓', 'Зелень': '🌿',
  'Бакалея': '🌾', 'Мясо': '🥩', 'Рыба': '🐟', 'Гастрономия': '🧀',
  'Напитки': '☕', 'Молочные продукты': '🥛', 'Бытовая химия': '🧹',
  'Сладости': '🍫', 'Хлебобулочные изделия': '🥐', 'Консервы': '🥫',
  'Заморозка': '❄️', 'Товары для животных': '🐾',
};

function sName(step) { return step.text.replace(/:$/, '').trim(); }
function planKey(name, ii) { return `${name}_${ii}`; }

export function buildBaseCustomData() {
  return {
    categories: SHOPPING_STEPS.map((step) => {
      const name = sName(step);
      const icon = CATEGORY_ICONS[name] ?? '📦';
      const subgroups = [];
      let curSg = null;
      let curItems = [];
      (step.items ?? []).forEach((item, ii) => {
        const sg = step.itemSubgroups?.[ii] ?? null;
        if (sg !== curSg) {
          if (curItems.length) subgroups.push({ name: curSg, items: curItems });
          curSg = sg;
          curItems = [item];
        } else {
          curItems.push(item);
        }
      });
      if (curItems.length) subgroups.push({ name: curSg, items: curItems });
      if (!subgroups.length) subgroups.push({ name: null, items: [] });
      return { id: `base_${name}`, name, icon, subgroups };
    }),
  };
}

// Maps generated shopping list items to shopping.txt categories.
// Returns { customData, plan } ready to save to planner shop storage.
export function buildPlannerShoppingData(shoppingListItems) {
  // Flat lookup: normalised string → { catName, ii (item index within category) }
  const lookup = [];
  SHOPPING_STEPS.forEach((step) => {
    const catName = sName(step);
    (step.items ?? []).forEach((item, ii) => {
      lookup.push({ norm: item.toLowerCase().trim(), catName, ii });
    });
  });

  const plan = {};
  const unmatchedItems = [];

  for (const { product, qty, unit, include } of shoppingListItems) {
    if (!include) continue;
    const prodNorm = product.toLowerCase().trim();

    let match = lookup.find((l) => l.norm === prodNorm);
    if (!match) {
      match = lookup.find((l) => prodNorm.includes(l.norm) || l.norm.includes(prodNorm));
    }
    if (!match) {
      const prodWords = prodNorm.split(/\s+/);
      match = lookup.find((l) => {
        const bw = l.norm.split(/\s+/);
        return prodWords.some((w) => w.length > 3 && bw.some((b) => b.includes(w) || w.includes(b)));
      });
    }

    const note = qty != null ? `${Math.round(qty * 10) / 10}${unit ? ' ' + unit : ''}` : '';

    if (match) {
      plan[planKey(match.catName, match.ii)] = note ? { note } : true;
    } else {
      const label = note ? `${product} ${note}` : product;
      unmatchedItems.push(label);
    }
  }

  const customData = buildBaseCustomData();

  if (unmatchedItems.length > 0) {
    const menuCat = {
      id: 'planner_menu_extras',
      name: 'Из меню',
      icon: '📋',
      subgroups: [{ name: null, items: unmatchedItems }],
    };
    customData.categories = [menuCat, ...customData.categories];
    unmatchedItems.forEach((_, ii) => { plan[planKey('Из меню', ii)] = true; });
  }

  return { customData, plan };
}

export function customDataToSteps(customData) {
  return customData.categories.map((cat) => {
    const items = [];
    const itemSubgroups = [];
    for (const sg of cat.subgroups) {
      for (const item of sg.items) {
        items.push(item);
        itemSubgroups.push(sg.name ?? null);
      }
    }
    return { type: 'checklist', text: `${cat.name}:`, items, itemSubgroups };
  });
}

/**
 * Re-applies the Дома/Купить decisions made in Меню onto an already
 * existing planned checklist, matching items by normalized product name
 * across every category. Runs every time the Покупки screen loads (not
 * just on first generation) so a decision changed in Меню after the list
 * was first built — or after custom items were added via the editor —
 * still lands in Покупки, without wiping any custom categories/items the
 * decisions don't mention.
 *
 * 'buy' checks the item only if it wasn't already checked (preserves an
 * existing note). 'have' always unchecks it, since Меню's decision
 * overrides whatever was manually toggled in Покупки before.
 *
 * @param {Array<{text: string, items: string[]}>} steps
 * @param {object} planned
 * @param {Object<string, 'have'|'buy'>} ingredientDecisions
 */
export function applyDecisionsToPlanned(steps, planned, ingredientDecisions) {
  const next = { ...planned };
  for (const step of steps) {
    const catName = step.text.replace(/:$/, '').trim();
    (step.items ?? []).forEach((item, ii) => {
      const decision = ingredientDecisions[item.toLowerCase().trim()];
      if (!decision) return;
      const key = `${catName}_${ii}`;
      if (decision === 'buy') {
        if (!next[key]) next[key] = true;
      } else if (decision === 'have') {
        delete next[key];
      }
    });
  }
  return next;
}
