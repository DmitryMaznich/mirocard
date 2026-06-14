import { shuffle } from "@/shared/utils/shuffle";

export function generateTasks(mode, topicRecord) {
  if (mode.type !== "match") return [];
  const groups = topicRecord.groups ?? [];
  return shuffle(groups).map(group => ({
    type:    "match",
    groupId: group.id,
    items:   group.items,
    answers: shuffle(group.items.map(item => ({
      id:   item.id,
      text: item.answer,
    }))),
  }));
}
