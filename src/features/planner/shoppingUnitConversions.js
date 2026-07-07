/**
 * Product → purchase-conversion rules for the Покупки shopping list.
 *
 * Recipes record ingredients in cooking-friendly units (cups, spoons,
 * whole vegetables). None of that means anything at a store, so this
 * table maps each such product to a canonical weight/volume factor
 * (`gramsPerUnit`) plus a purchase rounding rule (`roundStepG`/`minG`).
 *
 * Products already recorded in `гр`/`мл` in recipes don't need
 * `gramsPerUnit` — their raw quantity already is the canonical amount.
 */
export const SHOPPING_UNIT_CONVERSIONS = {
  'картошка': { gramsPerUnit: { 'шт': 150 }, roundStepG: 500, minG: 500 },
  'лук': { gramsPerUnit: { 'шт': 100 }, roundStepG: 500, minG: 500 },
  'морковь': { gramsPerUnit: { 'шт': 80 }, roundStepG: 500, minG: 500 },
  'куриная грудка': { gramsPerUnit: { 'шт': 300 }, roundStepG: 500, minG: 500 },
  'куриные бёдра': { gramsPerUnit: { 'шт': 150 }, roundStepG: 500, minG: 500 },
  'куриные крылья': { gramsPerUnit: { 'шт': 80 }, roundStepG: 500, minG: 500 },
  'куриные голени': { gramsPerUnit: { 'шт': 120 }, roundStepG: 500, minG: 500 },
  'голени': { gramsPerUnit: { 'шт': 120 }, roundStepG: 500, minG: 500 },
  'гречка': { gramsPerUnit: { 'стакан': 210 }, roundStepG: 100, minG: 100 },
  'рис': { gramsPerUnit: { 'стакан': 200 }, roundStepG: 500, minG: 500 },
  'макароны': { gramsPerUnit: { 'стакан': 100, 'ст.л': 10 }, roundStepG: 100, minG: 100 },
  'овсяные хлопья': { gramsPerUnit: { 'стакан': 90 }, roundStepG: 100, minG: 100 },
  'замороженные ягоды': { gramsPerUnit: { 'горсть': 80 }, roundStepG: 100, minG: 100 },
  'клубника': { gramsPerUnit: { 'горсть': 100 }, roundStepG: 100, minG: 100 },
  'малина': { gramsPerUnit: { 'горсть': 70 }, roundStepG: 100, minG: 100 },
  'ежевика': { gramsPerUnit: { 'горсть': 70 }, roundStepG: 100, minG: 100 },
  'молоко': { gramsPerUnit: { 'стакан': 200 }, roundStepG: 500, minG: 500, buyUnit: 'мл' },
  'сливки 20%': { gramsPerUnit: { 'ст.л': 15 }, roundStepG: 100, minG: 100, buyUnit: 'мл' },
  'сыр твёрдый': { roundStepG: 50, minG: 50 },
  'фарш': { roundStepG: 500, minG: 500 },
  'колбаса': { roundStepG: 100, minG: 100 },
  'кофейные зёрна': { roundStepG: 250, minG: 250 },
  'креветки': { roundStepG: 100, minG: 100 },
};

/**
 * Products measured in ст.л/ч.л purely for cooking (seasoning, oils,
 * pantry staples). A single recipe's dose is 1–5% of how these are sold
 * (a whole bag/bottle/jar), so no gram target is meaningful — the
 * shopping list shows them as a bare checkbox, never a quantity.
 */
export const NO_SHOPPING_QTY_PRODUCTS = new Set([
  'соль', 'специи', 'масло растительное', 'масло сливочное', 'масло оливковое',
  'сахар', 'мёд', 'какао', 'бальзамический уксус', 'мука', 'тмин',
]);

// Units that are always bought as a whole count — fractional amounts get
// rounded up (you can't buy half an onion, a quarter bunch of parsley,
// or 1.5 jars of sour cream).
const DISCRETE_UNITS = new Set(['шт', 'пачка', 'банка', 'упаковка', 'пучок', 'веточка', 'зуб', 'горсть']);

/** Whether `unit` is a whole-count unit (see DISCRETE_UNITS above). */
export function isDiscreteUnit(unit) {
  return DISCRETE_UNITS.has(unit);
}

function lookup(product) {
  return SHOPPING_UNIT_CONVERSIONS[product.toLowerCase()];
}

/**
 * Converts one ingredient's qty (in its recipe unit) to the canonical
 * weight/volume basis (grams, or мл when the product's entry says so).
 * Used while aggregating the same product across multiple recipes, so
 * that the sum is always in one consistent unit regardless of which
 * cooking unit each individual recipe happened to use.
 *
 * Returns the input unchanged when there's nothing to convert: no qty,
 * no table entry for this product, or no factor for this specific unit
 * (which also covers values already given in г/мл — those have no
 * factor key and are already canonical).
 */
export function toCanonicalQty(product, qty, unit) {
  if (qty == null || unit == null) return { qty, unit };
  const entry = lookup(product);
  if (!entry || !entry.gramsPerUnit) return { qty, unit };
  const factor = entry.gramsPerUnit[unit];
  if (factor == null) return { qty, unit };
  return { qty: qty * factor, unit: entry.buyUnit === 'мл' ? 'мл' : 'г' };
}

/**
 * Given an aggregated qty+unit (already canonical grams/мл when the
 * product has a SHOPPING_UNIT_CONVERSIONS entry with gramsPerUnit, or
 * still a raw recipe unit otherwise), returns a purchase-friendly
 * quantity — rounded up to the product's purchase step, formatted in
 * г/кг or мл/л. Discrete units (шт, пачка, ...) just round up to a
 * whole number regardless of any table entry. Returns null when there's
 * nothing sensible to show (no qty, or an unknown non-discrete unit
 * with no conversion entry) — the caller falls back to its own default.
 */
export function toShoppingQuantity(product, qty, unit) {
  if (qty == null) return null;
  if (DISCRETE_UNITS.has(unit)) {
    return { qty: Math.ceil(qty), unit };
  }
  const entry = lookup(product);
  if (!entry) return null;
  let grams = qty;
  if (entry.gramsPerUnit && entry.gramsPerUnit[unit] != null) {
    grams = qty * entry.gramsPerUnit[unit];
  } else if (unit !== 'г' && unit !== 'мл') {
    return null;
  }
  const rounded = Math.max(Math.ceil(grams / entry.roundStepG) * entry.roundStepG, entry.minG);
  const bigUnit = entry.buyUnit === 'мл' ? 'л' : 'кг';
  const smallUnit = entry.buyUnit === 'мл' ? 'мл' : 'г';
  if (rounded >= 1000) {
    return { qty: Math.round((rounded / 1000) * 10) / 10, unit: bigUnit };
  }
  return { qty: rounded, unit: smallUnit };
}
