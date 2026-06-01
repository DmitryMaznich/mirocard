import { shuffle } from "@/shared/utils/shuffle";

function groupByObjectId(cards) {
  const map = new Map();
  for (const card of cards) {
    if (!map.has(card.objectId)) map.set(card.objectId, { left: null, right: null });
    const entry = map.get(card.objectId);
    if (card.pole === "left")       entry.left  = card;
    else if (card.pole === "right") entry.right = card;
  }
  return map;
}

function generateIntroTasks(cards) {
  const byObject = groupByObjectId(cards);
  const tasks = [];
  for (const [, { left, right }] of byObject) {
    if (left)  tasks.push({ type: "intro", card: left });
    if (right) tasks.push({ type: "intro", card: right });
  }
  return tasks;
}

function generatePairComparisonTasks(cards, params) {
  const showLabels = params.showLabels ?? true;
  const byObject = groupByObjectId(cards);
  const pairs = [];
  for (const [, { left, right }] of byObject) {
    if (!left || !right) continue;
    pairs.push({ leftCard: left, rightCard: right });
  }
  if (!pairs.length) return [];
  return [{ type: "pair_comparison", pairs: shuffle(pairs), showLabels }];
}

function buildChooseTwoTask(target, sameObjOpposite, allEntries, optionCount) {
  const options = [{ card: target, isTarget: true }, { card: sameObjOpposite, isTarget: false }];
  if (optionCount > 2) {
    const others = shuffle(allEntries.filter(([oid]) => oid !== target.objectId));
    for (const [, { left, right }] of others.slice(0, optionCount - 2)) {
      const distractor = target.pole === "left" ? right : left;
      if (distractor) options.push({ card: distractor, isTarget: false });
    }
  }
  return {
    type:             "choose_two",
    targetPole:       target.pole,
    poleLabelNeutral: target.poleLabelNeutral,
    options:          shuffle(options.slice(0, optionCount)),
  };
}

function generateChooseTwoTasks(cards, params) {
  const repsPerPair = params.repsPerPair ?? 1;
  const byObject    = groupByObjectId(cards);
  const entries     = [...byObject.entries()];
  const tasks       = [];
  for (const [, { left, right }] of entries) {
    if (!left || !right) continue;
    // Each rep = 1 task. Randomise pole order so both get asked when repsPerPair >= 2.
    const poles = shuffle([left, right]);
    for (let i = 0; i < Math.min(repsPerPair, 2); i++) {
      const target   = poles[i];
      const opposite = target === left ? right : left;
      tasks.push(buildChooseTwoTask(target, opposite, entries, 2));
    }
  }
  return shuffle(tasks);
}

function buildConceptZones(conceptCards) {
  const left  = conceptCards.filter(c => c.pole === "left");
  const right = conceptCards.filter(c => c.pole === "right");
  if (!left.length || !right.length) return null;
  const zL = `${left[0].conceptId}_left`;
  const zR = `${left[0].conceptId}_right`;
  return {
    zones: [
      { id: zL, label: left[0].poleLabel },
      { id: zR, label: right[0].poleLabel },
    ],
    cards: shuffle([
      ...left.map(card  => ({ card, targetZoneId: zL })),
      ...right.map(card => ({ card, targetZoneId: zR })),
    ]),
  };
}

function groupByConcept(cards) {
  const map = new Map();
  for (const card of cards) {
    if (!map.has(card.conceptId)) map.set(card.conceptId, []);
    map.get(card.conceptId).push(card);
  }
  return map;
}

function generateSortL1Tasks(cards) {
  const byConcept = groupByConcept(cards);
  const tasks = [];
  for (const [, conceptCards] of byConcept) {
    const built = buildConceptZones(conceptCards);
    if (!built) continue;
    tasks.push({ type: "sort", ...built });
  }
  return shuffle(tasks);
}

function generateSortL2Tasks(cards, params) {
  const cardsPerConcept = params.cardsPerConcept ?? 4;
  const byConcept = groupByConcept(cards);
  const conceptIds = [...byConcept.keys()];
  const tasks = [];
  for (let i = 0; i + 1 < conceptIds.length; i += 2) {
    const aCards = byConcept.get(conceptIds[i]);
    const bCards = byConcept.get(conceptIds[i + 1]);
    const aL = aCards.filter(c => c.pole === "left");
    const aR = aCards.filter(c => c.pole === "right");
    const bL = bCards.filter(c => c.pole === "left");
    const bR = bCards.filter(c => c.pole === "right");
    if (!aL.length || !aR.length || !bL.length || !bR.length) continue;
    const half = Math.ceil(cardsPerConcept / 2);
    const zAL = `${conceptIds[i]}_left`;
    const zAR = `${conceptIds[i]}_right`;
    const zBL = `${conceptIds[i+1]}_left`;
    const zBR = `${conceptIds[i+1]}_right`;
    tasks.push({
      type: "sort",
      zones: [
        { id: zAL, label: aL[0].poleLabel },
        { id: zAR, label: aR[0].poleLabel },
        { id: zBL, label: bL[0].poleLabel },
        { id: zBR, label: bR[0].poleLabel },
      ],
      cards: shuffle([
        ...shuffle(aL).slice(0, half).map(card => ({ card, targetZoneId: zAL })),
        ...shuffle(aR).slice(0, half).map(card => ({ card, targetZoneId: zAR })),
        ...shuffle(bL).slice(0, half).map(card => ({ card, targetZoneId: zBL })),
        ...shuffle(bR).slice(0, half).map(card => ({ card, targetZoneId: zBR })),
      ]),
    });
  }
  // leftover concept when odd count
  if (conceptIds.length % 2 !== 0) {
    const lastCards = byConcept.get(conceptIds[conceptIds.length - 1]);
    const built = buildConceptZones(lastCards);
    if (built) tasks.push({ type: "sort", ...built });
  }
  return shuffle(tasks);
}

function generateSortTask(cards, params) {
  const level = params.level ?? 1;
  return level === 2 ? generateSortL2Tasks(cards, params) : generateSortL1Tasks(cards);
}

function generateFindAllTasks(cards, params) {
  const gridSize   = params.gridSize ?? 6;
  const half       = Math.floor(gridSize / 2);
  const leftCards  = shuffle(cards.filter((c) => c.pole === "left"));
  const rightCards = shuffle(cards.filter((c) => c.pole === "right"));
  return [
    ["left",  leftCards,  rightCards],
    ["right", rightCards, leftCards],
  ].map(([targetPole, targets, others]) => {
    const selectedTargets = targets.slice(0, half);
    const selectedOthers  = others.slice(0, gridSize - selectedTargets.length);
    return {
      type:           "find_all",
      targetPole,
      targetLabel:    selectedTargets[0]?.poleLabelNeutral ?? selectedTargets[0]?.poleLabelPlural ?? targetPole,
      allCards:       shuffle([...selectedTargets, ...selectedOthers]),
      correctCardIds: selectedTargets.map((c) => c.id),
    };
  });
}

function generateFindOppositeTasks(cards, params) {
  const distractorCount = params.distractorCount ?? 2;
  const sameConcept     = params.sameConcept ?? false;
  const byObject        = groupByObjectId(cards);
  const tasks           = [];

  for (const [, { left, right }] of byObject) {
    if (!left || !right) continue;
    const pair     = shuffle([left, right]);
    const stimulus = pair[0];
    const correct  = pair[1];

    const distractors = sameConcept
      ? shuffle(cards.filter(c =>
          c.conceptId === stimulus.conceptId &&
          c.pole      === correct.pole       &&
          c.objectId  !== stimulus.objectId
        )).slice(0, distractorCount)
      : shuffle(cards.filter(c =>
          c.conceptId !== stimulus.conceptId
        )).slice(0, distractorCount);

    tasks.push({
      type:         "find_opposite",
      stimulusCard: stimulus,
      options:      shuffle([
        { card: correct, isTarget: true },
        ...distractors.map(c => ({ card: c, isTarget: false })),
      ]),
    });
  }

  return shuffle(tasks);
}

export function generateTasks(mode, cards, _sessionSize, params = {}) {
  switch (mode.type) {
    case "intro":           return generateIntroTasks(cards);
    case "pair_comparison": return generatePairComparisonTasks(cards, params);
    case "choose_two":      return generateChooseTwoTasks(cards, params);
    case "sort":            return generateSortTask(cards, params);
    case "find_all":        return generateFindAllTasks(cards, params);
    case "find_opposite":   return generateFindOppositeTasks(cards, params);
    default:                return [];
  }
}
