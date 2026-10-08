import { useMemo } from "react";
import { buildPageTask } from "@/topics/renderers/propis2/pageTask.js";
import { newRow, pageFormat, rowToLine, rowsPerPage, taskGrid } from "@/topics/renderers/propis2/model.js";
import { digitsOut } from "@/topics/renderers/propis2/fieldText.js";
import { backContent, backPaper } from "./backContent.js";
import { coverTitle } from "./coverConfig.js";

// The engine tasks a cover draws (in our own hand, on our own paper), each built only when what it depends on changes: switching the
// decoration or the colour builds nothing, the back is built again only when the back changes.
const WIDE = { narrowRows: false, grid: "regular", midDash: true, margin: "off" };
// the share of the page height the ruling of the back takes (CoverBack: the heading above it, the logo below)
const BACK_SHARE = 0.8;
// the decoration band of copybook elements: one element, its copies solid along the row
const ELEMENTS_BAND = rowToLine(newRow({ kind: "element", text: "заборчик", repeat: "all", dots: "none", copies: "solid" }));

// `side`: "front" | "back" | "both" — only that side's tasks are built
export function useCoverTasks({ topicRecord, cover, notebookTitle, format, side = "both" }) {
  const front = side !== "back";
  const fmt = format === "a4" ? "a4" : "a5";
  const name = coverTitle(cover, notebookTitle);
  const cursive = front && cover.enabled && cover.title.style === "cursive";
  // the name written once on the WIDE ruling (large, like the title line of the printed copybooks), no start dots
  const titleTask = useMemo(
    () => (cursive ? buildPageTask({ topicRecord, lines: [rowToLine(newRow({ text: digitsOut(name), repeat: "one", dots: "none" }))], ...WIDE, format: fmt }) : null),
    [cursive, name, topicRecord, fmt],
  );
  const decor = front && cover.enabled ? cover.decor : "none";
  const bandTask = useMemo(() => (decor === "ruling-band" ? buildPageTask({ topicRecord, lines: [], ...WIDE, format: fmt }) : null), [decor, topicRecord, fmt]);
  const elementsTask = useMemo(() => (decor === "elements-band" ? buildPageTask({ topicRecord, lines: [ELEMENTS_BAND], ...WIDE, format: fmt }) : null), [decor, topicRecord, fmt]);
  const backKind = side !== "front" && cover.enabled ? cover.back.kind : "none";
  const backPaperId = cover.back.paper;
  const back = useMemo(() => {
    const content = backContent(backKind);
    if (!content) return null;
    const paper = backPaper(backPaperId, fmt);
    const task = buildPageTask({ topicRecord, lines: content.lines, narrowRows: true, grid: taskGrid(paper), midDash: true, margin: "off", format: pageFormat(paper) });
    // the back is a whole page of its paper under the heading (as the backs of the printed series): the rows that fit above the logo
    const fit = Math.floor(rowsPerPage(paper) * BACK_SHARE);
    return { ...content, task, fit: Math.max(fit, content.rows), square: backPaperId === "square" };
  }, [backKind, backPaperId, topicRecord, fmt]);
  return { titleTask, bandTask, elementsTask, back };
}
