const NEXT_DIFFICULTY = {
  starter: "reinforce",
  reinforce: "challenge",
};

const SUCCESS_PERCENT = 80;
const REQUIRED_SESSIONS = 3;

// Figure levels are an adult-facing planning aid, not a lock. A suggestion
// appears only after three recent, successful sessions in this exact mode and
// level; a difficult attempt therefore naturally postpones the next prompt.
export function getFigureDifficultyRecommendation(sessions, {
  studentId,
  topicId,
  modeId,
  difficulty,
}) {
  const nextDifficulty = NEXT_DIFFICULTY[difficulty];
  if (!nextDifficulty) return null;

  const recent = sessions
    .filter((session) => (
      session.studentId === studentId
      && session.topicId === topicId
      && session.modeId === modeId
      && session.paramsSnapshot?.figureDifficulty === difficulty
    ))
    .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
    .slice(0, REQUIRED_SESSIONS);

  const isSuccessful = (session) => (
    typeof session.percentCorrect === "number"
    && session.percentCorrect >= SUCCESS_PERCENT
  );

  if (recent.length !== REQUIRED_SESSIONS || !recent.every(isSuccessful)) return null;

  return { nextDifficulty, successfulSessions: REQUIRED_SESSIONS };
}
