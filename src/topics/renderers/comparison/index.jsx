import CompareVisual      from "./CompareVisual";
import CompareWithNumber  from "./CompareWithNumber";
import CompareNumbers     from "./CompareNumbers";
import CompareSign        from "./CompareSign";
import CompareEqual       from "./CompareEqual";
import CompareFirstNumber from "./CompareFirstNumber";
import CompareDrawSign    from "./CompareDrawSign";
import ComparePutSign     from "./ComparePutSign";

const TYPE_MAP = {
  compare_visual:       CompareVisual,
  compare_with_number:  CompareVisual,   // consolidated into compare_visual
  compare_equal:        CompareVisual,   // consolidated into compare_visual
  compare_numbers:      CompareNumbers,
  compare_sign:         CompareSign,
  compare_first_number: CompareFirstNumber,
  compare_draw_sign:    CompareDrawSign,
  compare_put_sign:     ComparePutSign,
};

export default function ComparisonRenderer({ task, mode, onCorrect, onIncorrect, onAdvance }) {
  const Component = TYPE_MAP[task?.type];
  if (!Component) return null;
  return <Component task={task} mode={mode} onCorrect={onCorrect} onIncorrect={onIncorrect} onAdvance={onAdvance} />;
}
