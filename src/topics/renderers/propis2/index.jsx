import PrintPageView from "../propis/PrintPageView";
import { buildPageTask } from "./pageTask.js";

// Student-facing page. The builder (adult mode) is a separate screen, so this renderer only
// shows the page and its tap-to-animate samples.
export default function Propis2Renderer({ task, topicRecord, onClose }) {
  if (!task) return null;
  return <PrintPageView task={buildPageTask({ topicRecord, lines: task.lines })} onClose={onClose} />;
}
