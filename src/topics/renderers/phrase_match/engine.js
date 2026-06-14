import { shuffle } from "@/shared/utils/shuffle";

export function generateTasks(mode, topicRecord, params = {}) {
  if (mode.type !== "match") return [];
  const answerType = params.answerType ?? "image";
  const groups = topicRecord.groups ?? [];
  return shuffle(groups).map(group => ({
    type:       "match",
    groupId:    group.id,
    answerType,
    items:      group.items,
    images:     shuffle([
      ...group.items.map(item => ({
        id:          item.id,
        image:       item.image,
        text:        item.answer ?? null,
        isDistractor: false,
      })),
      ...(group.distractors ?? []).map(d => ({
        id:          d.id,
        image:       d.image,
        text:        d.text ?? null,
        isDistractor: true,
      })),
    ]),
  }));
}
