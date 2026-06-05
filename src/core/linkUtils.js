import { getDb, kv } from "@/core/db";
import { useAppStore } from "@/core/store";
import { pushOp } from "@/core/syncApi";

export async function persistStudentTopicLink(studentId, topicId, patch) {
  if (!studentId || !topicId) return;
  useAppStore.getState().upsertStudentTopicLink(studentId, topicId, patch);
  const updatedLinks = useAppStore.getState().studentTopicLinks;
  const db = await getDb();
  await kv.set(db, "studentTopicLinks", updatedLinks);
  const key = `${studentId}_${topicId}`;
  const link = updatedLinks[key] ?? {};
  pushOp("student_topic_link.upsert", {
    id: link.id ?? key,
    studentId,
    topicId,
    selectedConceptIds: link.selectedConceptIds ?? [],
    selectionMode:      link.selectionMode ?? "auto",
    repsPerConcept:     link.repsPerConcept ?? 1,
    params:             link.params ?? {},
    videoRewardEnabled: link.videoRewardEnabled ?? true,
    rewardThreshold:    link.rewardThreshold ?? 90,
    deckPosition:       link.deckPosition ?? 0,
  });
}
