// Static id → category map. Catalog decks don't carry a category field of
// their own yet, so this mirrors what TopicCatalogScreen used to hardcode.
// New decks need an entry here or they fall into OTHER_CATEGORY.
export const CATALOG_CATEGORIES = {
  letter_writing:           "Чтение",
  propis:                   "Чтение",
  reading_dad_poems:        "Чтение",
  reading_dad_instructions: "Чтение",
  sentence_puzzle:          "Чтение",
  vowel_consonant_ru:       "Чтение",
  magnetic_alphabet:        "Чтение",
  comparison:               "Математика",
  math_houses:              "Математика",
  addition_subtraction:     "Математика",
  column_addition:          "Математика",
  emotions_v2:              "Словарный запас",
  people_names:             "Словарный запас",
  clothes_basic:            "Словарный запас",
  verbs_v2:                 "Словарный запас",
  transport_photo:          "Словарный запас",
  opposites:                "Словарный запас",
  tools_functions:          "Словарный запас",
  word_formation_soup:      "Словарный запас",
  first_then:               "Практика",
  shopping_list:            "Практика",
  coffee:                   "Практика",
  chat_with_mom:            "Практика",
};

export const OTHER_CATEGORY = "Другое";
export const CATEGORY_ORDER = ["Чтение", "Математика", "Словарный запас", "Практика"];

export function getTopicCategory(topicId) {
  return CATALOG_CATEGORIES[topicId] ?? OTHER_CATEGORY;
}

export const STATUS_BADGES = {
  beta:         { label: "БЕТА",  className: "topic-tile__badge--beta" },
  experimental: { label: "ЭКСП.", className: "topic-tile__badge--experimental" },
};

// Cover glyph + gradient per category — a consistent icon system standing in
// for per-topic cover art, which doesn't exist for most decks.
export const CATEGORY_STYLE = {
  "Чтение":          { icon: "reading",  cls: "topic-tile-row--lit" },
  "Математика":      { icon: "math",     cls: "topic-tile-row--math" },
  "Словарный запас": { icon: "vocab",    cls: "topic-tile-row--voc" },
  "Практика":        { icon: "practice", cls: "topic-tile-row--prac" },
  [OTHER_CATEGORY]:  { icon: "generic",  cls: "topic-tile-row--prac" },
};
