import { PairTask, FindTask, TrapTask, SyllableTask, WordTask, BuildTask, BlockEndTask, NeedMoreTask } from "./LetterTasks";
import "./letter_bridge.css";

const TASKS = {
  lb_pair: PairTask,
  lb_find: FindTask,
  lb_trap: TrapTask,
  lb_syll: SyllableTask,
  lb_word: WordTask,
  lb_build: BuildTask,
  lb_block_end: BlockEndTask,
  lb_need_more: NeedMoreTask,
};

export default function LetterBridgeRenderer(props) {
  const Task = TASKS[props.task?.type];
  if (!Task) return <div className="screen-center">Неизвестный тип: {props.task?.type}</div>;
  return <Task {...props} />;
}
