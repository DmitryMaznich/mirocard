export const EMOTIONS_TOPIC_ID = "emotions_v2";

// The depicted child belongs to the picture, not to the concept or to the
// first portrait. Keep the lookup for decks and session snapshots installed
// before the cards carried gender in their own manifest.
const GIRLS = new Set([
  "joy_2", "sadness_2", "anger_1", "fear_2", "surprise_1", "surprise_3",
  "disgust_2", "calm_2", "boredom_2", "shame_2", "tiredness_2",
  "situation_joy_2", "situation_sadness_1", "situation_sadness_3",
  "situation_anger_1", "situation_anger_3", "situation_fear_2", "situation_fear_3",
  "situation_surprise_1", "situation_surprise_2", "situation_disgust_1",
  "situation_disgust_2", "situation_disgust_3", "situation_calm_2",
  "situation_boredom_2", "situation_shame_3", "situation_tiredness_2",
]);

const BOYS = new Set([
  "joy_1", "joy_3", "sadness_1", "sadness_3", "anger_2", "anger_3",
  "fear_1", "fear_3", "surprise_2", "disgust_1", "disgust_3",
  "calm_1", "calm_3", "boredom_1", "boredom_3", "shame_1", "shame_3",
  "tiredness_1", "tiredness_3", "situation_joy_1", "situation_joy_3",
  "situation_sadness_2", "situation_anger_2", "situation_fear_1", "situation_surprise_3",
  "situation_calm_1", "situation_calm_3", "situation_boredom_1", "situation_boredom_3",
  "situation_shame_1", "situation_shame_2", "situation_tiredness_1", "situation_tiredness_3",
]);

const AUTO_SCENES = new Set([
  "situation_joy_1", "situation_joy_2", "situation_sadness_1", "situation_sadness_2",
  "situation_anger_1", "situation_anger_3", "situation_fear_1", "situation_fear_2",
  "situation_surprise_1", "situation_surprise_2", "situation_disgust_2", "situation_disgust_3",
]);
const DISCUSSION_SCENES = new Set([
  "situation_calm_1", "situation_calm_3", "situation_boredom_1", "situation_boredom_2", "situation_boredom_3",
  "situation_tiredness_1", "situation_tiredness_2", "situation_tiredness_3", "situation_shame_3",
]);

export function emotionCardGender(card) {
  if (card?.gender === "female" || card?.gender === "male") return card.gender;
  const pictureId = (card?.sceneImage ?? card?.image)?.split("/").at(-1)
    ?.replace(/\.webp$/i, "").replace(/^portrait_/, "").replace(/_v2$/, "");
  const id = pictureId ?? card?.id;
  if (GIRLS.has(id)) return "female";
  if (BOYS.has(id)) return "male";
  return null;
}

export function emotionSceneUse(card) {
  if (AUTO_SCENES.has(card.id)) return "auto";
  if (DISCUSSION_SCENES.has(card.id)) return "discussion";
  return "deferred";
}

const PROMPTS = {
  joy: ["радуется", "весело", "радость"],
  sadness: ["грустит", "грустно", "грусть"],
  anger: ["злится", "сердито", "злость"],
  fear: ["боится", "страшно", "страх"],
  surprise: ["удивляется", null, "удивление"],
  disgust: ["чувствует отвращение", "противно", "отвращение"],
  calm: [null, "спокойно", "спокойствие"],
  boredom: ["скучает", "скучно", "скука"],
  shame: [null, "стыдно", "стыд"],
  tiredness: [null, null, "усталость"],
};

export function emotionPrompt(kind, conceptId, gender, fallback) {
  if (kind === "name") {
    if (gender === "female") return "Что она чувствует?";
    if (gender === "male") return "Что он чувствует?";
    return "Что чувствует ребёнок?";
  }
  const id = conceptId ?? Object.keys(PROMPTS).find((key) => PROMPTS[key][2] === fallback)
    ?? (fallback === "скуку" ? "boredom" : null);
  const [verb, state, noun] = PROMPTS[id] ?? [null, null, fallback];
  if (kind === "yesNo") {
    const subject = gender === "female" ? "Она" : gender === "male" ? "Он" : "Ребёнок";
    const indirect = gender === "female" ? "Ей" : gender === "male" ? "Ему" : "Ребёнку";
    if (id === "tiredness") {
      if (gender === "female") return "Она устала?";
      if (gender === "male") return "Он устал?";
      return "Ребёнок утомился?";
    }
    if (verb) return `${subject} ${verb}?`;
    if (state) return `${indirect} ${state}?`;
    return `Это ${noun}?`;
  }
  if (kind === "where") {
    if (["joy", "anger"].includes(conceptId)) return `Где ребёнок ${verb}?`;
    if (conceptId === "surprise") return "Где ребёнок удивился?";
    if (state) return `Где ребёнку ${state}?`;
    return verb ? `Где ребёнок ${verb}?` : "На какой картинке это видно?";
  }
  const all = kind === "all";
  if (["sadness", "fear", "disgust", "calm", "boredom", "shame"].includes(conceptId)) {
    return all ? `Найди всех, кому ${state}` : `Покажи, кому ${state}`;
  }
  if (conceptId === "tiredness") return all ? "Найди всех, кто устал" : "Покажи, кто устал";
  if (verb) return all ? `Найди всех, кто ${verb}` : `Покажи, кто ${verb}`;
  return all ? `Найди все: ${noun}` : `Покажи: ${noun}`;
}

export function alignEmotionMode(mode) {
  if (!mode.params) return mode;
  const params = { ...mode.params };
  if (mode.id === "find_n" && params.optionCount) params.optionCount = { ...params.optionCount, default: 2 };
  if (mode.id === "question_answer" && params.optionCount) {
    params.optionCount = { ...params.optionCount, values: [3, 4, 6, 8, 10], default: 3 };
  }
  const scoredScene = mode.id === "situation_emotion" || mode.id === "emotion_situation";
  if (scoredScene) delete params.optionCount;
  return { ...mode, params, paramsScope: "mode", ...(scoredScene ? { legacyUnscopedSelection: true } : {}) };
}
