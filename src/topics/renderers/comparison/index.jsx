import "./comparison.css";
import CompareVisual      from "./CompareVisual";
import CompareSign        from "./CompareSign";
import CompareFirstNumber from "./CompareFirstNumber";
import CompareDrawSign    from "./CompareDrawSign";
import ComparePutSign     from "./ComparePutSign";
import CompareEvaluate    from "./CompareEvaluate";
import CompareApply       from "./CompareApply";
import CompareRealLife    from "./CompareRealLife";
import PlaceHint          from "./PlaceHint";

const TYPE_MAP = {
  compare_visual:       CompareVisual,
  compare_with_number:  CompareVisual, // backward compat — old installed decks, pre-consolidation mode type
  compare_equal:        CompareVisual, // backward compat — old installed decks, pre-consolidation mode type
  compare_numbers:      CompareVisual, // backward compat — old installed decks, pre-consolidation mode type
  compare_sign:         CompareSign,
  compare_first_number: CompareFirstNumber, // "5. Сравни первое и второе" — its own mode again as of v2.11.0, previously folded into compare_evaluate's "first_number" question
  compare_draw_sign:    CompareDrawSign,
  compare_put_sign:     ComparePutSign,   // backward compat — old installed decks
  compare_evaluate:     CompareEvaluate,
  compare_apply:        CompareApply,
  compare_real_life:    CompareRealLife,
};

export default function ComparisonRenderer({ task, mode, sessionStatus, taskRetry = 0, onCorrect, onIncorrect, onMistake, onStreakReset, onAdvance, playFeedback }) {
  const Component = TYPE_MAP[task?.type];
  if (!Component) return null;
  const component = <Component task={task} mode={mode} sessionStatus={sessionStatus} onCorrect={onCorrect} onIncorrect={onIncorrect} onMistake={onMistake} onStreakReset={onStreakReset} onAdvance={onAdvance} playFeedback={playFeedback} />;
  // Level 5 «По разрядам»: the second try of a pair comes with the numbers by places.
  if (!task.placeHint || taskRetry < 1) return component;
  return <div className="cmp-with-place-hint">{component}<PlaceHint left={task.left} right={task.right} /></div>;
}
