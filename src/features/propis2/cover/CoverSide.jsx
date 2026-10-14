import CoverTemplate from "./CoverTemplate.jsx";
import CoverBack from "./CoverBack.jsx";
import { useCoverTasks } from "./coverTasks.js";

// One side of a notebook's cover with the engine tasks it needs: the front or the back. `notebook`: {title, a4, topicRecord}.
export default function CoverSide({ side, cover, notebook }) {
  const { title, a4, topicRecord } = notebook;
  const tasks = useCoverTasks({ topicRecord, cover, format: a4 ? "a4" : "a5", side });
  return side === "back"
    ? <CoverBack cover={cover} back={tasks.back} a4={a4} />
    : <CoverTemplate cover={cover} title={title} tasks={tasks} a4={a4} />;
}
