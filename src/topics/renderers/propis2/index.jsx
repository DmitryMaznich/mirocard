import { useMemo } from "react";
import "../propis/propis.css";
import "../propis/letters/letters.css";
import "./dictation.css";
import "./letters.css";
import PrintPageView, { PrintPageTop, printPageRows } from "../propis/PrintPageView";
import DictationScreen from "./DictationScreen";
import { GlyphContext } from "../propis/letters/glyphs.js";
import MatchView from "../propis/letters/MatchView";
import MatchPairView from "../propis/letters/MatchPairView";
import SortCaseView from "../propis/letters/SortCaseView";
import { buildGlyphMap, buildPageTask } from "./pageTask.js";
import { cardGlyphs } from "./letterCards.js";
import { cardLetters, topicAlphabet } from "./alphabet.js";
import { pageToLines, newPage, newRow } from "./model.js";
import GradeStamp from "./GradeStamp.jsx";

// `propis2` in a session. The constructor is the topic's home screen (src/features/propis2); a "page" task shows a page.
// «Узнай букву», «Строчная и заглавная» and «Диктант» (copied from `propis` («Прописи старые»), 2026-10-10) use the very views of `propis`, with this
// topic's letters: the cards get them through the same glyph context, the dictation's answer sheet is written by this topic's engine.
export default function Propis2Renderer({ task, topicRecord, onAdvance, onClose, onCorrect, onMistake }) {
  const glyphMap = useMemo(() => buildGlyphMap(topicRecord), [topicRecord]);
  const cards = useMemo(() => cardGlyphs(glyphMap, cardLetters(topicAlphabet(topicRecord, glyphMap))), [topicRecord, glyphMap]);
  const Answers = useMemo(() => function Propis2DictationAnswers({ items, level, grade }) {
    return <DictationAnswers items={items} level={level} grade={grade} topicRecord={topicRecord} glyphMap={glyphMap} />;
  }, [topicRecord, glyphMap]);
  if (!task) return null;
  const lettersView = (() => {
    switch (task.type) {
      case "sort_case":
        return <SortCaseView key={task.sessionKey + task.letter + task.letterCase} task={task} onAdvance={onAdvance} onCorrect={onCorrect} onMistake={onMistake} />;
      case "match_print_to_written":
      case "match_written_to_print":
        return <MatchView task={task} onAdvance={onAdvance} onCorrect={onCorrect} onMistake={onMistake} />;
      case "match_pair":
        return <MatchPairView key={task.stimulus?.letter} task={task} onAdvance={onAdvance} onCorrect={onCorrect} onMistake={onMistake} />;
      default:
        return null;
    }
  })();
  if (lettersView) return <GlyphContext.Provider value={cards}><div className="propis2-letters">{lettersView}</div></GlyphContext.Provider>;
  if (task.type === "dictation") return <DictationScreen task={task} onClose={onClose} Answers={Answers} />;
  return <PrintPageView task={buildPageTask({ topicRecord, lines: task.lines })} onClose={onClose} />;
}

const MARK_ROWS = 2.4; // the empty rows under the answers where the mark is written

// What was dictated, written out on the narrow copybook row as the child should have it in the notebook: letters and words run on,
// row after row (letters two slant cells apart, words one more than usual, so they read as separate items); each text starts on a
// row of its own. No start dots: this is the finished writing, not a sample to copy.
function DictationAnswers({ items, level, grade, topicRecord, glyphMap }) {
  const task = useMemo(() => {
    const shown = (it) => it.display + (it.punct ?? ""); // the signs the child writes (when the dictation voiced them)
    const texts = level === "texts" ? items.map((it) => it.display) : [items.map(shown).join(level === "letters" ? "   " : "  ")];
    const page = newPage("Диктант", { ruling: "narrow", grid: "regular", rows: texts.map((t) => newRow({ kind: "passage", text: t, repeat: "one", dots: "none", asText: true })) });
    return buildPageTask({ topicRecord, lines: pageToLines(page, glyphMap).map((l) => (l ? `${l}#c` : l)), narrowRows: true, grid: "regular", midDash: true });
  }, [items, level, topicRecord, glyphMap]);
  // Each page cut after its last written row (an empty A5 page under two rows of words made the ink tiny); the last one keeps
  // MARK_ROWS empty rows for the mark, so the red pen never writes over the text. The sheet is fitted into the review's free space.
  const parts = useMemo(() => {
    const pages = printPageRows(task);
    const used = pages.map((p, i) => ({ ...p, i })).filter((p, i) => p.rows > 0 || i === 0);
    return used.map((p, k) => ({ ...p, rows: Math.min(p.perPage, p.rows + (k === used.length - 1 ? MARK_ROWS : 0)) }));
  }, [task]);
  const unitH = (p) => p.h * Math.min(1, (p.rows + 0.6) / Math.max(1, p.perPage));
  const sheetH = parts.reduce((sum, p) => sum + unitH(p), 0);
  const last = parts[parts.length - 1];
  const markH = last ? Math.min(MARK_ROWS + 0.4, last.rows) / Math.max(1, last.perPage) * last.h : 0;
  return (
    <div className="propis2-answers-fit">
      <div className="propis2-answers-sheet" style={{ "--ar": (last?.w ?? 1) / Math.max(1, sheetH), "--mark-h": markH / Math.max(1, sheetH) }}>
        {parts.map((p) => <PrintPageTop key={p.i} task={task} page={p.i} rows={p.rows} />)}
        {grade && <GradeStamp key={`${grade.n}${grade.sign}`} grade={grade} />}
      </div>
    </div>
  );
}
