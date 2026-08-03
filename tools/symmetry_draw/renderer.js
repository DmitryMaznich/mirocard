(() => {
  const React = window.__Mirocard?.React;
  if (!React) throw new Error("Mirocard React runtime is unavailable");

  const { createElement: h, useMemo, useRef, useState } = React;

  // How close (in grid cells) a drawn point must land to an ideal target point
  // to "cover" it. Tuned against a simulated hand trace (smooth wobble + jitter):
  // at 0.7 a realistic non-45deg line is recognized ~80% of the time, while a
  // deliberately different line is never mistaken for it.
  const COVERAGE_TOLERANCE = 0.7;

  function mirrorPaths(paths, axisCol) {
    return (paths ?? []).map((path) => path.map((point) => ({ col: 2 * axisCol - point.col, row: point.row })));
  }

  function translatePaths(paths, axisCol) {
    return (paths ?? []).map((path) => path.map((point) => ({ col: point.col + axisCol, row: point.row })));
  }

  function pathsToSegments(paths) {
    const segments = [];
    for (const path of paths ?? []) {
      for (let index = 1; index < path.length; index += 1) {
        const a = path[index - 1];
        const b = path[index];
        if (a.col === b.col && a.row === b.row) continue;
        segments.push({ a, b });
      }
    }
    return segments;
  }

  function distance(p, q) {
    return Math.hypot(p.col - q.col, p.row - q.row);
  }

  // Any angle works: coverage is judged by how close the drawn stroke passes to
  // the ideal segment, not by matching an exact set of grid-aligned edges.
  function isSegmentCovered(drawnPoints, { a, b }, tolerance) {
    const length = distance(a, b);
    const samples = Math.max(2, Math.ceil(length * 3));
    for (let i = 0; i <= samples; i += 1) {
      const t = i / samples;
      const ideal = { col: a.col + (b.col - a.col) * t, row: a.row + (b.row - a.row) * t };
      const covered = drawnPoints.some((p) => distance(p, ideal) <= tolerance);
      if (!covered) return false;
    }
    return true;
  }

  // Straight-line samples bridging a pen lift between two strokes - lets a child
  // who taps point-to-point (e.g. following the numbered hint dots) instead of
  // dragging one continuous line still have that gap read as "connect A to B".
  function connectingSamples(a, b) {
    const length = distance(a, b);
    if (length === 0) return [a];
    const samples = Math.max(2, Math.ceil(length * 3));
    const points = [];
    for (let i = 0; i <= samples; i += 1) {
      const t = i / samples;
      points.push({ col: a.col + (b.col - a.col) * t, row: a.row + (b.row - a.row) * t });
    }
    return points;
  }

  function evaluateCoverage(drawnPaths, targetSegments, tolerance) {
    const drawnPoints = drawnPaths.flat();
    for (let i = 1; i < drawnPaths.length; i += 1) {
      const prevEnd = drawnPaths[i - 1]?.at(-1);
      const curStart = drawnPaths[i]?.[0];
      if (prevEnd && curStart) drawnPoints.push(...connectingSamples(prevEnd, curStart));
    }
    const covered = targetSegments.filter((segment) => isSegmentCovered(drawnPoints, segment, tolerance)).length;
    return { covered, total: targetSegments.length, complete: targetSegments.length > 0 && covered === targetSegments.length };
  }

  function pathToD(points) {
    return points.map((point, index) => `${index ? "L" : "M"} ${point.col} ${point.row}`).join(" ");
  }

  function GridTask({ task, mode, onCorrect, onAdvance }) {
    const svgRef = useRef(null);
    const drawingRef = useRef(false);
    const [drawnPaths, setDrawnPaths] = useState([]);
    const [showHint, setShowHint] = useState(false);
    const [hintUsed, setHintUsed] = useState(false);
    const [result, setResult] = useState(null); // { percent, complete } | null
    const [resolved, setResolved] = useState(false);
    const shape = task.card ?? task;
    const columns = Number(shape.columns ?? 10);
    const rows = Number(shape.rows ?? 8);
    const axisCol = Number(shape.axisCol ?? 5);
    const sourcePaths = shape.sourcePaths ?? [];
    const isRepeat = shape.taskKind === "repeat";
    const targetPaths = useMemo(
      () => (isRepeat ? translatePaths(sourcePaths, axisCol) : mirrorPaths(sourcePaths, axisCol)),
      [sourcePaths, axisCol, isRepeat],
    );
    const targetSegments = useMemo(() => pathsToSegments(targetPaths), [targetPaths]);
    const hintPoints = useMemo(() => targetPaths.flat(), [targetPaths]);

    function pointFromEvent(event) {
      const svg = svgRef.current;
      if (!svg) return null;
      const point = svg.createSVGPoint();
      point.x = event.clientX;
      point.y = event.clientY;
      const ctm = svg.getScreenCTM();
      if (!ctm) return null;
      const local = point.matrixTransform(ctm.inverse());
      if (local.x < -0.45 || local.x > columns + 0.45 || local.y < -0.45 || local.y > rows + 0.45) return null;
      return {
        col: Math.max(0, Math.min(columns, local.x)),
        row: Math.max(0, Math.min(rows, local.y)),
      };
    }

    function startDrawing(event) {
      if (resolved) return;
      event.preventDefault();
      const point = pointFromEvent(event);
      if (!point) return;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      drawingRef.current = true;
      setResult(null);
      setDrawnPaths((paths) => [...paths, [point]]);
    }

    function continueDrawing(event) {
      if (!drawingRef.current || resolved) return;
      event.preventDefault();
      const point = pointFromEvent(event);
      if (!point) return;
      setDrawnPaths((paths) => {
        const current = paths.at(-1);
        const previous = current?.at(-1);
        // Skip points that barely moved - keeps the stroke smooth without flooding
        // the array with near-duplicate samples every pointermove.
        if (previous && distance(previous, point) < 0.03) return paths;
        return [...paths.slice(0, -1), [...current, point]];
      });
    }

    function stopDrawing(event) {
      if (!drawingRef.current) return;
      drawingRef.current = false;
      if (event?.currentTarget?.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    }

    function checkDrawing() {
      if (resolved) return;
      const coverage = evaluateCoverage(drawnPaths, targetSegments, COVERAGE_TOLERANCE);
      const percent = coverage.total > 0 ? Math.round((coverage.covered / coverage.total) * 100) : 0;
      if (coverage.complete) {
        setResolved(true);
        setResult({ percent: 100, complete: true });
        // A card solved with the hint showing still counts as done for the
        // child, but shouldn't earn a star - skip onCorrect (which drives the
        // streak/reward count) and just move on ourselves instead.
        if (hintUsed) setTimeout(() => onAdvance?.(), 1200);
        else onCorrect?.(task.conceptId, shape.id);
        return;
      }
      setResult({ percent, complete: false });
    }

    const gridLines = [];
    for (let col = 0; col <= columns; col += 1) gridLines.push(h("line", { key: `v-${col}`, className: "symmetry-draw__line", x1: col, y1: 0, x2: col, y2: rows }));
    for (let row = 0; row <= rows; row += 1) gridLines.push(h("line", { key: `h-${row}`, className: "symmetry-draw__line", x1: 0, y1: row, x2: columns, y2: row }));
    const nodes = [];
    for (let col = 0; col <= columns; col += 1) {
      for (let row = 0; row <= rows; row += 1) nodes.push(h("circle", { key: `p-${col}-${row}`, className: "symmetry-draw__point", cx: col, cy: row, r: "0.05" }));
    }

    const instruction = mode?.ui?.instruction ?? "Дорисуй вторую половину фигуры";

    return h("section", { className: "symmetry-draw", "aria-label": shape.label ?? "Симметричный рисунок" },
      h("span", { className: "symmetry-draw__tape", "aria-hidden": "true" }),
      h("div", { className: "symmetry-draw__head" },
        h("div", { className: "symmetry-draw__head-text" },
          h("div", { className: "symmetry-draw__title" }, shape.label ?? "Фигура"),
          h("div", { className: "symmetry-draw__instruction" }, instruction),
        ),
        h("span", { className: `symmetry-draw__mirror-chip${isRepeat ? " symmetry-draw__mirror-chip--repeat" : ""}` }, isRepeat ? "→ повтори" : "↔ зеркало"),
      ),
      h("div", { className: "symmetry-draw__canvas" },
        h("svg", {
          ref: svgRef,
          className: "symmetry-draw__grid",
          viewBox: `-0.55 -0.78 ${columns + 1.1} ${rows + 1.58}`,
          onPointerDown: startDrawing,
          onPointerMove: continueDrawing,
          onPointerUp: stopDrawing,
          onPointerCancel: stopDrawing,
          onPointerLeave: stopDrawing,
        },
          h("rect", { className: "symmetry-draw__paper", x: "-0.5", y: "-0.72", width: columns + 1, height: rows + 1.45, rx: "0.12" }),
          gridLines,
          Array.from({ length: columns + 1 }, (_, col) => h("text", { key: `col-${col}`, className: "symmetry-draw__coordinate", x: col, y: "-0.31", textAnchor: "middle" }, String.fromCharCode(65 + col))),
          Array.from({ length: rows + 1 }, (_, row) => h("text", { key: `row-${row}`, className: "symmetry-draw__coordinate", x: "-0.33", y: row + 0.08, textAnchor: "middle" }, row + 1)),
          nodes,
          h("line", { className: `symmetry-draw__mirror-line${isRepeat ? " symmetry-draw__mirror-line--repeat" : ""}`, x1: axisCol, y1: 0.15, x2: axisCol, y2: rows - 0.15 }),
          isRepeat
            ? h("path", { className: "symmetry-draw__repeat-arrow", d: `M ${axisCol - 0.28} ${rows / 2 - 0.32} L ${axisCol + 0.22} ${rows / 2 - 0.32} L ${axisCol + 0.22} ${rows / 2 - 0.6} L ${axisCol + 0.62} ${rows / 2} L ${axisCol + 0.22} ${rows / 2 + 0.6} L ${axisCol + 0.22} ${rows / 2 + 0.32} L ${axisCol - 0.28} ${rows / 2 + 0.32} Z` })
            : [
                h("path", { key: "chev-top", className: "symmetry-draw__mirror-chevron", d: `M ${axisCol - 0.22} 0.55 L ${axisCol} 0.1 L ${axisCol + 0.22} 0.55 Z` }),
                h("path", { key: "chev-bottom", className: "symmetry-draw__mirror-chevron", d: `M ${axisCol - 0.22} ${rows - 0.55} L ${axisCol} ${rows - 0.1} L ${axisCol + 0.22} ${rows - 0.55} Z` }),
              ],
          sourcePaths.map((path, index) => h("path", { key: `source-${index}`, className: "symmetry-draw__source", d: pathToD(path) })),
          drawnPaths.map((path, index) => path.length > 1 ? h("path", { key: `drawn-glow-${index}`, className: "symmetry-draw__stroke-glow", d: pathToD(path) }) : null),
          drawnPaths.map((path, index) => path.length > 1 ? h("path", { key: `drawn-${index}`, className: "symmetry-draw__stroke", d: pathToD(path) }) : null),
          showHint ? targetPaths.map((path, index) => h("path", { key: `hint-line-${index}`, className: "symmetry-draw__hint-line", d: pathToD(path) })) : null,
          showHint ? hintPoints.map((point, index) => h("g", { key: `hint-point-${index}`, className: "symmetry-draw__hint-point" }, h("circle", { cx: point.col, cy: point.row, r: "0.17" }), h("text", { x: point.col, y: point.row + 0.055, textAnchor: "middle" }, index + 1))) : null,
        ),
      ),
      h("div", { className: "symmetry-draw__controls" },
        h("button", { type: "button", className: "symmetry-draw__button", onClick: () => { setDrawnPaths([]); setResult(null); }, disabled: !drawnPaths.length || resolved }, "Очистить"),
        h("button", { type: "button", className: `symmetry-draw__button symmetry-draw__button--hint${showHint ? " symmetry-draw__button--hint-on" : ""}`, onClick: () => { setShowHint((shown) => !shown); setHintUsed(true); }, disabled: resolved }, showHint ? "✦ Скрыть" : "✦ Подсказка"),
        h("button", { type: "button", className: "symmetry-draw__button symmetry-draw__button--primary", onClick: checkDrawing, disabled: resolved }, "Готово"),
      ),
      h("div", { className: "symmetry-draw__result-wrap" },
        result
          ? h("div", { className: `symmetry-draw__result${result.complete ? " symmetry-draw__result--good" : " symmetry-draw__result--bad"}`, "aria-live": "polite" },
              h("span", { className: "symmetry-draw__result-percent" }, `${result.percent}%`),
              h("span", { className: "symmetry-draw__result-text" }, result.complete ? "Совпало! Отличная работа." : "Похоже, ещё не совпадает. Попробуй ещё раз."),
            )
          : null,
      ),
    );
  }

  window.__MirocardRenderer = function SymmetryDrawRenderer(props) {
    return h(GridTask, props);
  };
})();
