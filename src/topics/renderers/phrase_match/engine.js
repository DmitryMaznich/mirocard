import { shuffle } from "@/shared/utils/shuffle";

export function generateTasks(mode, topicRecord, params = {}) {
  if (mode.type !== "match") return [];
  const groups = topicRecord.groups ?? [];
  return shuffle(groups).map(group => ({
    type:    "match",
    groupId: group.id,
    items:   group.items,
    images:  shuffle([
      ...group.items.map(item => ({ id: item.id, image: item.image, isDistractor: false })),
      ...(group.distractors ?? []).map(d => ({ id: d.id, image: d.image, isDistractor: true })),
    ]),
  }));
}
