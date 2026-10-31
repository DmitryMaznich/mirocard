import { useCallback } from "react";
import { useAppStore } from "@/core/store";
import { persistStudentTopicLink } from "@/core/linkUtils";
import { deckLanguages, pickLanguage } from "@/topics/renderers/propis2/languages.js";

// The student's writing language in a `propis2` deck that carries several (propis2/languages.js): `writingLang` in the student-topic
// params, the one synced object every mode of the topic shares (topicUtils.js readModeParams), so the constructor and the letter cards
// write the same language. A deck without languages: { languages: null } and nothing is stored.
export function useWritingLang(record) {
  const studentId = useAppStore((s) => s.activeStudentId);
  const topicId = record?.meta?.id;
  const link = useAppStore((s) => s.studentTopicLinks?.[`${studentId}_${topicId}`]);
  const languages = deckLanguages(record);
  const lang = pickLanguage(record, link?.params?.writingLang);
  const setLang = useCallback((id) => {
    if (!languages || !studentId || !topicId) return;
    const params = useAppStore.getState().studentTopicLinks?.[`${studentId}_${topicId}`]?.params ?? {};
    persistStudentTopicLink(studentId, topicId, { params: { ...params, writingLang: id } });
  }, [languages, studentId, topicId]);
  return { languages, lang, setLang };
}
