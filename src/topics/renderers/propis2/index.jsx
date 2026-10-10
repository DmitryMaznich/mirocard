import { useMemo } from "react";
import "../propis/propis.css";
import "../propis/letters/letters.css";
import "./dictation.css";
import "./letters.css";
import PrintPageView from "../propis/PrintPageView";
import DictationView from "../propis/DictationView";
import { GlyphContext } from "../propis/letters/glyphs.js";
import MatchView from "../propis/letters/MatchView";
import MatchPairView from "../propis/letters/MatchPairView";
import SortCaseView from "../propis/letters/SortCaseView";
import { buildGlyphMap, buildPageTask } from "./pageTask.js";
import { cardGlyphs } from "./letterCards.js";
import { pageToLines, newPage, newRow } from "./model.js";

// «Прописи 2» in a session. The constructor is the topic's home screen (src/features/propis2); a "page" task shows a page.
// «Узнай букву», «Строчная и заглавная» and «Диктант» (copied from «Прописи», 2026-10-10) use the very views of «Прописи», with this
// topic's letters: the cards get them through the same glyph context, the dictation's answer sheet is written by this topic's engine.
export default function Propis2Renderer({ task, topicRecord, onAdvance, onClose, onCorrect, onMistake }) {
  const glyphMap = useMemo(() => buildGlyphMap(topicRecord), [topicRecord]);
  const cards = useMemo(() => cardGlyphs(glyphMap), [glyphMap]);
  const Answers = useMemo(() => function Propis2DictationAnswers({ items, level }) {
    return <DictationAnswers items={items} level={level} topicRecord={topicRecord} glyphMap={glyphMap} />;
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
  if (task.type === "dictation") return <DictationView task={task} onClose={onClose} Answers={Answers} />;
  return <PrintPageView task={buildPageTask({ topicRecord, lines: task.lines })} onClose={onClose} />;
}

// What was dictated, written out on the narrow copybook row as the child should have it in the notebook: letters and words run on,
// row after row (letters two slant cells apart, words one more than usual, so they read as separate items); each text starts on a
// row of its own. No start dots: this is the finished writing, not a sample to copy.
function DictationAnswers({ items, level, topicRecord, glyphMap }) {
  const task = useMemo(() => {
    const texts = level === "texts" ? items.map((it) => it.display) : [items.map((it) => it.display).join(level === "letters" ? "   " : "  ")];
    const page = newPage("Диктант", { ruling: "narrow", grid: "regular", rows: texts.map((t) => newRow({ kind: "passage", text: t, repeat: "one", dots: "none", asText: true })) });
    return buildPageTask({ topicRecord, lines: pageToLines(page, glyphMap).map((l) => (l ? `${l}#c` : l)), narrowRows: true, grid: "regular", midDash: true });
  }, [items, level, topicRecord, glyphMap]);
  return (
    <div className="propis2-dictation-answers">
      <PrintPageView task={task} bare />
    </div>
  );
}
