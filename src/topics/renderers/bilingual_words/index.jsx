import PairTask from "./PairTask";
import FindTask from "./FindTask";
import ListenAllTask from "./ListenAllTask";
import "./bilingual_words.css";

export default function BilingualWordsRenderer({ task, topicId, playTopicFile, onAdvance, onCorrect, onStreakReset }) {
  switch (task?.type) {
    case "bw_pair":
      return <PairTask task={task} topicId={topicId} playTopicFile={playTopicFile} onAdvance={onAdvance} />;
    case "bw_find":
      return <FindTask task={task} topicId={topicId} playTopicFile={playTopicFile} onCorrect={onCorrect} onStreakReset={onStreakReset} />;
    case "bw_listen_all":
      return <ListenAllTask task={task} topicId={topicId} playTopicFile={playTopicFile} onAdvance={onAdvance} />;
    default:
      return <div className="screen-center">Неизвестный тип: {task?.type}</div>;
  }
}
