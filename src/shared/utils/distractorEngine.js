import { shuffle } from "./shuffle";

function sharedTagCount(conceptA, conceptB) {
  const tagsA = new Set(conceptA.primary?.tags ?? []);
  const tagsB = conceptB.primary?.tags ?? [];
  return tagsB.filter((t) => tagsA.has(t)).length;
}

function usesSemanticGroups(semantic) {
  return Boolean(semantic) && (semantic.group1 != null || semantic.group2 != null || semantic.group3 != null);
}

// Matching group1/group2/group3 axes (e.g. emotions_v2's valence/arousal/
// expression) is a finer-grained confusability signal than a flat tag list:
// two concepts sharing only "negative" (group1) read as equally "hard" as
// two sharing negative+low-arousal+facial-expression under plain tags, even
// though the second pair is the one a child actually mixes up (shame vs
// sadness, not shame vs anger). Returns null when either card does not use
// these axes, so callers fall back to sharedTagCount unchanged. A topic whose
// cards carry an unrelated semantic shape (e.g. people_names' `{ age,
// category }`) must not be silently scored as having zero shared axes.
function semanticMatchCount(conceptA, conceptB) {
  const semA = conceptA.primary?.semantic;
  const semB = conceptB.primary?.semantic;
  if (!usesSemanticGroups(semA) || !usesSemanticGroups(semB)) return null;
  let matches = 0;
  if (semA.group1 != null && semA.group1 === semB.group1) matches++;
  if (semA.group2 != null && semA.group2 === semB.group2) matches++;
  if (semA.group3 != null && semA.group3 === semB.group3) matches++;
  return matches;
}

function closeness(conceptA, conceptB) {
  const semanticMatches = semanticMatchCount(conceptA, conceptB);
  return semanticMatches ?? sharedTagCount(conceptA, conceptB);
}

export function selectDistractorConceptIds(
  targetConceptId,
  concepts,
  count,
  difficulty = "medium"
) {
  const target = concepts.find((c) => c.conceptId === targetConceptId);
  const pool   = concepts.filter((c) => c.conceptId !== targetConceptId);

  if (pool.length === 0) return [];

  let ranked;
  if (difficulty === "easy") {
    const diff = pool.filter((c) => closeness(c, target) === 0);
    ranked = [...shuffle(diff), ...shuffle(pool.filter((c) => closeness(c, target) > 0))];
  } else if (difficulty === "hard") {
    const hard = pool.filter((c) => closeness(c, target) >= 2);
    ranked = [...shuffle(hard), ...shuffle(pool.filter((c) => closeness(c, target) < 2))];
  } else {
    const medium = pool.filter((c) => closeness(c, target) === 1);
    ranked = [...shuffle(medium), ...shuffle(pool.filter((c) => closeness(c, target) !== 1))];
  }

  const seen = new Set();
  const unique = ranked.filter((c) => {
    if (seen.has(c.conceptId)) return false;
    seen.add(c.conceptId);
    return true;
  });

  return unique.slice(0, count).map((c) => c.conceptId);
}
