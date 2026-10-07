import { shuffle } from "@/shared/utils/shuffle";

const ENDINGS = { "ая": "какая?", "яя": "какая?", "ое": "какое?", "ее": "какое?", "ые": "какие?", "ие": "какие?" };
const cap = text => text ? text[0].toUpperCase() + text.slice(1) : text;

export function adjectiveText(phrase = "") {
  return phrase.trim().split(/\s+/)[0];
}

export function questionFor(phrase) {
  return ENDINGS[adjectiveText(phrase).slice(-2)] ?? "какой?";
}

export function choiceCount(value) {
  return [2, 3, 4].includes(Number(value)) ? Number(value) : 2;
}

// Only real, distinct adjectives. Stored legacy "hard" preferences no longer
// introduce invented or misspelled words into the teaching material.
export function buildWordOptions(card, pool, count = 2) {
  const target = adjectiveText(card.adjPhrase);
  const q = card.questionText ?? questionFor(card.adjPhrase);
  const candidates = pool.filter(c => (c.questionText ?? questionFor(c.adjPhrase)) === q);
  const preferred = shuffle(candidates.filter(c => c.category === card.category));
  const fallback = shuffle(candidates.filter(c => c.category !== card.category));
  const seen = new Set([target]);
  const distractors = [];
  for (const candidate of [...preferred, ...fallback]) {
    const text = adjectiveText(candidate.adjPhrase);
    if (!text || text.includes("\uFFFD") || seen.has(text)) continue;
    seen.add(text);
    distractors.push({ text, isTarget: false });
    if (distractors.length >= choiceCount(count) - 1) break;
  }
  return shuffle([{ text: target, isTarget: true }, ...distractors]);
}

export function buildWordQuestion(card, params = {}) {
  const q = card.questionText ?? questionFor(card.adjPhrase);
  const context = card.contextPhrase?.trim().replace(/[.!?]+$/, "");
  // Context is part of the condition, not an optional hint (especially weather
  // and seasons). Text-only tasks always keep their source phrase.
  const noun = (card.nounPhrase ?? "").trim();
  const prompt = params.askForWord
    ? `${cap(noun)}. ${cap(q.replace("?", ""))} ${noun.split(/\s+/)[0].toLowerCase()}?`
    : cap(noun);
  return context ? `${cap(context)}. ${prompt}` : prompt;
}

export function seasonalWordCards(cards) {
  return cards.filter(c => c.items?.length).flatMap(season => season.items.map(item => ({
    id: `${season.id}:${item.id}`,
    conceptId: season.conceptId ?? season.id,
    category: "seasons",
    nounPhrase: item.adjPhrase.trim().split(/\s+/).slice(1).join(" "),
    adjPhrase: item.adjPhrase,
    contextPhrase: season.contextPhrase,
    ingredientImage: item.image,
    questionText: questionFor(item.adjPhrase),
    difficulty: "easy",
  })));
}

export function buildSeasonFormOptions(phrase, count = 2) {
  const adjective = adjectiveText(phrase);
  const ending = adjective.slice(-2);
  const soft = ["ий", "яя", "ее", "ие"].includes(ending);
  const endings = soft ? ["ий", "яя", "ее", "ие"] : ["ый", "ая", "ое", "ые"];
  if (ending === "ой") endings[0] = "ой";
  const wrong = shuffle(endings.filter(end => end !== ending)).slice(0, choiceCount(count) - 1);
  return shuffle([ending, ...wrong].map(end => ({ key: end, ending: end, isTarget: end === ending })));
}

export function modelAnswer(card) {
  return card.adjPhrase.trim().includes(" ") ? card.adjPhrase : `${card.adjPhrase} ${card.nounPhrase.toLowerCase()}`;
}

