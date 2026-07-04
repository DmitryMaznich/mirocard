export const ZONES = [
  { id: 'freezer', label: 'Морозилка', icon: '❄️' },
  { id: 'fridge', label: 'Холодильник', icon: '🧊' },
  { id: 'pantry', label: 'Шкаф', icon: '🌾' },
  { id: 'veg', label: 'Место для овощей', icon: '🥔' },
  { id: 'chem', label: 'Шкаф бытовой химии', icon: '🧹' },
  { id: 'table', label: 'Стол', icon: '🍎' },
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

export function getZoneForProduct(categoryName, productName) {
  const norm = productName.trim().toLowerCase();
  if (PRODUCT_ZONE_OVERRIDES[norm]) return PRODUCT_ZONE_OVERRIDES[norm];
  return CATEGORY_DEFAULT_ZONE[categoryName] ?? null;
}
