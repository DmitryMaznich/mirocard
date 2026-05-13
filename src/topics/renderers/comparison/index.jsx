import "./comparison.css";
import CompareVisual      from "./CompareVisual";
import CompareWithNumber  from "./CompareWithNumber";
import CompareNumbers     from "./CompareNumbers";
import CompareSign        from "./CompareSign";
import CompareEqual       from "./CompareEqual";
import CompareFirstNumber from "./CompareFirstNumber";
import CompareDrawSign    from "./CompareDrawSign";
import ComparePutSign     from "./ComparePutSign";
import CompareEvaluate    from "./CompareEvaluate";

const TYPE_MAP = {
  compare_visual:       CompareVisual,
  compare_with_number:  CompareVisual,
  compare_equal:        CompareVisual,
  compare_numbers:      CompareVisual,
  compare_sign:         CompareSign,
  compare_first_number: CompareFirstNumber,
  compare_draw_sign:    CompareDrawSign,
  compare_put_sign:     ComparePutSign,   // backward compat — old installed decks
  compare_evaluate:     CompareEvaluate,
};

export default function ComparisonRenderer({ task, mode, sessionStatus, onCorrect, onIncorrect, onMistake, onAdvance, playFeedback }) {
  const Component = TYPE_MAP[task?.type];
  if (!Component) return null;
  return <Component task={task} mode={mode} sessionStatus={sessionStatus} onCorrect={onCorrect} onIncorrect={onIncorrect} onMistake={onMistake} onAdvance={onAdvance} playFeedback={playFeedback} />;
}
