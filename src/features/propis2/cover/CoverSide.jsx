import CoverTemplate from "./CoverTemplate.jsx";
import CoverBack from "./CoverBack.jsx";
import { useCoverTasks } from "./coverTasks.js";
import { coverStamp, spinePaperOf } from "./coverConfig.js";
import { bookletPageCount } from "@/topics/renderers/propis/booklet.js";

// One side of a notebook's cover with the engine tasks it needs: the front or the back. `notebook`: {title, a4, topicRecord, paper,
// pages, booklet} — `paper` the grid kind of its first page (the spine's paper when the cover says "as in the notebook"), `pages` its
// page count and `booklet` whether it is printed «Тетрадью» (the padding pages are leaves too) for the number of leaves on the back.
export default function CoverSide({ side, cover, notebook }) {
  const { title, a4, topicRecord, paper, pages = 0, booklet = false } = notebook;
  const tasks = useCoverTasks({ topicRecord, cover, format: a4 ? "a4" : "a5", side, spinePaper: spinePaperOf(cover, paper) });
  const leaves = Math.ceil((booklet && !a4 ? bookletPageCount(pages) : pages) / 2);
  return side === "back"
    ? <CoverBack cover={cover} back={tasks.back} spineTask={tasks.spineTask} leaves={pages > 0 ? leaves : 0} a4={a4} words={coverStamp(topicRecord)} />
    : <CoverTemplate cover={cover} title={title} tasks={tasks} a4={a4} words={coverStamp(topicRecord)} />;
}
