(() => {
  const React = window.__Mirocard?.React;
  if (!React) throw new Error("Mirocard React runtime is unavailable");

  const { createElement: h, useMemo, useRef, useState } = React;

  function mirrorPaths(paths, axisCol) {
    return (paths ?? []).map((path) => path.map((point) => ({ col: 2 * axisCol - point.col, row: point.row })));
  }

  function pointKey(point) {
    return `${point.col}:${point.row}`;
  }

  function edgeKey(a, b) {
    return [pointKey(a), pointKey(b)].sort().join("|");
  }

  function segmentPoints(from, to) {
    const steps = Math.max(Math.abs(to.col - from.col), Math.abs(to.row - from.row));
    return Array.from({ length: steps + 1 }, (_, index) => ({
      col: Math.round(from.col + ((to.col - from.col) * index) / steps),
      row: Math.round(from.row + ((to.row - from.row) * index) / steps),
    }));
  }

  function collectEdges(paths) {
    const edges = new Set();
    for (const path of paths ?? []) {
      for (let index = 1; index < path.length; index += 1) {
        const points = segmentPoints(path[index - 1], path[index]);
        for (let pointIndex = 1; pointIndex < points.length; pointIndex += 1) {
          edges.add(edgeKey(points[pointIndex - 1], points[pointIndex]));
        }
      }
    }
    return edges;
  }

  function pathToD(points) {
    return points.map((point, index) => `${index ? "L" : "M"} ${point.col} ${point.row}`).join(" ");
  }

  function GridTask({ task, onCorrect }) {
    const svgRef = useRef(null);
    const drawingRef = useRef(false);
    const [drawnPaths, setDrawnPaths] = useState([]);
    const [showHint, setShowHint] = useState(false);
    const [notice, setNotice] = useState("");
    const [resolved, setResolved] = useState(false);
    const shape = task.card ?? task;
    const columns = Number(shape.columns ?? 10);
    const rows = Number(shape.rows ?? 8);
    const axisCol = Number(shape.axisCol ?? 5);
    const sourcePaths = shape.sourcePaths ?? [];
    const targetPaths = useMemo(() => mirrorPaths(sourcePaths, axisCol), [sourcePaths, axisCol]);
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
        col: Math.max(0, Math.min(columns, Math.round(local.x))),
        row: Math.max(0, Math.min(rows, Math.round(local.y))),
      };
    }

    function startDrawing(event) {
      if (resolved) return;
      event.preventDefault();
      const point = pointFromEvent(event);
      if (!point) return;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      drawingRef.current = true;
      setNotice("");
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
        if (!previous || (previous.col === point.col && previous.row === point.row)) return paths;
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
      const expected = collectEdges(targetPaths);
      const drawn = collectEdges(drawnPaths);
      const completed = [...expected].filter((edge) => drawn.has(edge)).length;
      if (completed === expected.size && expected.size > 0) {
        setResolved(true);
        setNotice("Верно! Ты дорисовал фигуру правильно.");
        onCorrect?.(task.conceptId, shape.id);
        return;
      }
      setNotice(`Совпадает ${completed} из ${expected.size} отрезков. Попробуй дорисовать ещё раз.`);
    }

    const gridLines = [];
    for (let col = 0; col <= columns; col += 1) gridLines.push(h("line", { key: `v-${col}`, className: "symmetry-draw__line", x1: col, y1: 0, x2: col, y2: rows }));
    for (let row = 0; row <= rows; row += 1) gridLines.push(h("line", { key: `h-${row}`, className: "symmetry-draw__line", x1: 0, y1: row, x2: columns, y2: row }));
    const nodes = [];
    for (let col = 0; col <= columns; col += 1) {
      for (let row = 0; row <= rows; row += 1) nodes.push(h("circle", { key: `p-${col}-${row}`, className: "symmetry-draw__point", cx: col, cy: row, r: "0.045" }));
    }

    return h("section", { className: "symmetry-draw", "aria-label": shape.label ?? "Симметричный рисунок" },
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
        h("line", { className: "symmetry-draw__axis", x1: axisCol, y1: 0, x2: axisCol, y2: rows }),
        sourcePaths.map((path, index) => h("path", { key: `source-${index}`, className: "symmetry-draw__source", d: pathToD(path) })),
        drawnPaths.map((path, index) => path.length > 1 ? h("path", { key: `drawn-${index}`, className: "symmetry-draw__stroke", d: pathToD(path) }) : null),
        showHint ? targetPaths.map((path, index) => h("path", { key: `hint-line-${index}`, className: "symmetry-draw__hint-line", d: pathToD(path) })) : null,
        showHint ? hintPoints.map((point, index) => h("g", { key: `hint-point-${index}`, className: "symmetry-draw__hint-point" }, h("circle", { cx: point.col, cy: point.row, r: "0.16" }), h("text", { x: point.col, y: point.row + 0.055, textAnchor: "middle" }, index + 1))) : null,
      ),
      h("div", { className: "symmetry-draw__controls" },
        h("button", { type: "button", className: "symmetry-draw__button", onClick: () => { setDrawnPaths((paths) => paths.slice(0, -1)); setNotice(""); }, disabled: !drawnPaths.length || resolved }, "← Отменить"),
        h("button", { type: "button", className: "symmetry-draw__button", onClick: () => { setDrawnPaths([]); setNotice(""); }, disabled: !drawnPaths.length || resolved }, "Очистить"),
        h("button", { type: "button", className: "symmetry-draw__button", onClick: () => setShowHint((shown) => !shown), disabled: resolved }, showHint ? "Скрыть подсказку" : "Подсказка"),
        h("button", { type: "button", className: "symmetry-draw__button symmetry-draw__button--primary", onClick: checkDrawing, disabled: resolved }, "Готово"),
      ),
      h("p", { className: `symmetry-draw__notice${notice ? " symmetry-draw__notice--visible" : ""}`, "aria-live": "polite" }, notice || " "),
    );
  }

  window.__MirocardRenderer = function SymmetryDrawRenderer(props) {
    return h(GridTask, props);
  };
})();
