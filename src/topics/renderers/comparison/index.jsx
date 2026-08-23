import "./comparison.css";
import CompareVisual      from "./CompareVisual";
import CompareSign        from "./CompareSign";
import CompareFirstNumber from "./CompareFirstNumber";
import CompareDrawSign    from "./CompareDrawSign";
import ComparePutSign     from "./ComparePutSign";
import CompareEvaluate    from "./CompareEvaluate";

const TYPE_MAP = {
  compare_visual:       CompareVisual,
  compare_with_number:  CompareVisual, // backward compat — old installed decks, pre-consolidation mode type
  compare_equal:        CompareVisual, // backward compat — old installed decks, pre-consolidation mode type
  compare_numbers:      CompareVisual, // backward compat — old installed decks, pre-consolidation mode type
  compare_sign:         CompareSign,
  compare_first_number: CompareFirstNumber, // backward compat — old installed decks, superseded by compare_evaluate's "first_number" question
  compare_draw_sign:    CompareDrawSign,
  compare_put_sign:     ComparePutSign,   // backward compat — old installed decks
  compare_evaluate:     CompareEvaluate,
};

export default function ComparisonRenderer({ task, mode, sessionStatus, onCorrect, onIncorrect, onMistake, onAdvance, playFeedback }) {
  const Component = TYPE_MAP[task?.type];
  if (!Component) return null;
  return <Component task={task} mode={mode} sessionStatus={sessionStatus} onCorrect={onCorrect} onIncorrect={onIncorrect} onMistake={onMistake} onAdvance={onAdvance} playFeedback={playFeedback} />;
}
