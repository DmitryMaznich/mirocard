import { useEffect } from "react";
import { dictationPath, mirrorPaths, translatePaths, pathToD } from "./symmetryDrawGeometry";
import "./SymmetryDrawPrintView.css";

const ARROW_BY_DIRECTION = {
  up: "↑", down: "↓", left: "←", right: "→",
  up_right: "↗", down_right: "↘", up_left: "↖", down_left: "↙",
};

function decorationElement(decoration, index) {
  if (decoration.type === "rect") {
    return <rect key={index} className="sdp-deco" x={decoration.col} y={decoration.row} width={decoration.width ?? 1} height={decoration.height ?? 1} />;
  }
  if (decoration.type === "polygon") {
    return <path key={index} className="sdp-deco" d={`${pathToD(decoration.points)} Z`} />;
  }
  return <circle key={index} className="sdp-deco-dot" cx={decoration.col} cy={decoration.row} r={0.14} />;
}

function GridLines({ columns, rows }) {
  const lines = [];
  for (let c = 0; c <= columns; c += 1) {
    lines.push(<line key={`v${c}`} className="sdp-grid-line" x1={c} y1={0} x2={c} y2={rows} />);
  }
  for (let r = 0; r <= rows; r += 1) {
    lines.push(<line key={`h${r}`} className="sdp-grid-line" x1={0} y1={r} x2={columns} y2={r} />);
  }
  return lines;
}

function DictationThumb({ card }) {
  const points = dictationPath(card.start, card.commands);
  return (
    <svg className="sdp-thumb-svg" viewBox={`-0.5 -0.5 ${card.columns + 1} ${card.rows + 1}`}>
      <path className="sdp-thumb-path" d={pathToD(points)} />
      {(card.decorations ?? []).map(decorationElement)}
    </svg>
  );
}

function DictationPage({ card }) {
  return (
    <section className="sdp-page sdp-page--dictation">
      <h2 className="sdp-title">{card.label}</h2>
      <div className="sdp-dict-top">
        <div className="sdp-dict-thumb"><DictationThumb card={card} /></div>
        <div className="sdp-dict-instructions">
          {card.commands.map((command, index) => (
            <span key={index} className="sdp-instr">{command.cells}{ARROW_BY_DIRECTION[command.direction]}</span>
          ))}
        </div>
      </div>
      <div className="sdp-dict-grid" style={{ "--sdp-cols": card.columns, "--sdp-rows": card.rows }}>
        <svg viewBox={`0 0 ${card.columns} ${card.rows}`} preserveAspectRatio="xMinYMin meet">
          <GridLines columns={card.columns} rows={card.rows} />
          <circle className="sdp-start-dot" cx={card.start.col} cy={card.start.row} r={0.16} />
        </svg>
      </div>
    </section>
  );
}

function MirrorRepeatStrip({ card }) {
  const isRepeat = card.taskKind === "repeat";
  const targetPaths = isRepeat ? translatePaths(card.sourcePaths, card.axisCol) : mirrorPaths(card.sourcePaths, card.axisCol);
  return (
    <div className="sdp-strip">
      <div className="sdp-strip-thumb">
        <svg viewBox={`-0.5 -0.5 ${card.columns + 1} ${card.rows + 1}`}>
          {card.sourcePaths.map((path, i) => <path key={`s${i}`} className="sdp-thumb-path" d={pathToD(path)} />)}
          {targetPaths.map((path, i) => <path key={`t${i}`} className="sdp-thumb-path" d={pathToD(path)} />)}
        </svg>
      </div>
      <div className="sdp-strip-grid" style={{ "--sdp-cols": card.columns, "--sdp-rows": card.rows }}>
        <svg viewBox={`0 0 ${card.columns} ${card.rows}`} preserveAspectRatio="xMinYMin meet">
          <GridLines columns={card.columns} rows={card.rows} />
          {card.sourcePaths.map((path, i) => <path key={i} className="sdp-source-path" d={pathToD(path)} />)}
          <line
            className={isRepeat ? "sdp-repeat-axis" : "sdp-mirror-axis"}
            x1={card.axisCol} y1={0.15} x2={card.axisCol} y2={card.rows - 0.15}
          />
        </svg>
      </div>
    </div>
  );
}

function Watermark() {
  const words = Array.from({ length: 24 }, (_, i) => i);
  return (
    <div className="sdp-watermark" aria-hidden="true">
      {words.map((i) => <span key={i}>Mironium</span>)}
    </div>
  );
}

function PageFooter() {
  return (
    <div className="sdp-footer">
      <img src="/brand/mironium-logo.svg" alt="Mironium" className="sdp-footer-logo" />
      <span className="sdp-footer-tag">Ваш ребёнок может больше · mironium.com</span>
    </div>
  );
}

export default function SymmetryDrawPrintView({ cards, onDone }) {
  useEffect(() => {
    let doneTimer = null;
    function handleAfterPrint() {
      // The browser can still be finishing its print/PDF capture of this DOM
      // subtree when `afterprint` fires; unmounting synchronously here has been
      // observed to produce a blank PDF (the capture loses the race). Give it a
      // beat before tearing the print view down.
      doneTimer = setTimeout(onDone, 500);
    }
    window.addEventListener("afterprint", handleAfterPrint);
    const raf = requestAnimationFrame(() => window.print());
    return () => {
      window.removeEventListener("afterprint", handleAfterPrint);
      cancelAnimationFrame(raf);
      if (doneTimer) clearTimeout(doneTimer);
    };
  }, [onDone]);

  const dictationCards = cards.filter((card) => card.taskKind === "dictation");
  const stripCards = cards.filter((card) => card.taskKind !== "dictation");

  return (
    <div className="sdp-root">
      <Watermark />
      {dictationCards.map((card) => <DictationPage key={card.id} card={card} />)}
      {stripCards.length > 0 && (
        <section className="sdp-page sdp-page--strips">
          {stripCards.map((card) => <MirrorRepeatStrip key={card.id} card={card} />)}
        </section>
      )}
      <PageFooter />
    </div>
  );
}
