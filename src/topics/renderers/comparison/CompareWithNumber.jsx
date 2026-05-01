import DotGroup from "./DotGroup";

export default function CompareWithNumber({ task, mode, onCorrect, onIncorrect }) {
  const leftBigger = task.left > task.right;
  return (
    <div className="compare-body">
      <div className="compare-instruction">{mode.ui.instruction}</div>
      <div className="compare-sides">
        <button className="compare-side"
          onClick={() => leftBigger
            ? onCorrect(task.conceptId, null)
            : onIncorrect(task.conceptId, null)}>
          <DotGroup count={task.left} color="#4299e1" />
          <div className="compare-number">{task.left}</div>
        </button>
        <button className="compare-equal-btn" style={{ alignSelf: "center" }}
          onClick={() => task.left === task.right
            ? onCorrect(task.conceptId, null)
            : onIncorrect(task.conceptId, null)}>
          =
        </button>
        <button className="compare-side"
          onClick={() => !leftBigger
            ? onCorrect(task.conceptId, null)
            : onIncorrect(task.conceptId, null)}>
          <DotGroup count={task.right} color="#fc8181" />
          <div className="compare-number">{task.right}</div>
        </button>
      </div>
    </div>
  );
}
