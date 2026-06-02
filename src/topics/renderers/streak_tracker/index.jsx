export default function StreakTrackerRenderer({ task, onCorrect, onIncorrect, streakCount = 0 }) {
  if (!task) return null;
  return (
    <div className="operation-stage operation-stage--manual">
      <div className="operation-manual__stars">
        {Array.from({ length: 5 }, (_, i) => (
          <span
            key={i}
            className={`operation-manual__star${i < streakCount ? " operation-manual__star--lit" : ""}`}
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
