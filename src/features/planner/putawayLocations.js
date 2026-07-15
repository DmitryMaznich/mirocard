// defaultPhoto is a generic stock photo shown until the family photographs
// their own version of that zone (PlannerPutawayScreen's long-press flow).
export const ZONES = [
  { id: 'freezer', label: 'Морозилка', icon: '❄️', defaultPhoto: '/zone-media/freezer.webp' },
  { id: 'fridge', label: 'Холодильник', icon: '🧊', defaultPhoto: '/zone-media/fridge.webp' },
  { id: 'pantry', label: 'Шкаф', icon: '🌾', defaultPhoto: '/zone-media/pantry.webp' },
  { id: 'veg', label: 'Место для овощей', icon: '🥔', defaultPhoto: '/zone-media/veg.webp' },
  { id: 'chem', label: 'Шкаф бытовой химии', icon: '🧹', defaultPhoto: '/zone-media/chem.webp' },
  { id: 'table', label: 'Стол', icon: '🍎', defaultPhoto: '/zone-media/table.webp' },
];

// Default zone per shopping.txt category. Most items in a category really
// do share one real-world storage spot, so most products need no override —
// see PRODUCT_ZONE_OVERRIDES below for the handful that don't.
const CATEGORY_DEFAULT_ZONE = {
  'Овощи': 'fridge',
  'Фрукты': 'table',
  'Ягоды': 'fridge',
  'Зелень': 'fridge',
  'Бакалея': 'pantry',
  'Мясо': 'freezer',
  'Рыба': 'freezer',
  'Гастрономия': 'fridge',
  'Напитки': 'pantry',
  'Молочные продукты': 'fridge',
  'Бытовая химия': 'chem',
  'Сладости': 'pantry',
  'Хлебобулочные изделия': 'pantry',
  'Консервы': 'pantry',
  'Заморозка': 'freezer',
  'Товары для животных': 'pantry',
};

// Exact-match (not substring) overrides for products whose category default
// is wrong for that specific product — e.g. root vegetables that keep at
// room temperature, unlike the rest of "Овощи". Exact match on purpose: a
// substring check would make "зелёный лук" incorrectly inherit "лук" -> veg.
const PRODUCT_ZONE_OVERRIDES = {
  'картошка': 'veg',
  'лук': 'veg',
  'чеснок': 'veg',
  'капуста': 'veg',
  'мороженое': 'freezer',
};

export function getZoneForProduct(categoryName, productName, overrides = {}) {
  const norm = productName.trim().toLowerCase();
  if (overrides[norm]) return overrides[norm];
  if (PRODUCT_ZONE_OVERRIDES[norm]) return PRODUCT_ZONE_OVERRIDES[norm];
  return CATEGORY_DEFAULT_ZONE[categoryName] ?? null;
}

// Merges a family's zone customizations (renamed labels + added zones) into
// the base ZONES list. Base zone ids/icons never change — only the label can
// be overridden — so callers that key off `id` (getZoneForProduct, the
// hardcoded overrides above) are unaffected by anything done here.
export function getEffectiveZones(customizations = {}) {
  const renamed = customizations.renamed ?? {};
  const added = customizations.added ?? [];
  const base = ZONES.map((z) => ({ ...z, label: renamed[z.id] ?? z.label }));
  return [...base, ...added];
}
