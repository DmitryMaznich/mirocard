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
  // Explicit rows of 5 (1/2/3 rows for the 5/10/15 options) instead of
  // leaving a single flex-wrap row to break wherever the screen width
  // happens to allow — keeps the "5" grouping visible and the layout the
  // same on every screen size, not just whichever count fits per line.
  const rows = [];
  for (let start = 0; start < starsTarget; start += 5) rows.push(start);
  return (
    <div className="operation-stage operation-stage--manual">
      <div className={`operation-manual__stars-rows${starsTarget > 5 ? " operation-manual__stars-rows--compact" : ""}`}>
        {rows.map((start) => (
          <div key={start} className="operation-manual__stars">
            {Array.from({ length: 5 }, (_, j) => {
              const i = start + j;
              return (
                <span
                  key={i}
                  className={`operation-manual__star${i < litCount ? " operation-manual__star--lit" : ""}`}
                >★</span>
              );
            })}
          </div>
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
