// Reuses the shared "Серия для видеонаграды" selector every other topic
// already has (answersPerStar 1/2/3, labeled 5/10/15 in ParamsScreen.jsx)
// instead of a topic-specific param — same target math as everywhere else
// (5*answersPerStar), just rendered as that many stars instead of a
// hardcoded 5, so choosing "10" or "15" there actually changes what's shown
// here too.
export default function StreakTrackerRenderer({ task, onCorrect, onIncorrect, streakCount = 0, answersPerStar = 1 }) {
  if (!task) return null;
  const starsTarget = 5 * answersPerStar;
  // While the reward-video prompt is up, useSessionEngine.js reports
  // streakCount as the sentinel value answersPerStar*5 instead of the
  // real (already-reset-to-0) count — written for the header's own
  // fixed 5-star bar, where floor(sentinel/answersPerStar) conveniently
  // equals 5. Our own star count isn't fixed at 5, so dividing that same
  // sentinel would only fill answersPerStar*5/answersPerStar = 5 of our
  // (possibly larger) starsTarget stars — recognize the sentinel
  // explicitly and show every star lit instead.
  const litCount = streakCount === answersPerStar * 5
    ? starsTarget
    : Math.min(starsTarget, Math.floor(streakCount / answersPerStar));
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
