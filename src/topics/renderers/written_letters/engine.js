import { selectDistractorConceptIds } from "@/shared/utils/distractorEngine";
import { shuffle } from "@/shared/utils/shuffle";

function toConcepts(cards) {
  return cards.map((c) => ({
    conceptId: c.conceptId ?? c.id,
    primary: { tags: c.params?.tags ?? [] },
  }));
}

function generateSortTasks(cards) {
  const sessionKey = Date.now().toString(36) + Math.random().toString(36).slice(2);
  const tasks = [];
  for (const card of cards) {
    const p = card.params;
    if (p.has_upper) {
      tasks.push({
        type: "sort_case",
        letterCase: "upper",
        correctZone: "upper",
        letter: p.printed_upper,
        sessionKey,
      });
    }
    tasks.push({
      type: "sort_case",
      letterCase: "lower",
      correctZone: "lower",
      letter: p.printed_lower,
      sessionKey,
    });
  }
  return shuffle(tasks);
}

function generateMatchPrintToWrittenTasks(cards) {
  const concepts = toConcepts(cards);
  const tasks = [];
  for (const card of cards) {
    const p = card.params;
    const cid = card.conceptId ?? card.id;

    const makeTasks = (targetCase) => {
      const targetLetter = targetCase === "upper" ? p.printed_upper : p.printed_lower;
      const distractorIds = selectDistractorConceptIds(cid, concepts, 3, "medium");
      const distractors = distractorIds.map((did) => {
        const dc = cards.find((c) => (c.conceptId ?? c.id) === did);
        if (!dc) return null;
        const dCase = targetCase === "upper" && dc.params.has_upper ? "upper" : "lower";
        return {
          id: did,
          letter: dCase === "upper" ? dc.params.printed_upper : dc.params.printed_lower,
          letterCase: dCase,
          isTarget: false,
        };
      }).filter(Boolean);
      tasks.push({
        type: "match_print_to_written",
        stimulus: { printed: targetLetter, letterCase: targetCase },
        options: shuffle([{ id: cid, letter: targetLetter, letterCase: targetCase, isTarget: true }, ...distractors]),
      });
    };

    if (p.has_upper) makeTasks("upper");
    makeTasks("lower");
  }
  return shuffle(tasks);
}

function generateMatchWrittenToPrintTasks(cards) {
  const concepts = toConcepts(cards);
  const tasks = [];
  for (const card of cards) {
    const p = card.params;
    const cid = card.conceptId ?? card.id;

    const makeTask = (targetCase) => {
      const targetLetter = targetCase === "upper" ? p.printed_upper : p.printed_lower;
      const distractorIds = selectDistractorConceptIds(cid, concepts, 3, "medium");
      const distractors = distractorIds.map((did) => {
        const dc = cards.find((c) => (c.conceptId ?? c.id) === did);
        if (!dc) return null;
        const dCase = targetCase === "upper" && dc.params.has_upper ? "upper" : "lower";
        return {
          id: did,
          printed: dCase === "upper" ? dc.params.printed_upper : dc.params.printed_lower,
          letterCase: dCase,
          isTarget: false,
        };
      }).filter(Boolean);
      tasks.push({
        type: "match_written_to_print",
        stimulus: { letter: targetLetter, letterCase: targetCase },
        options: shuffle([{ id: cid, printed: targetLetter, letterCase: targetCase, isTarget: true }, ...distractors]),
      });
    };

    if (p.has_upper) makeTask("upper");
    makeTask("lower");
  }
  return shuffle(tasks);
}

function generateMatchPairTasks(cards) {
  const withUpper  = cards.filter((c) => c.params?.has_upper);
  const concepts   = toConcepts(withUpper);
  const tasks = [];
  for (const card of withUpper) {
    const p   = card.params;
    const cid = card.conceptId ?? card.id;
    const distractorIds = selectDistractorConceptIds(cid, concepts, 3, "medium");
    const distractors   = distractorIds.map((did) => {
      const dc = withUpper.find((c) => (c.conceptId ?? c.id) === did);
      return dc ? { id: did, letter: dc.params.printed_lower, isTarget: false } : null;
    }).filter(Boolean);
    tasks.push({
      type: "match_pair",
      stimulus: { letter: p.printed_upper, printed: p.printed_upper },
      options: shuffle([{ id: cid, letter: p.printed_lower, isTarget: true }, ...distractors]),
    });
  }
  return shuffle(tasks);
}

export function generateTasks(modeOrType, cards) {
  const modeType = typeof modeOrType === "string" ? modeOrType : modeOrType?.type;
  switch (modeType) {
    case "sort_case":              return generateSortTasks(cards);
    case "match_print_to_written": return generateMatchPrintToWrittenTasks(cards);
    case "match_written_to_print": return generateMatchWrittenToPrintTasks(cards);
    case "match_pair":             return generateMatchPairTasks(cards);
    default: return [];
  }
}
