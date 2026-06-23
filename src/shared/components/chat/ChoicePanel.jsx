export default function ChoicePanel({ choices, disabledChoices, showHint, onChoice }) {
  if (!choices) return null;

  const hasCorrectFlag = choices.some((c) => "correct" in c);

  return (
    <div className="chat-choice-panel">
      <div className="chat-choice-panel__hint">
        {showHint ? "Попробуй ещё раз" : ""}
      </div>
      {choices.map((choice) => {
        const isDisabled = disabledChoices.has(choice.text);
        const isHinted   = showHint && hasCorrectFlag && choice.correct === true && !isDisabled;
        return (
          <button
            key={choice.text}
            className={[
              "chat-choice-btn",
              isDisabled ? "chat-choice-btn--disabled" : "",
              isHinted   ? "chat-choice-btn--hint"     : "",
            ].filter(Boolean).join(" ")}
            onClick={() => !isDisabled && onChoice(choice)}
            disabled={isDisabled}
          >
            {choice.text}
          </button>
        );
      })}
    </div>
  );
}
