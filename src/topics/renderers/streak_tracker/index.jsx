// Reuses the shared "Серия для видеонаграды" selector every other topic
// already has (answersPerStar 1/2/3, labeled 5/10/15 in ParamsScreen.jsx)
// instead of a topic-specific param. SessionHeader's own compact bar stays
// fixed at 5 stars with a scaled (2-per-star at "10", 3 at "15") reading —
// untouched, that's its own separate display. This one shows the real
// target itself as individual stars (5*answersPerStar — 5, 10, or 15,
// matching the option one-to-one) and lights exactly one per correct
// answer, so the count on screen always equals the option chosen.
export default function StreakTrackerRenderer({ task, onCorrect, onIncorrect, streakCount = 0, answersPerStar = 1 }) {
  if (!task) return null;
  const starsTarget = 5 * answersPerStar;
  const litCount = Math.min(starsTarget, streakCount);
  return (
    <div className="operation-stage operation-stage--manual">
      <div className={`operation-manual__stars${starsTarget > 5 ? " operation-manual__stars--compact" : ""}`}>
        {Array.from({ length: starsTarget }, (_, i) => (
          <span
            key={i}
            className={`operation-manual__star${i < litCount ? " operation-manual__star--lit" : ""}`}
          >★</span>
        ))}
      </div>
      <div className="operation-manual__btns">
        <button
          type="button"
          className="operation-manual__btn operation-manual__btn--wrong"
          onClick={() => onIncorrect(task.conceptId, task.cardId)}
          aria-label="Неверно"
        >✗</button>
        <button
          type="button"
          className="operation-manual__btn operation-manual__btn--correct"
          onClick={() => onCorrect(task.conceptId, task.cardId)}
          aria-label="Верно"
        >✓</button>
      </div>
    </div>
  );
}
