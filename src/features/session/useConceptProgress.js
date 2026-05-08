import { useAppStore } from "@/core/store";

// scope: optional modeId — when provided, only sessions for that mode are counted.
// This gives per-mode mastery levels (e.g. find_n level vs question_answer level).
export function computeConceptLevel(sessions, studentId, topicId, conceptId, scope = null) {
  const relevant = sessions
    .filter((s) => s.studentId === studentId && s.topicId === topicId)
    .filter((s) => !scope || s.modeId === scope)
    .filter((s) => s.conceptIds?.includes(conceptId))
    .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
    .slice(0, 6);

  if (relevant.length === 0) return 0;

  const hasError = (s) => s.mistakes?.some((m) => m.conceptId === conceptId) ?? false;
  const noErrorCount = relevant.filter((s) => !hasError(s)).length;

  const last3 = relevant.slice(0, 3);
  if (last3.length >= 3 && last3.every((s) => !hasError(s))) return 3;
  if (noErrorCount >= 2) return 2;
  return 1;
}

export function computeProgressAfterSession(allSessions, completedSession) {
  const result = {};
  for (const conceptId of completedSession.conceptIds ?? []) {
    result[conceptId] = computeConceptLevel(
      allSessions,
      completedSession.studentId,
      completedSession.topicId,
      conceptId
    );
  }
  return result;
}

export function useConceptProgress(studentId, topicId) {
  const sessions = useAppStore((s) => s.sessions);

  function getLevel(conceptId) {
    return computeConceptLevel(sessions, studentId, topicId, conceptId);
  }

  return { getLevel };
}
