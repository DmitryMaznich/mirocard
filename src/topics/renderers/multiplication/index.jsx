// «Умножение» (multiplication) renderer. Modes = steps 0–3 of the ladder in
// docs/multiplication-methodology.md. Every lesson string comes from the pinned content
// package on the task (task.messages); nothing here reads the interface language.
// In-task mistakes go through onStreakReset (counts the mistake, keeps the renderer): onMistake would bump
// taskRetry, which remounts the renderer and wipes what the child has already done in the task.
import "./multiplication.css";
import EqualCheck from "./EqualCheck.jsx";
import MakeEqual from "./MakeEqual.jsx";
import SkipCount from "./SkipCount.jsx";
import SumToProduct from "./SumToProduct.jsx";
import { lessonLanguage, rootStyle } from "./lesson.js";

const MODES = { equal_check: EqualCheck, make_equal: MakeEqual, skip_count: SkipCount, sum_to_product: SumToProduct };

export default function Multiplication(props) {
  const Mode = MODES[props.task?.type ?? props.mode?.type];
  if (!Mode) throw new Error("Unsupported multiplication mode");
  return (
    <div className="mul-root" style={rootStyle} lang={lessonLanguage(props.task)}>
      <Mode {...props} />
    </div>
  );
}
