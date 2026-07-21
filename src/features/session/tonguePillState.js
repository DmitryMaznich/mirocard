export function getTonguePillState({ isDrawerOpen, answerStatus, hasUndonePlanItems }) {
  if (isDrawerOpen) return { mode: "open", pulse: false };
  if (answerStatus === "answer_correct") return { mode: "correct", pulse: false };
  if (answerStatus === "answer_incorrect") return { mode: "incorrect", pulse: false };
  return { mode: "idle", pulse: !!hasUndonePlanItems };
}
