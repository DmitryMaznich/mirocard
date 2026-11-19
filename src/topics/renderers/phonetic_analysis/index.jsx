import "./phonetic_analysis.css";
import SchemeTask from "./SchemeTask";
import LottoTask from "./LottoTask";
import LottoReverseTask from "./LottoReverseTask";
import MissingTask from "./MissingTask";
import { FindLetterTask, FindAllTask, NeedMoreTask } from "./LetterGames";

const TASKS = {
  pa_scheme: SchemeTask,
  pa_lotto: LottoTask,
  pa_lotto_reverse: LottoReverseTask,
  pa_missing: MissingTask,
  pa_find_letter: FindLetterTask,
  pa_find_all: FindAllTask,
  pa_need_more: NeedMoreTask,
};

export default function PhoneticAnalysisRenderer(props) {
  const Task = TASKS[props.task?.type];
  if (!Task) return <div className="screen-center">Неизвестный тип задания: {props.task?.type}</div>;
  return <Task key={props.task.taskId ?? JSON.stringify(props.task).slice(0, 80)} {...props} />;
}
