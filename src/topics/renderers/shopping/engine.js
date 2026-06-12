export function generateTasks(mode, topicRecord) {
  const text =
    (topicRecord.texts ?? []).find((t) => t.kind === "shopping_v2") ??
    topicRecord.texts?.[0] ??
    null;
  if (!text) return [];
  return [{ type: mode.type, text }];
}
