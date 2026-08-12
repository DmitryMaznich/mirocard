(() => {
  const React = window.__Mirocard?.React;
  if (!React) throw new Error("Mirocard React runtime is unavailable");

  const { createElement: h, useMemo, useRef, useState } = React;

  // How close (in grid cells) a drawn point must land to an ideal target point
  // to "cover" it. Tuned against a simulated hand trace (smooth wobble + jitter):
  // at 0.7 a realistic non-45deg line is recognized ~80% of the time, while a
  // deliberately different line is never mistaken for it.
  const COVERAGE_TOLERANCE = 0.7;

  // How many grid cells the whole drawn figure may sit left/right of the
  // exact target and still count as correct, as long as its shape is
  // otherwise accurate - a child who draws a perfect figure but starts it a
  // cell or two off from the axis shouldn't be marked wrong for that alone.
  // Vertical position is NOT forgiven this way; only horizontal.
  const HORIZONTAL_SHIFT_TOLERANCE = 2;
  const EMPTY_PATHS = [];

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

  function evaluateCoverage(drawnPaths, targetSegments, tolerance, maxHorizontalShift) {
    const drawnPoints = drawnPaths.flat();
    for (let i = 1; i < drawnPaths.length; i += 1) {
      const prevEnd = drawnPaths[i - 1]?.at(-1);
      const curStart = drawnPaths[i]?.[0];
      if (prevEnd && curStart) drawnPoints.push(...connectingSamples(prevEnd, curStart));
    }
    const total = targetSegments.length;
    let best = { covered: 0, total, complete: false };
    // Try every whole-figure horizontal shift in range and keep whichever
    // position covers the most segments - a systematic left/right offset in
    // the child's stroke shouldn't hide how accurate the shape itself is.
    for (let dx = -maxHorizontalShift; dx <= maxHorizontalShift; dx += 1) {
      const shiftedPoints = dx === 0 ? drawnPoints : drawnPoints.map((p) => ({ col: p.col - dx, row: p.row }));
      const covered = targetSegments.filter((segment) => isSegmentCovered(shiftedPoints, segment, tolerance)).length;
      if (covered > best.covered) best = { covered, total, complete: total > 0 && covered === total };
      if (best.complete) break;
    }
    return best;
  }

  function pathToD(points) {
    return points.map((point, index) => `${index ? "L" : "M"} ${point.col} ${point.row}`).join(" ");
  }

  const DIRECTION = {
    up: { col: 0, row: -1, label: "вверх", arrow: "↑" },
    down: { col: 0, row: 1, label: "вниз", arrow: "↓" },
    right: { col: 1, row: 0, label: "вправо", arrow: "→" },
    left: { col: -1, row: 0, label: "влево", arrow: "←" },
    up_right: { col: 1, row: -1, label: "вправо-вверх", arrow: "↗" },
    down_right: { col: 1, row: 1, label: "вправо-вниз", arrow: "↘" },
    up_left: { col: -1, row: -1, label: "влево-вверх", arrow: "↖" },
    down_left: { col: -1, row: 1, label: "влево-вниз", arrow: "↙" },
  };

  function commandEnd(start, command) {
    const direction = DIRECTION[command.direction];
    return { col: start.col + direction.col * command.cells, row: start.row + direction.row * command.cells };
  }

  function commandText(command) {
    const word = command.cells === 1 ? "клетка" : command.cells < 5 ? "клетки" : "клеток";
    return `${command.cells} ${word} ${DIRECTION[command.direction].label}`;
  }

  function distanceToSegment(point, start, end) {
    const dx = end.col - start.col;
    const dy = end.row - start.row;
    const lengthSquared = dx * dx + dy * dy;
    if (!lengthSquared) return distance(point, start);
    const t = Math.max(0, Math.min(1, ((point.col - start.col) * dx + (point.row - start.row) * dy) / lengthSquared));
    return distance(point, { col: start.col + dx * t, row: start.row + dy * t });
  }

  function isCorrectMove(points, start, end) {
    if (points.length < 2 || distance(points[0], start) > 0.55 || distance(points.at(-1), end) > 0.55) return false;
    return points.every((point) => distanceToSegment(point, start, end) <= 0.8);
  }

  function InstructionGraphic({ command }) {
    return h("div", { className: "dictation__arrow", "aria-hidden": "true" }, DIRECTION[command.direction].arrow);
  }

  // Battleship-style column letters used only when shape.taskKind === "coordinate".
  // Skips Ё and Й (pronunciation/visual ambiguity). Duplicated from
  // tools/symmetry_draw/column_label.mjs — this file ships as a raw browser
  // script inside the topic ZIP (no bundler pass, no imports), same reason
  // DIRECTION/commandsToPath are duplicated between verify_trace.mjs and here.
  const COORDINATE_COLUMN_LETTERS = [
    "А", "Б", "В", "Г", "Д", "Е", "Ж", "З", "И", "К", "Л", "М", "Н",
    "О", "П", "Р", "С", "Т", "У", "Ф", "Х", "Ц", "Ч", "Ш", "Щ", "Ъ",
    "Ы", "Ь", "Э", "Ю", "Я",
  ];

  function columnLabel(col) {
    return COORDINATE_COLUMN_LETTERS[col] ?? `?${col}`;
  }

  function coordinateText(point) {
    return `Найди точку ${columnLabel(point.col)}${point.row + 1}`;
  }

  function coordinateSpeech(point) {
    return `Точка ${columnLabel(point.col)}, ${point.row + 1}`;
  }

  // Reduces either a dictation card's `commands` (relative direction+cells,
  // walked cumulatively from `start`) or a coordinate card's `points`
  // (already-absolute targets) to the same step shape, so the rest of
  // DictationTask doesn't need to know which taskKind produced it.
  function buildSteps(shape) {
    if (shape.taskKind === "coordinate") {
      return (shape.points ?? []).map((point) => ({
        end: point,
        text: coordinateText(point),
        speech: coordinateSpeech(point),
      }));
    }
    let current = shape.start;
    return (shape.commands ?? []).map((command) => {
      const end = commandEnd(current, command);
      current = end;
      return { end, text: commandText(command), speech: commandText(command), direction: command.direction };
    });
  }

  function DictationTask({ task, onCorrect, sessionParams }) {
    const svgRef = useRef(null);
    const drawingRef = useRef(false);
    const gestureRef = useRef([]);
    const [activePoint, setActivePoint] = useState(task.card.start);
    const [stepIndex, setStepIndex] = useState(0);
    const [completed, setCompleted] = useState([]);
    const [preview, setPreview] = useState(null);
    const [showTargetHint, setShowTargetHint] = useState(false);
    const [notice, setNotice] = useState("");
    const [finished, setFinished] = useState(false);
    const shape = task.card;
    const steps = useMemo(() => buildSteps(shape), [shape]);
    const isCoordinate = shape.taskKind === "coordinate";
    const showArrow = sessionParams?.showArrow ?? true;
    const step = steps[stepIndex];
    const columns = Number(shape.columns ?? 10);
    const rows = Number(shape.rows ?? 10);
    const target = step ? step.end : null;

    function localPoint(event) {
      const svg = svgRef.current;
      if (!svg) return null;
      const point = svg.createSVGPoint();
      point.x = event.clientX;
      point.y = event.clientY;
      const ctm = svg.getScreenCTM();
      if (!ctm) return null;
      const local = point.matrixTransform(ctm.inverse());
      if (local.x < -0.45 || local.x > columns + 0.45 || local.y < -0.45 || local.y > rows + 0.45) return null;
      return { col: Math.max(0, Math.min(columns, local.x)), row: Math.max(0, Math.min(rows, local.y)) };
    }

    function speakInstruction() {
      if (!step || !window.speechSynthesis) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(step.speech);
      utterance.lang = "ru-RU";
      window.speechSynthesis.speak(utterance);
    }

    function startGesture(event) {
      if (finished || !step) return;
      event.preventDefault();
      const point = localPoint(event);
      if (!point) return;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      drawingRef.current = true;
      gestureRef.current = [point];
      setPreview([point]);
      setNotice("");
    }

    function moveGesture(event) {
      if (!drawingRef.current) return;
      event.preventDefault();
      const point = localPoint(event);
      if (!point) return;
      const last = gestureRef.current.at(-1);
      if (last && distance(last, point) < 0.03) return;
      gestureRef.current = [...gestureRef.current, point];
      setPreview(gestureRef.current);
    }

    function finishGesture(event) {
      if (!drawingRef.current || !step) return;
      drawingRef.current = false;
      if (event?.currentTarget?.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      const points = gestureRef.current;
      const correct = isCorrectMove(points, activePoint, step.end);
      if (!correct) {
        setPreview(null);
        setNotice("Попробуй ещё раз. Начни с активной точки.");
        return;
      }
      setCompleted((lines) => [...lines, { start: activePoint, end: step.end }]);
      setActivePoint(step.end);
      setPreview(null);
      setShowTargetHint(false);
      setNotice("");
      if (stepIndex + 1 >= steps.length) {
        setFinished(true);
        setTimeout(() => onCorrect?.(task.conceptId, shape.id), 650);
      } else {
        setStepIndex((index) => index + 1);
      }
    }

    function useHint() {
      setShowTargetHint(true);
    }

    const grid = [];
    const dots = [];
    const coordinates = [];
    for (let col = 0; col <= columns; col += 1) {
      grid.push(h("line", { key: `v-${col}`, className: "dictation__grid-line", x1: col, y1: 0, x2: col, y2: rows }));
      coordinates.push(h("text", { key: `col-${col}`, className: "dictation__coordinate", x: col, y: "-0.31", textAnchor: "middle" }, isCoordinate ? columnLabel(col) : col + 1));
      for (let row = 0; row <= rows; row += 1) dots.push(h("circle", { key: `p-${col}-${row}`, className: "dictation__grid-dot", cx: col, cy: row, r: "0.05" }));
    }
    for (let row = 0; row <= rows; row += 1) {
      grid.push(h("line", { key: `h-${row}`, className: "dictation__grid-line", x1: 0, y1: row, x2: columns, y2: row }));
      coordinates.push(h("text", { key: `row-${row}`, className: "dictation__coordinate", x: "-0.33", y: row + 0.08, textAnchor: "middle" }, row + 1));
    }

    const decorations = (shape.decorations ?? []).map((decoration, index) => {
      if (decoration.type === "rect") {
        return h("rect", { key: `deco-${index}`, className: "dictation__decoration-rect", x: decoration.col, y: decoration.row, width: decoration.width ?? 1, height: decoration.height ?? 1 });
      }
      if (decoration.type === "polygon") {
        return h("path", { key: `deco-${index}`, className: "dictation__decoration-rect", d: `${pathToD(decoration.points)} Z` });
      }
      return h("circle", { key: `deco-${index}`, className: "dictation__decoration-dot", cx: decoration.col, cy: decoration.row, r: "0.12" });
    }
    );

    const previewEnd = preview?.at(-1)
      ? { col: Math.max(0, Math.min(columns, Math.round(preview.at(-1).col))), row: Math.max(0, Math.min(rows, Math.round(preview.at(-1).row))) }
      : null;
    const previewPath = preview?.length > 1 ? `M ${activePoint.col} ${activePoint.row} L ${previewEnd.col} ${previewEnd.row}` : null;

    return h("section", { className: "dictation", "aria-label": isCoordinate ? "Точки по координатам" : "Графический диктант" },
      h("div", { className: "dictation__command" },
        step?.direction && showArrow ? h("div", { className: "dictation__arrow-wrap" }, h(InstructionGraphic, { command: { direction: step.direction } })) : null,
        h("div", { className: "dictation__command-copy" },
          h("div", { className: "dictation__text" }, finished ? `Получился рисунок: ${shape.label}` : step?.text ?? ""),
        ),
        !finished ? h("button", { type: "button", className: "dictation__repeat", onClick: speakInstruction, "aria-label": "Повторить инструкцию", title: "Повторить инструкцию" }, "↻") : null,
      ),
      h("div", { className: "dictation__canvas" },
        h("svg", { ref: svgRef, className: "dictation__grid", viewBox: `-0.55 -0.78 ${columns + 1.1} ${rows + 1.58}`, onPointerDown: startGesture, onPointerMove: moveGesture, onPointerUp: finishGesture, onPointerCancel: finishGesture, onPointerLeave: finishGesture },
          h("rect", { className: "dictation__paper", x: "-0.5", y: "-0.72", width: columns + 1, height: rows + 1.45, rx: "0.12" }),
          grid,
          coordinates,
          dots,
          decorations,
          completed.map((line, index) => h("line", { key: `fixed-${index}`, className: "dictation__fixed", x1: line.start.col, y1: line.start.row, x2: line.end.col, y2: line.end.row })),
          previewPath ? h("path", { className: "dictation__preview", d: previewPath }) : null,
          showTargetHint && target ? h("circle", { className: "dictation__target", cx: target.col, cy: target.row, r: "0.18" },
            h("animate", { attributeName: "r", values: "0.18;0.27;0.18", dur: "1s", repeatCount: "indefinite" }),
            h("animate", { attributeName: "opacity", values: "1;0.6;1", dur: "1s", repeatCount: "indefinite" }),
          ) : null,
          !finished ? h("circle", { className: "dictation__active", cx: activePoint.col, cy: activePoint.row, r: "0.15" },
            h("animate", { attributeName: "r", values: "0.15;0.25;0.15", dur: "1.2s", repeatCount: "indefinite" }),
            h("animate", { attributeName: "opacity", values: "1;0.58;1", dur: "1.2s", repeatCount: "indefinite" }),
          ) : null,
        ),
      ),
      !finished ? h("div", { className: "dictation__helpers" },
        h("button", { type: "button", className: "dictation__hint", onClick: useHint, "aria-pressed": showTargetHint }, "● Показать точку"),
        h("span", { className: "dictation__hint-text" }, showTargetHint ? "Жёлтая точка — конец линии." : "Подсветит конечный узел."),
      ) : h("p", { className: "dictation__done" }, `Готово: ${shape.label}`),
      notice ? h("p", { className: "dictation__notice", "aria-live": "polite" }, notice) : null,
    );
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
    const sourcePaths = shape.sourcePaths || EMPTY_PATHS;
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
      const coverage = evaluateCoverage(drawnPaths, targetSegments, COVERAGE_TOLERANCE, HORIZONTAL_SHIFT_TOLERANCE);
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
          Array.from({ length: columns + 1 }, (_, col) => h("text", { key: `col-${col}`, className: "symmetry-draw__coordinate", x: col, y: "-0.31", textAnchor: "middle" }, col + 1)),
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
    const isDictationLike = props.task?.type === "graphic_dictation" || props.task?.type === "coordinate_dictation";
    return isDictationLike ? h(DictationTask, props) : h(GridTask, props);
  };
})();
