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

// Three-tier fuzzy match, shared by first-generation (buildPlannerShoppingData)
// and re-sync (syncDecisionsIntoShoppingData below): exact normalized string,
// then substring either direction, then any shared word longer than 3 chars.
export function findFuzzyMatch(lookup, prodNorm) {
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
  return match;
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
    const match = findFuzzyMatch(lookup, prodNorm);
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

// Hub "done" badge for Покупки: everything planned has also been marked
// bought in В магазине, and there was at least one planned item.
export function isShoppingDone(planned, bought) {
  const keys = Object.keys(planned ?? {});
  return keys.length > 0 && keys.every((k) => bought?.[k]);
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

function buildCustomDataLookup(customData) {
  const lookup = [];
  customData.categories.forEach((cat) => {
    let ii = 0;
    cat.subgroups.forEach((sg) => {
      sg.items.forEach((item) => {
        lookup.push({ norm: item.toLowerCase().trim(), catName: cat.name, ii });
        ii++;
      });
    });
  });
  return lookup;
}

// Splices out the item at a category's flat index (spanning all its
// subgroups) — same mechanism CategoryEditor's manual item deletion already
// uses, including its accepted limitation that later items in the same
// category shift down by one index.
function removeItemAtFlatIndex(category, flatIndex) {
  let idx = flatIndex;
  for (const sg of category.subgroups) {
    if (idx < sg.items.length) { sg.items.splice(idx, 1); return; }
    idx -= sg.items.length;
  }
}

function addMenuExtraItem(customData, label) {
  let menuCat = customData.categories.find((c) => c.id === 'planner_menu_extras');
  if (!menuCat) {
    menuCat = { id: 'planner_menu_extras', name: 'Из меню', icon: '📋', subgroups: [{ name: null, items: [] }] };
    customData.categories.unshift(menuCat);
  }
  if (!menuCat.subgroups.length) menuCat.subgroups.push({ name: null, items: [] });
  menuCat.subgroups[0].items.push(label);
}

/**
 * Re-syncs Меню's Дома/Купить decisions into an already-existing shopping
 * list. Runs every time the Покупки screen loads (not just on first
 * generation), so a decision changed in Меню after the list was first
 * built — or after a recipe was added to or removed from the menu — still
 * lands in Покупки:
 *
 * - matched + 'buy': checks it (unless already checked — preserves an
 *   existing note), and records its key as menu-managed.
 * - matched + 'have', item is in the "Из меню" catch-all: removes the item
 *   from the category entirely (it only existed because of the decision).
 * - matched + 'have', item is a normal (shopping.txt-derived) category item:
 *   just unchecks it — it's a permanent list fixture, not removed.
 * - no match + 'buy': adds a new item to "Из меню" (creating that category
 *   if needed, via the same fuzzy-match cascade first generation uses),
 *   checks it, and records its key as menu-managed.
 * - no match + 'have': nothing to do, it never existed.
 *
 * After processing every current ingredient, reconciles against `menuKeys`
 * (the menu-managed keys from the *previous* sync): any key that was
 * menu-managed before but isn't menu-managed this time — its ingredient's
 * recipe left the menu entirely, so it never even appears in
 * `ingredientItems` this pass — gets cleaned up the same way an explicit
 * "Дома" decision would. A manually-checked item (napkins, anything not
 * tied to a recipe) is never in `menuKeys` to begin with, so reconciliation
 * never touches it.
 *
 * Never touches custom categories/items the decisions don't mention.
 *
 * @param {object} customData
 * @param {object} planned
 * @param {string[]} menuKeys - planKey's the menu managed as of the last sync
 * @param {Array<{product: string, qty: number|null, unit: string|null}>} ingredientItems
 * @param {Object<string, 'have'|'buy'>} ingredientDecisions
 * @returns {{ customData: object, planned: object, menuKeys: string[] }}
 */
export function syncDecisionsIntoShoppingData(customData, planned, menuKeys, ingredientItems, ingredientDecisions) {
  const nextCustomData = JSON.parse(JSON.stringify(customData));
  const nextPlanned = { ...planned };
  const nextMenuKeys = new Set();

  for (const item of ingredientItems) {
    const prodNorm = item.product.toLowerCase().trim();
    const decision = ingredientDecisions[prodNorm];
    if (!decision) continue;

    const lookup = buildCustomDataLookup(nextCustomData);
    const match = findFuzzyMatch(lookup, prodNorm);

    if (match) {
      const key = planKey(match.catName, match.ii);
      if (decision === 'buy') {
        if (!nextPlanned[key]) nextPlanned[key] = true;
        nextMenuKeys.add(key);
      } else if (match.catName === 'Из меню') {
        const menuCat = nextCustomData.categories.find((c) => c.id === 'planner_menu_extras');
        if (menuCat) removeItemAtFlatIndex(menuCat, match.ii);
        delete nextPlanned[key];
      } else {
        delete nextPlanned[key];
      }
    } else if (decision === 'buy') {
      const note = item.qty != null ? `${Math.round(item.qty * 10) / 10}${item.unit ? ' ' + item.unit : ''}` : '';
      const label = note ? `${item.product} ${note}` : item.product;
      addMenuExtraItem(nextCustomData, label);
      const newLookup = buildCustomDataLookup(nextCustomData);
      const added = newLookup.find((l) => l.catName === 'Из меню' && l.norm === label.toLowerCase().trim());
      if (added) {
        const key = planKey(added.catName, added.ii);
        nextPlanned[key] = true;
        nextMenuKeys.add(key);
      }
    }
  }

  // Reconcile: a key the menu managed last time but doesn't need this time
  // (its ingredient's recipe was removed from the menu entirely, or dropped
  // out for any other reason) gets cleaned up the same way an explicit
  // "Дома" decision would.
  const menuExtrasRemovals = [];
  for (const oldKey of menuKeys) {
    if (nextMenuKeys.has(oldKey)) continue;
    const sep = oldKey.lastIndexOf('_');
    const catName = oldKey.slice(0, sep);
    const ii = Number(oldKey.slice(sep + 1));
    if (catName === 'Из меню') {
      menuExtrasRemovals.push(ii);
    }
    delete nextPlanned[oldKey];
  }
  if (menuExtrasRemovals.length) {
    const menuCat = nextCustomData.categories.find((c) => c.id === 'planner_menu_extras');
    if (menuCat) {
      // Descending order so removing one doesn't shift the flat index of
      // another item still pending removal in this same pass.
      menuExtrasRemovals.sort((a, b) => b - a);
      for (const ii of menuExtrasRemovals) removeItemAtFlatIndex(menuCat, ii);
    }
  }

  return { customData: nextCustomData, planned: nextPlanned, menuKeys: Array.from(nextMenuKeys) };
}
