import { useState } from "react";

function HouseTask({ task, onCorrect, onIncorrect }) {
  const [answered, setAnswered] = useState(false);
  const options = Array.from({ length: task.number + 1 }, (_, i) => i);

  function handleOption(value) {
    if (answered) return;
    setAnswered(true);
    if (value === task.answer) onCorrect(task.conceptId, null);
    else                       onIncorrect(task.conceptId, null);
  }

  return (
    <div className="house-body">
      <div className="house-roof">
        <div className="house-number">{task.number}</div>
      </div>
      <div className="house-rooms">
        {task.pairs.map(([left, right], idx) => (
          <div key={idx} className="house-row">
            {idx === task.hiddenPairIndex && task.hiddenSide === "left"
              ? <button className="house-cell house-cell--hidden" onClick={() => handleOption(left)}>
                  {answered ? left : "?"}
                </button>
              : <div className="house-cell">{left}</div>
            }
            <div className="house-divider" />
            {idx === task.hiddenPairIndex && task.hiddenSide === "right"
              ? <button className="house-cell house-cell--hidden" onClick={() => handleOption(right)}>
                  {answered ? right : "?"}
                </button>
              : <div className="house-cell">{right}</div>
            }
          </div>
        ))}
      </div>
      {!answered && (
        <div className="house-options">
          {options.map((n) => (
            <button key={n} className="house-option-btn" onClick={() => handleOption(n)}>
              {n}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function HouseRead({ task, onAdvance }) {
  return (
    <button className="session-full-tap" onClick={onAdvance}>
      <div className="house-body">
        <div className="house-roof"><div className="house-number">{task.number}</div></div>
        <div className="house-rooms">
          {task.pairs.map(([left, right], idx) => (
            <div key={idx} className="house-row">
              <div className="house-cell">{left}</div>
              <div className="house-divider" />
              <div className="house-cell">{right}</div>
            </div>
          ))}
        </div>
      </div>
    </button>
  );
}

export default function MathHousesRenderer({ task, topicId, onCorrect, onIncorrect, onAdvance }) {
  if (task?.type === "math_houses_read") {
    return <HouseRead task={task} onAdvance={onAdvance} />;
  }
  return <HouseTask task={task} onCorrect={onCorrect} onIncorrect={onIncorrect} />;
}
