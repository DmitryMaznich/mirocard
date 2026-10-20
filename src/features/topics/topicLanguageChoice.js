import { useAppStore } from "@/core/store";
import { selectedTopicLanguage } from "../../../shared/topic-language-contract.mjs";

let sequence = 0;
export function topicLanguageForStudent(topic, state = useAppStore.getState()) {
  const student = state.students.find((s) => s.id === state.activeStudentId);
  const params = state.studentTopicLinks[`${state.activeStudentId}_${topic.meta.id}`]?.params ?? {};
  return selectedTopicLanguage(topic, params, student?.preferredLessonLanguage, state.settings.cardLanguage);
}

export function requestTopicLanguage({ entry, record, coreBuffer } = {}) {
  const state = useAppStore.getState();
  if (state.topicLanguageRequest) return Promise.resolve(null);
  return new Promise((resolve) => state.setTopicLanguageRequest({
    id: ++sequence, entry, record, coreBuffer, resolve,
    topicId: entry?.id ?? record.meta.id,
    studentId: state.activeStudentId, accountId: state.account?.id ?? null,
  }));
}
