export function generateTasks(mode, topicRecord, sessionParams) {
  if (mode.type === "story_sequence") {
    return [buildSequenceTask(mode, topicRecord, sessionParams)];
  }
  return [];
}

function buildSequenceTask(mode, topicRecord, sessionParams) {
  const scenario = mode.scenario;
  if (!scenario) return { type: "story_sequence", sequence: [], correctOrder: [] };

  // Build scene map from cards (imageUrl already resolved by importTopic)
  const sceneMap = Object.fromEntries(
    (topicRecord.cards ?? []).map((card) => [
      card.id,
      {
        id:      card.id,
        caption: card.label ?? card.params?.caption ?? {},
        image:   card.imageUrl ?? card.image ?? "",
        audio:   card.params?.audioId ? `audio/${card.params.audioId}.mp3` : "",
      },
    ])
  );

  const branch = sessionParams?.branch
    ?? scenario.branches?.[0]?.options[Math.floor(Math.random() * (scenario.branches?.[0]?.options?.length ?? 1))];

  const sequence = (scenario.spine ?? []).map((id, idx) => {
    if (id !== null) return sceneMap[id] ?? null;
    const branchDef = scenario.branches?.find((b) => b.slot === idx);
    if (!branchDef) return null;
    const chosen = branch ?? branchDef.options[0];
    return sceneMap[chosen] ?? sceneMap[branchDef.options[0]] ?? null;
  }).filter(Boolean);

  return {
    type:         "story_sequence",
    sequence,
    correctOrder: sequence.map((s) => s.id),
  };
}
