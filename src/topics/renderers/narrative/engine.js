const isSceneCard    = (c) => c.params?.kind === "scene"    || (!!(c.image || c.imageUrl) && !c.params?.spine);
const isScenarioCard = (c) => c.params?.kind === "scenario" || (!!(c.params?.spine)         && !(c.image || c.imageUrl));

export function generateTasks(mode, topicRecord, sessionParams, selectedConceptIds = []) {
  const allCards = topicRecord.cards ?? [];

  const sceneMap = Object.fromEntries(
    allCards.filter(isSceneCard).map((c) => [c.id, c])
  );

  const scenarios = allCards.filter(
    (c) =>
      isScenarioCard(c) &&
      (selectedConceptIds.length === 0 || selectedConceptIds.includes(c.conceptId ?? c.id))
  );

  return scenarios.map((scenario) => buildSequenceTask(scenario, sceneMap, sessionParams));
}

function buildSequenceTask(scenario, sceneMap, sessionParams) {
  const spine      = scenario.params?.spine    ?? [];
  const branches   = scenario.params?.branches ?? [];
  const conceptId  = scenario.conceptId ?? scenario.id;

  const branch = sessionParams?.branch ?? null;

  const sequence = spine.map((id, idx) => {
    if (id !== null) return sceneMap[id] ?? null;
    const branchDef = branches.find((b) => b.slot === idx);
    if (!branchDef) return null;
    const chosen = branch ?? branchDef.options[Math.floor(Math.random() * branchDef.options.length)];
    return sceneMap[chosen] ?? sceneMap[branchDef.options[0]] ?? null;
  }).filter(Boolean);

  return {
    type:        "story_sequence",
    conceptId,
    sequence,
    correctOrder: sequence.map((s) => s.id),
  };
}
