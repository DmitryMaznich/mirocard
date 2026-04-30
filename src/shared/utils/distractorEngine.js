import { shuffle } from "./shuffle";

function sharedTagCount(conceptA, conceptB) {
  const tagsA = new Set(conceptA.primary?.tags ?? []);
  const tagsB = conceptB.primary?.tags ?? [];
  return tagsB.filter((t) => tagsA.has(t)).length;
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
    const diff = pool.filter((c) => sharedTagCount(c, target) === 0);
    ranked = [...shuffle(diff), ...shuffle(pool.filter((c) => sharedTagCount(c, target) > 0))];
  } else if (difficulty === "hard") {
    const hard = pool.filter((c) => sharedTagCount(c, target) >= 2);
    ranked = [...shuffle(hard), ...shuffle(pool.filter((c) => sharedTagCount(c, target) < 2))];
  } else {
    const medium = pool.filter((c) => sharedTagCount(c, target) === 1);
    ranked = [...shuffle(medium), ...shuffle(pool.filter((c) => sharedTagCount(c, target) !== 1))];
  }

  const seen = new Set();
  const unique = ranked.filter((c) => {
    if (seen.has(c.conceptId)) return false;
    seen.add(c.conceptId);
    return true;
  });

  return unique.slice(0, count).map((c) => c.conceptId);
}
