// Star count and per-star cost both come from this mode's own "Количество
// звёзд" param (5/10/15) — not the shared "Серия для видеонаграды" selector
// other topics use. useSessionEngine.js translates starsTarget into the
// answersPerStar it hands the session engine ((N/5)²), so streakCount here
// already runs from 0 up to N²/5 (the real total needed to light every
// star) before it resets — see that file for the derivation.
export default function StreakTrackerRenderer({ task, onCorrect, onIncorrect, streakCount = 0, sessionParams }) {
  if (!task) return null;
  const starsTarget = [5, 10, 15].includes(Number(sessionParams?.starsTarget)) ? Number(sessionParams.starsTarget) : 5;
  const perStar = starsTarget / 5;
  const litCount = Math.min(starsTarget, Math.floor(streakCount / perStar));
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
