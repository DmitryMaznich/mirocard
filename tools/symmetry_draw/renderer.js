(() => {
  const React = window.__Mirocard?.React;
  if (!React) throw new Error("Mirocard React runtime is unavailable");

  const { createElement: h, useCallback, useEffect, useMemo, useRef, useState } = React;

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
  // These are the approved worksheet SVGs. They remain vectors rather than
  // being replaced with an approximate grid drawing.
  const REPEAT_ARTWORK = window.__MirocardRepeatArtwork ?? {};

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
    let best = { covered: 0, total, complete: false, coveredIndexes: [] };
    // Try every whole-figure horizontal shift in range and keep whichever
    // position covers the most segments - a systematic left/right offset in
    // the child's stroke shouldn't hide how accurate the shape itself is.
    for (let dx = -maxHorizontalShift; dx <= maxHorizontalShift; dx += 1) {
      const shiftedPoints = dx === 0 ? drawnPoints : drawnPoints.map((p) => ({ col: p.col - dx, row: p.row }));
      const coveredIndexes = targetSegments
        .map((segment, index) => isSegmentCovered(shiftedPoints, segment, tolerance) ? index : -1)
        .filter((index) => index >= 0);
      const covered = coveredIndexes.length;
      if (covered > best.covered) best = { covered, total, complete: total > 0 && covered === total, coveredIndexes };
      if (best.complete) break;
    }
    return best;
  }

  function pathToD(points) {
    return points.map((point, index) => `${index ? "L" : "M"} ${point.col} ${point.row}`).join(" ");
  }

  function splitSvgSubpaths(d) {
    // Separate outline contours must not be joined by a synthetic line.
    return d.trim().split(/(?=M\s)/).filter(Boolean);
  }

  function sampleSvgPath(d, artwork, offsetCol = 0) {
    const svgPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    svgPath.setAttribute("d", d);
    const length = svgPath.getTotalLength();
    if (!Number.isFinite(length) || length <= 0) return [];
    const scaleX = artwork.gridWidth / artwork.width;
    const scaleY = artwork.gridHeight / artwork.height;
    const scaledLength = length * Math.max(Math.abs(scaleX), Math.abs(scaleY));
    const steps = Math.max(2, Math.ceil(scaledLength / 0.14));
    return Array.from({ length: steps + 1 }, (_, index) => {
      const point = svgPath.getPointAtLength((length * index) / steps);
      return { col: offsetCol + point.x * scaleX, row: point.y * scaleY };
    });
  }

  function artworkToGridPaths(artwork, offsetCol = 0) {
    if (!artwork) return EMPTY_PATHS;
    return artwork.paths.flatMap((path) => splitSvgSubpaths(path.d)
      .map((subpath) => sampleSvgPath(subpath, artwork, offsetCol))
      .filter((points) => points.length > 1));
  }

  function artworkHintPoints(artwork, offsetCol = 0) {
    const nearestByNode = new Map();
    const scaleX = artwork.gridWidth / artwork.width;
    const scaleY = artwork.gridHeight / artwork.height;
    for (const path of artwork.paths) {
      for (const match of path.d.matchAll(/[ML]\s+(-?\d*\.?\d+)\s+(-?\d*\.?\d+)/g)) {
        const point = {
          col: offsetCol + Number(match[1]) * scaleX,
          row: Number(match[2]) * scaleY,
        };
        const anchor = {
          col: Math.round(point.col * 2) / 2,
          row: Math.round(point.row * 2) / 2,
        };
        const offset = distance(point, anchor);
        if (offset > 0.11) continue;
        const key = `${anchor.col}:${anchor.row}`;
        const current = nearestByNode.get(key);
        if (!current || offset < current.offset) nearestByNode.set(key, { ...anchor, offset });
      }
    }
    return [...nearestByNode.values()].map(({ col, row }) => ({ col, row }));
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

  const NAVIGATOR_LABEL = {
    up: "Вверх",
    down: "Вниз",
    right: "Вправо",
    left: "Влево",
    up_right: "Вверх и вправо",
    down_right: "Вниз и вправо",
    up_left: "Вверх и влево",
    down_left: "Вниз и влево",
  };

  // This is the learning order, not just a list of available answers: start
  // at the top and turn clockwise, then place each diagonal between its two
  // neighbouring cardinal directions.
  const BASIC_NAVIGATOR_DIRECTIONS = ["up", "right", "down", "left"];
  const ALL_NAVIGATOR_DIRECTIONS = ["up", "up_right", "right", "down_right", "down", "down_left", "left", "up_left"];

  function navigatorDirections(params) {
    return params?.navigatorDirections === "all" ? ALL_NAVIGATOR_DIRECTIONS : BASIC_NAVIGATOR_DIRECTIONS;
  }

  function commandEnd(start, command) {
    const direction = DIRECTION[command.direction];
    return { col: start.col + direction.col * command.cells, row: start.row + direction.row * command.cells };
  }

  function commandText(command) {
    const word = command.cells === 1 ? "клетка" : command.cells < 5 ? "клетки" : "клеток";
    return `${command.cells} ${word} ${DIRECTION[command.direction].label}`;
  }

  function navigatorRouteText(direction, cells) {
    const count = Math.max(1, Number(cells) || 1);
    const word = count === 1 ? "клетку" : count < 5 ? "клетки" : "клеток";
    const label = NAVIGATOR_LABEL[direction] ?? "Вверх";
    return `${label} на ${count} ${word}`;
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

  // A tap (or short jitter) landing on the target, regardless of where it
  // started - lets a child pick the next point directly instead of dragging a
  // line all the way to it. Every recorded point must stay near `end`, which
  // is what tells a genuine tap apart from a drag that merely passes near the
  // target on its way through. Duplicated from gesture_match.mjs (see that
  // file's header comment for why renderer.js can't just import it).
  function isCorrectTap(points, end, tolerance = 0.55) {
    if (!points.length) return false;
    return points.every((point) => distance(point, end) <= tolerance);
  }

  function InstructionGraphic({ command }) {
    return h("div", { className: "dictation__arrow", "aria-hidden": "true" }, DIRECTION[command.direction].arrow);
  }

  // Battleship-style column letters used only when shape.taskKind === "coordinate".
  // Skips Ё, Й and З (pronunciation/visual ambiguity). Duplicated from
  // tools/symmetry_draw/column_label.mjs — this file ships as a raw browser
  // script inside the topic ZIP (no bundler pass, no imports), same reason
  // DIRECTION/commandsToPath are duplicated between verify_trace.mjs and here.
  const COORDINATE_COLUMN_LETTERS = [
    "А", "Б", "В", "Г", "Д", "Е", "Ж", "И", "К", "Л", "М", "Н",
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
        coordinate: { letter: columnLabel(point.col), number: point.row + 1 },
      }));
    }
    let current = shape.start;
    return (shape.commands ?? []).map((command) => {
      const end = commandEnd(current, command);
      current = end;
      return { end, text: commandText(command), speech: commandText(command), direction: command.direction };
    });
  }

  function DictationTask({ task, onCorrect, onMistake, sessionParams }) {
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
    // Raw (unsnapped) point of the current/last touch - drives the "you
    // touched here" marker and the live coordinate readout in coordinate
    // mode. Distinct from `activePoint` (the fixed FROM point) and `preview`
    // (only set while actively dragging, not for a simple tap).
    const [tapPoint, setTapPoint] = useState(null);
    const shape = task.card;
    const steps = useMemo(() => buildSteps(shape), [shape]);
    const isCoordinate = shape.taskKind === "coordinate";
    const showArrow = sessionParams?.showArrow ?? true;
    const step = steps[stepIndex];
    const columns = Number(shape.columns ?? 10);
    const rows = Number(shape.rows ?? 10);
    const target = step ? step.end : null;
    const nearestCol = tapPoint ? Math.max(0, Math.min(columns, Math.round(tapPoint.col))) : null;
    const nearestRow = tapPoint ? Math.max(0, Math.min(rows, Math.round(tapPoint.row))) : null;
    const tapCoordText = isCoordinate && tapPoint ? `${columnLabel(nearestCol)}${nearestRow + 1}` : null;

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
      setTapPoint(point);
      setNotice("");
    }

    function moveGesture(event) {
      if (!drawingRef.current) return;
      event.preventDefault();
      const point = localPoint(event);
      if (!point) return;
      setTapPoint(point);
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
      // Coordinate cards also accept a plain tap on the target point - the
      // task is "find point X", not "draw a line to it", and the jumps
      // between points are often too long for a comfortable single drag.
      const correct = isCorrectMove(points, activePoint, step.end) || (isCoordinate && isCorrectTap(points, step.end));
      if (!correct) {
        onMistake?.(task.conceptId, shape.id);
        setPreview(null);
        setNotice(isCoordinate ? "Попробуй ещё раз. Нажми на точку или веди линию от активной." : "Попробуй ещё раз. Начни с активной точки.");
        return;
      }
      setCompleted((lines) => [...lines, { start: activePoint, end: step.end }]);
      setActivePoint(step.end);
      setPreview(null);
      setTapPoint(null);
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
      const colActive = col === nearestCol;
      coordinates.push(h("text", { key: `col-${col}`, className: `dictation__coordinate${colActive ? " dictation__coordinate--active" : ""}`, x: col, y: "-0.31", textAnchor: "middle" }, isCoordinate ? columnLabel(col) : col + 1));
      for (let row = 0; row <= rows; row += 1) dots.push(h("circle", { key: `p-${col}-${row}`, className: "dictation__grid-dot", cx: col, cy: row, r: "0.05" }));
    }
    for (let row = 0; row <= rows; row += 1) {
      grid.push(h("line", { key: `h-${row}`, className: "dictation__grid-line", x1: 0, y1: row, x2: columns, y2: row }));
      const rowActive = row === nearestRow;
      coordinates.push(h("text", { key: `row-${row}`, className: `dictation__coordinate${rowActive ? " dictation__coordinate--active" : ""}`, x: "-0.33", y: row + 0.08, textAnchor: "middle" }, row + 1));
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

    const tapBadgeWidth = tapCoordText ? 0.3 + tapCoordText.length * 0.26 : 0;

    return h("section", { className: `dictation${isCoordinate ? " dictation--coordinate" : ""}`, "aria-label": isCoordinate ? "Точки по координатам" : "Графический диктант" },
      h("div", { className: "dictation__command" },
        step?.direction && showArrow ? h("div", { className: "dictation__arrow-wrap" }, h(InstructionGraphic, { command: { direction: step.direction } })) : null,
        h("div", { className: "dictation__command-copy" },
          h("div", { className: "dictation__text" },
            finished
              ? `Получился рисунок: ${shape.label}`
              : isCoordinate && step?.coordinate
                ? [
                    h("span", { key: "prompt", className: "dictation__coordinate-prompt" }, "Найди точку"),
                    h("span", { key: "letter", className: "dictation__coordinate-token dictation__coordinate-token--letter", "aria-label": `Буква ${step.coordinate.letter}` }, step.coordinate.letter),
                    h("span", { key: "number", className: "dictation__coordinate-token dictation__coordinate-token--number", "aria-label": `Цифра ${step.coordinate.number}` }, step.coordinate.number),
                  ]
                : step?.text ?? "",
          ),
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
          // "You touched here" feedback: a ring right at the raw touch point,
          // plus a floating coordinate readout above it that updates live as
          // the finger moves - lets a child see which point a touch will
          // register as before committing to it. Coordinate mode only: the
          // classic direction dictation doesn't need a "which point is this"
          // readout since it never asks the child to locate one.
          isCoordinate && tapPoint ? h("circle", { className: "dictation__tap-mark", cx: tapPoint.col, cy: tapPoint.row, r: "0.24" }) : null,
          isCoordinate && tapPoint ? h("g", { className: "dictation__tap-badge", transform: `translate(${tapPoint.col}, ${Math.max(tapPoint.row - 0.58, -0.5)})` },
            h("rect", { x: -tapBadgeWidth / 2, y: -0.26, width: tapBadgeWidth, height: 0.44, rx: 0.1 }),
            h("text", { x: 0, y: 0.08, textAnchor: "middle" }, tapCoordText),
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

  // A single point instead of a figure keeps the coordinate exercise honest:
  // the child must read the axes, not recognise a memorised silhouette.
  function CoordinatePracticeTask({ task, onCorrect, onMistake, sessionParams }) {
    const svgRef = useRef(null);
    const target = task.target;
    const shape = task.card;
    const columns = Number(shape?.columns ?? 7);
    const rows = Number(shape?.rows ?? 7);
    const isName = sessionParams?.coordinateExercise === "name";
    const [picked, setPicked] = useState({ letter: null, number: null });
    const [selectedPoint, setSelectedPoint] = useState(null);
    const [result, setResult] = useState(null);
    const [notice, setNotice] = useState("");

    function resolve(point) {
      const correct = point.col === target.col && point.row === target.row;
      // Leave a clear, animated footprint on the exact grid node the child
      // touched. The feedback frame alone does not make the selected point
      // obvious enough on a dense coordinate grid.
      setSelectedPoint(point);
      setResult(correct ? "good" : "bad");
      setNotice(correct ? "Верно!" : "Проверь букву и цифру ещё раз.");
      if (correct) {
        window.setTimeout(() => onCorrect?.(task.conceptId, shape?.id), 480);
      } else {
        onMistake?.(task.conceptId, shape?.id);
        window.setTimeout(() => {
          setResult(null);
          setNotice("");
          setPicked({ letter: null, number: null });
          setSelectedPoint(null);
        }, 700);
      }
    }

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
      return {
        col: Math.max(0, Math.min(columns, Math.round(local.x))),
        row: Math.max(0, Math.min(rows, Math.round(local.y))),
      };
    }

    function chooseLetter(letter) {
      if (result) return;
      const next = { ...picked, letter };
      setPicked(next);
      if (next.number != null) resolve({ col: next.letter, row: next.number });
    }

    function chooseNumber(number) {
      if (result) return;
      const next = { ...picked, number };
      setPicked(next);
      if (next.letter != null) resolve({ col: next.letter, row: next.number });
    }

    const grid = [];
    const labels = [];
    for (let col = 0; col <= columns; col += 1) {
      grid.push(h("line", { key: `v-${col}`, className: "coordinate-practice__grid-line", x1: col, y1: 0, x2: col, y2: rows }));
      labels.push(h("text", { key: `c-${col}`, className: "coordinate-practice__label", x: col, y: "-0.34", textAnchor: "middle" }, columnLabel(col)));
      for (let row = 0; row <= rows; row += 1) grid.push(h("circle", { key: `p-${col}-${row}`, className: "coordinate-practice__node", cx: col, cy: row, r: ".06" }));
    }
    for (let row = 0; row <= rows; row += 1) {
      grid.push(h("line", { key: `h-${row}`, className: "coordinate-practice__grid-line", x1: 0, y1: row, x2: columns, y2: row }));
      labels.push(h("text", { key: `r-${row}`, className: "coordinate-practice__label", x: "-0.35", y: row + 0.1, textAnchor: "middle" }, row + 1));
    }

    const targetLabel = { letter: columnLabel(target.col), number: target.row + 1 };
    return h("section", { className: `coordinate-practice${result ? ` coordinate-practice--${result}` : ""}`, "aria-label": "Координаты" },
      h("div", { className: "coordinate-practice__instruction" },
        isName
          ? "Назови координаты точки"
          : [
              h("span", { key: "prompt" }, "Найди точку"),
              h("span", { key: "letter", className: "coordinate-practice__token coordinate-practice__token--letter" }, targetLabel.letter),
              h("span", { key: "number", className: "coordinate-practice__token coordinate-practice__token--number" }, targetLabel.number),
            ],
      ),
      h("div", { className: "coordinate-practice__canvas" },
        h("svg", {
          ref: svgRef,
          className: "coordinate-practice__grid",
          viewBox: `-0.58 -0.78 ${columns + 1.16} ${rows + 1.58}`,
          onPointerUp: (event) => {
            if (isName || result) return;
            event.preventDefault();
            const point = localPoint(event);
            if (point) resolve(point);
          },
        },
          h("rect", { className: "coordinate-practice__paper", x: "-0.52", y: "-0.72", width: columns + 1.04, height: rows + 1.44, rx: ".14" }),
          grid,
          labels,
          !isName && selectedPoint ? h("g", {
            key: `${selectedPoint.col}-${selectedPoint.row}-${result}`,
            className: `coordinate-practice__selection coordinate-practice__selection--${result ?? "pending"}`,
            "aria-hidden": "true",
          },
            h("circle", { className: "coordinate-practice__selection-ripple", cx: selectedPoint.col, cy: selectedPoint.row, r: ".2" },
              h("animate", { attributeName: "r", values: ".2;.5;.62", dur: ".7s", fill: "freeze" }),
              h("animate", { attributeName: "opacity", values: ".9;.4;0", dur: ".7s", fill: "freeze" }),
            ),
            h("circle", { className: "coordinate-practice__selection-halo", cx: selectedPoint.col, cy: selectedPoint.row, r: ".3" }),
            h("circle", { className: "coordinate-practice__selection-core", cx: selectedPoint.col, cy: selectedPoint.row, r: ".16" },
              h("animate", { attributeName: "r", values: ".08;.25;.16", dur: ".42s", fill: "freeze" }),
            ),
          ) : null,
          isName ? h("circle", { className: "coordinate-practice__target", cx: target.col, cy: target.row, r: ".19" },
            h("animate", { attributeName: "r", values: ".19;.29;.19", dur: "1.15s", repeatCount: "indefinite" }),
          ) : null,
        ),
      ),
      isName ? h("div", { className: "coordinate-practice__answers", "aria-label": "Выбери координаты" },
        h("div", { className: "coordinate-practice__answer-row" }, Array.from({ length: columns + 1 }, (_, col) => h("button", {
          key: `letter-${col}`,
          type: "button",
          className: `coordinate-practice__answer coordinate-practice__answer--letter${picked.letter === col ? " is-selected" : ""}`,
          onClick: () => chooseLetter(col),
        }, columnLabel(col)))),
        h("div", { className: "coordinate-practice__answer-row" }, Array.from({ length: rows + 1 }, (_, row) => h("button", {
          key: `number-${row}`,
          type: "button",
          className: `coordinate-practice__answer coordinate-practice__answer--number${picked.number === row ? " is-selected" : ""}`,
          onClick: () => chooseNumber(row),
        }, row + 1))),
      ) : null,
      notice ? h("p", { className: "coordinate-practice__notice", "aria-live": "polite" }, notice) : null,
    );
  }

  // The eight arrows are visual orientation cues. The child always starts from
  // the single centre marker, then a broad directional swipe is enough — this
  // is a spatial-language exercise, not a test of tracing an arrow precisely.
  function NavigatorPracticeTask({ task, onCorrect, onMistake, streakCount = 0, bestStreak = 0, answersPerStar = 1, sessionParams, taskRetry = 0 }) {
    const svgRef = useRef(null);
    const drawingRef = useRef(false);
    const startRef = useRef(null);
    const resolvedRef = useRef(false);
    const [trail, setTrail] = useState(null);
    const [result, setResult] = useState(null);
    const [paused, setPaused] = useState(() => document.hidden || !document.hasFocus());
    const retryTimerRef = useRef(null);
    const isListening = sessionParams?.navigatorPractice === "listening";
    const canSpeak = Boolean(window.speechSynthesis && typeof window.SpeechSynthesisUtterance === "function");
    // A listening task must still be solvable in browsers without the Web
    // Speech API (or where it was disabled by a parent/device policy).
    const usesAuditoryPrompt = isListening && canSpeak;
    const [waitingForInitialCommand, setWaitingForInitialCommand] = useState(() => isListening && canSpeak);
    const responseSeconds = Math.max(3, Math.min(10, Math.round(Number(sessionParams?.responseSeconds) || 5)));
    const durationMs = responseSeconds * 1000;
    const remainingRef = useRef(durationMs);
    const [remaining, setRemaining] = useState(durationMs);
    const direction = DIRECTION[task.direction] ?? DIRECTION.up;
    const isGridRoute = sessionParams?.navigatorPractice === "grid_route";
    const gridSize = isGridRoute ? 8 : 12;
    const cells = Math.max(1, Math.min(3, Math.round(Number(task.cells) || 1)));
    const command = isGridRoute ? navigatorRouteText(task.direction, cells) : (NAVIGATOR_LABEL[task.direction] ?? "Вверх");
    const expected = { x: direction.col, y: direction.row };
    const inputStart = { x: gridSize / 2, y: gridSize / 2 };
    const routeEnd = { x: inputStart.x + expected.x * cells, y: inputStart.y + expected.y * cells };
    const showHint = taskRetry > 0;
    const canAddDiagonals = navigatorDirections(sessionParams).length === 4 && bestStreak >= 5;
    // The single star mirrors the shared "Серия для видеонаграды" setting:
    // 5 / 10 / 15 answers means one ray fills after 1 / 2 / 3 correct answers.
    // Use floor so a ray never appears before its full part of the streak.
    const answersPerRay = Math.max(1, Math.round(answersPerStar));
    const streakTarget = 5 * answersPerRay;
    const filledRays = Math.min(5, Math.max(0, Math.floor(streakCount / answersPerRay)));

    useEffect(() => {
      resolvedRef.current = false;
      drawingRef.current = false;
      startRef.current = null;
      setTrail(null);
      setResult(null);
      setRemaining(durationMs);
      remainingRef.current = durationMs;
      setPaused(document.hidden || !document.hasFocus());
      setWaitingForInitialCommand(isListening && canSpeak);
    }, [task.id, durationMs, isListening, canSpeak]); // Each generated task has a unique id; retries remount it after feedback.

    useEffect(() => () => window.clearTimeout(retryTimerRef.current), []);

    useEffect(() => {
      const pause = () => {
        drawingRef.current = false;
        startRef.current = null;
        setTrail(null);
        setPaused(true);
      };
      const resume = () => {
        if (!document.hidden && document.hasFocus()) setPaused(false);
      };
      const handleVisibilityChange = () => (document.hidden ? pause() : resume());
      document.addEventListener("visibilitychange", handleVisibilityChange);
      window.addEventListener("blur", pause);
      window.addEventListener("focus", resume);
      return () => {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
        window.removeEventListener("blur", pause);
        window.removeEventListener("focus", resume);
      };
    }, []);

    const retryAfterMistake = useCallback(() => {
      if (resolvedRef.current) return;
      resolvedRef.current = true;
      drawingRef.current = false;
      startRef.current = null;
      setResult("miss");
      // SessionScreen intentionally remounts a task after an in-place error.
      // Report the error only after the child has seen the red trace; otherwise
      // that remount erases the feedback in the same render frame.
      retryTimerRef.current = window.setTimeout(() => {
        onMistake?.(task.conceptId, task.card?.id);
      }, 520);
    }, [onMistake, task.conceptId, task.card?.id]);

    useEffect(() => {
      if (paused || waitingForInitialCommand || resolvedRef.current) return undefined;
      const remainingAtStart = remainingRef.current;
      const startedAt = Date.now();
      const ticker = window.setInterval(() => {
        const next = Math.max(0, remainingAtStart - (Date.now() - startedAt));
        remainingRef.current = next;
        setRemaining(next);
        if (next === 0 && !resolvedRef.current) retryAfterMistake();
      }, 50);
      return () => window.clearInterval(ticker);
    }, [paused, waitingForInitialCommand, task.id, retryAfterMistake]);

    const speakCommand = useCallback((releasesInitialTimer = false) => {
      if (!canSpeak) {
        if (releasesInitialTimer) setWaitingForInitialCommand(false);
        return;
      }
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(command);
      utterance.lang = "ru-RU";
      const releaseTimer = () => {
        if (releasesInitialTimer) setWaitingForInitialCommand(false);
      };
      utterance.onend = releaseTimer;
      utterance.onerror = releaseTimer;
      try {
        window.speechSynthesis.speak(utterance);
      } catch {
        releaseTimer();
      }
    }, [canSpeak, command]);

    useEffect(() => {
      if (!isListening) {
        setWaitingForInitialCommand(false);
        return undefined;
      }
      if (!canSpeak) {
        setWaitingForInitialCommand(false);
        return undefined;
      }
      setWaitingForInitialCommand(true);
      const timer = window.setTimeout(() => speakCommand(true), 120);
      return () => {
        window.clearTimeout(timer);
        window.speechSynthesis.cancel();
      };
    }, [isListening, canSpeak, task.id, speakCommand]);

    function localPoint(event) {
      const svg = svgRef.current;
      if (!svg) return null;
      const point = svg.createSVGPoint();
      point.x = event.clientX;
      point.y = event.clientY;
      const ctm = svg.getScreenCTM();
      if (!ctm) return null;
      const local = point.matrixTransform(ctm.inverse());
      return { x: Math.max(0, Math.min(gridSize, local.x)), y: Math.max(0, Math.min(gridSize, local.y)) };
    }

    function resolve(correct) {
      if (paused || resolvedRef.current) return;
      if (!correct) {
        retryAfterMistake();
        return;
      }
      resolvedRef.current = true;
      setResult("good");
      window.setTimeout(() => onCorrect?.(task.conceptId, task.card?.id), 420);
    }

    function startGesture(event) {
      if (paused || resolvedRef.current) return;
      event.preventDefault();
      const point = localPoint(event);
      if (!point) return;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      drawingRef.current = true;
      startRef.current = point;
      setTrail([point, point]);
    }

    function moveGesture(event) {
      if (paused || !drawingRef.current || resolvedRef.current) return;
      event.preventDefault();
      const point = localPoint(event);
      if (!point || !startRef.current) return;
      setTrail([startRef.current, point]);
    }

    function finishGesture(event) {
      if (paused || !drawingRef.current || resolvedRef.current || !startRef.current) return;
      drawingRef.current = false;
      if (event.currentTarget?.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      const end = localPoint(event);
      const start = startRef.current;
      if (!end) return resolve(false);
      const move = { x: end.x - start.x, y: end.y - start.y };
      const moveLength = Math.hypot(move.x, move.y);
      const startDistance = Math.hypot(start.x - inputStart.x, start.y - inputStart.y);
      const directionCosine = moveLength ? (move.x * expected.x + move.y * expected.y) / (moveLength * Math.hypot(expected.x, expected.y)) : -1;
      const endDistance = Math.hypot(end.x - routeEnd.x, end.y - routeEnd.y);
      const correct = isGridRoute
        ? startDistance <= .72 && moveLength >= Math.max(.8, cells * .62) && directionCosine >= .8 && endDistance <= .72
        : startDistance <= 1.2 && moveLength >= 1.45 && directionCosine >= .68;
      resolve(correct);
    }

    const arrows = navigatorDirections(sessionParams).map((key) => {
      const item = DIRECTION[key];
      const start = { x: 6 + item.col * 1.75, y: 6 + item.row * 1.75 };
      const end = { x: 6 + item.col * 4.65, y: 6 + item.row * 4.65 };
      const length = Math.hypot(end.x - start.x, end.y - start.y);
      const unit = { x: (end.x - start.x) / length, y: (end.y - start.y) / length };
      const side = { x: -unit.y, y: unit.x };
      const headBase = { x: end.x - unit.x * 0.92, y: end.y - unit.y * 0.92 };
      const shaftHalf = 0.31;
      const outerLeft = { x: headBase.x + side.x * 0.66, y: headBase.y + side.y * 0.66 };
      const innerLeft = { x: headBase.x + side.x * shaftHalf, y: headBase.y + side.y * shaftHalf };
      const tailLeft = { x: start.x + side.x * shaftHalf, y: start.y + side.y * shaftHalf };
      const tailRight = { x: start.x - side.x * shaftHalf, y: start.y - side.y * shaftHalf };
      const innerRight = { x: headBase.x - side.x * shaftHalf, y: headBase.y - side.y * shaftHalf };
      const outerRight = { x: headBase.x - side.x * 0.66, y: headBase.y - side.y * 0.66 };
      // A single filled outline keeps the broad, rounded mockup arrow intact.
      // Unlike an SVG marker, this silhouette is supported by every deck host.
      const arrowPath = [
        `M ${tailLeft.x} ${tailLeft.y}`,
        `L ${innerLeft.x} ${innerLeft.y}`,
        `L ${outerLeft.x} ${outerLeft.y}`,
        `L ${end.x} ${end.y}`,
        `L ${outerRight.x} ${outerRight.y}`,
        `L ${innerRight.x} ${innerRight.y}`,
        `L ${tailRight.x} ${tailRight.y}`,
        "Z",
      ].join(" ");
      return h("g", { key, className: `navigator__route navigator__route--${key}${showHint && key === task.direction ? " navigator__route--hint" : ""}` },
        h("path", { className: "navigator__arrow", d: arrowPath }),
        h("circle", { className: "navigator__dash", r: "0.105" },
          h("animateMotion", { path: `M ${start.x} ${start.y} L ${end.x} ${end.y}`, dur: "1.25s", repeatCount: "indefinite" }),
        ),
      );
    });

    const trailPath = trail ? `M ${trail[0].x} ${trail[0].y} L ${trail[1].x} ${trail[1].y}` : null;
    const routeGrid = [];
    if (isGridRoute) {
      for (let index = 0; index <= gridSize; index += 1) {
        routeGrid.push(h("line", { key: `vertical-${index}`, x1: index, y1: 0, x2: index, y2: gridSize }));
        routeGrid.push(h("line", { key: `horizontal-${index}`, x1: 0, y1: index, x2: gridSize, y2: index }));
        for (let row = 0; row <= gridSize; row += 1) {
          routeGrid.push(h("circle", { key: `node-${index}-${row}`, cx: index, cy: row, r: ".055" }));
        }
      }
    }
    const timerState = paused
      ? " navigator__timer--paused"
      : waitingForInitialCommand
      ? " navigator__timer--waiting"
      : remaining <= 1500
      ? " navigator__timer--urgent"
      : remaining / durationMs <= .4
        ? " navigator__timer--warning"
        : "";
    return h("section", { className: `navigator${isGridRoute ? " navigator--grid-route" : ""}${paused ? " navigator--paused" : ""} navigator--target-${task.direction}${result ? ` navigator--${result}` : ""}`, "aria-label": "Навигатор" },
      h("div", { className: "navigator__instruction" },
        h("div", { className: "navigator__star", style: { "--navigator-star-fill": `${filledRays * 72}deg` }, "aria-label": `Серия: ${Math.min(streakCount, streakTarget)} из ${streakTarget}` }, "★"),
        h("div", { className: "navigator__command" }, usesAuditoryPrompt
          ? h("button", { type: "button", className: "navigator__listen", onClick: () => speakCommand(false), "aria-label": "Повторить направление" }, "🔊 Послушай ещё раз")
          : command,
        ),
        isListening && !canSpeak
          ? h("p", { className: "navigator__audio-fallback", role: "status" }, "Озвучка недоступна — команда показана текстом")
          : null,
      ),
      h("div", { className: `navigator__timer${timerState}`, "aria-label": waitingForInitialCommand ? "Сначала послушайте команду" : "Время на ответ" },
        h("div", { className: "navigator__timer-track" }, h("i", { style: { transform: `scaleX(${remaining / durationMs})` } })),
        h("svg", { className: "navigator__timer-clock", viewBox: "0 0 24 24", "aria-hidden": "true" },
          h("circle", { cx: "12", cy: "12", r: "8.5" }),
          h("path", { d: "M12 7.3v5.1l3.5 2" }),
        ),
      ),
      showHint ? h("p", { className: "navigator__hint", role: "status" }, isGridRoute
        ? "Подсказка: проведи по подсвеченному маршруту"
        : "Подсказка: найди подсвеченную стрелку",
      ) : null,
      canAddDiagonals ? h("p", { className: "navigator__mastery", role: "status" }, "Пять верных ответов — можно добавить диагонали в настройках") : null,
      h("div", { className: "navigator__board" },
        h("svg", { ref: svgRef, viewBox: `0 0 ${gridSize} ${gridSize}`, className: "navigator__svg", onPointerDown: startGesture, onPointerMove: moveGesture, onPointerUp: finishGesture, onPointerCancel: finishGesture },
          isGridRoute ? h("g", { className: "navigator__grid" }, routeGrid) : arrows,
          showHint && isGridRoute ? h("line", { className: "navigator__route-hint", x1: inputStart.x, y1: inputStart.y, x2: routeEnd.x, y2: routeEnd.y }) : null,
          h("circle", { className: "navigator__input-start", cx: inputStart.x, cy: inputStart.y, r: isGridRoute ? "0.22" : "0.3" },
            isGridRoute ? h("animate", { attributeName: "r", values: ".22;.34;.22", dur: "1.1s", repeatCount: "indefinite" }) : null,
          ),
          trailPath ? h("path", { className: "navigator__trail", d: trailPath }) : null,
        ),
        paused ? h("div", { className: "navigator__pause-overlay", role: "status" }, "Пауза") : null,
      ),
    );
  }

  function NavigatorLearningArrow({ direction }) {
    const vector = DIRECTION[direction] ?? DIRECTION.up;
    const magnitude = Math.hypot(vector.col, vector.row);
    const unit = { x: vector.col / magnitude, y: vector.row / magnitude };
    const side = { x: -unit.y, y: unit.x };
    const start = { x: 5 - unit.x * 3.1, y: 5 - unit.y * 3.1 };
    const end = { x: 5 + unit.x * 3.1, y: 5 + unit.y * 3.1 };
    const headBase = { x: end.x - unit.x * 1.45, y: end.y - unit.y * 1.45 };
    const shaftHalf = .48;
    const d = [
      `M ${start.x + side.x * shaftHalf} ${start.y + side.y * shaftHalf}`,
      `L ${headBase.x + side.x * shaftHalf} ${headBase.y + side.y * shaftHalf}`,
      `L ${headBase.x + side.x * 1.18} ${headBase.y + side.y * 1.18}`,
      `L ${end.x} ${end.y}`,
      `L ${headBase.x - side.x * 1.18} ${headBase.y - side.y * 1.18}`,
      `L ${headBase.x - side.x * shaftHalf} ${headBase.y - side.y * shaftHalf}`,
      `L ${start.x - side.x * shaftHalf} ${start.y - side.y * shaftHalf}`,
      "Z",
    ].join(" ");
    return h("svg", { className: "navigator-learning__arrow", viewBox: "0 0 10 10", "aria-hidden": "true" }, h("path", { d }));
  }

  function NavigatorLearningCards({ sessionParams }) {
    const directions = navigatorDirections(sessionParams);
    // A flash-card run is a short, predictable learning path. It must not
    // inherit the random first task from the practice drill.
    const [index, setIndex] = useState(0);
    const direction = directions[index];
    return h("section", { className: "navigator-learning", "aria-label": "Обучалка направлений" },
      h("div", { className: "navigator-learning__eyebrow" }, "Запоминай направление"),
      h("button", {
        type: "button",
        className: "navigator-learning__card navigator-learning__card--tap",
        onClick: () => setIndex((current) => (current + 1) % directions.length),
        "aria-label": `Направление: ${NAVIGATOR_LABEL[direction]}. Нажми, чтобы увидеть следующую карточку`,
      },
        h(NavigatorLearningArrow, { direction }),
        h("div", { className: "navigator-learning__word" }, NAVIGATOR_LABEL[direction]),
        h("div", { className: "navigator-learning__tap-hint" }, "Нажми на карточку — дальше"),
      ),
      h("div", { className: "navigator-learning__dots", "aria-hidden": "true" }, directions.map((item, dotIndex) => h("i", { key: item, className: dotIndex === index ? "is-active" : "" }))),
      h("p", { className: "navigator-learning__next-step" }, "Когда запомнишь — выбери вариант «Выбери слово» или «Выбери стрелку»."),
    );
  }

  function learningChoices(direction, taskId, directions) {
    const index = Math.max(0, directions.indexOf(direction));
    const choices = directions.length === 4
      ? [...directions]
      : [
        direction,
        directions[(index + 1) % directions.length],
        directions[(index + 3) % directions.length],
        directions[(index + 5) % directions.length],
      ];
    const seed = String(taskId ?? direction).split("").reduce((sum, character) => sum + character.charCodeAt(0), 0);
    const offset = seed % choices.length;
    return [...choices.slice(offset), ...choices.slice(0, offset)];
  }

  function NavigatorLearningChoiceTask({ task, onCorrect, onMistake, sessionParams, taskRetry = 0 }) {
    const exercise = sessionParams?.learningExercise === "choose_arrow" ? "choose_arrow" : "choose_word";
    const direction = task?.direction ?? "up";
    const directions = navigatorDirections(sessionParams);
    const choices = useMemo(() => learningChoices(direction, task?.id, directions), [direction, task?.id, directions]);
    const [answer, setAnswer] = useState(null);
    const resolvedRef = useRef(false);
    const feedbackTimerRef = useRef(null);

    useEffect(() => () => window.clearTimeout(feedbackTimerRef.current), []);

    useEffect(() => {
      resolvedRef.current = false;
      setAnswer(null);
    }, [task?.id, exercise]);

    function choose(choice) {
      if (resolvedRef.current) return;
      const correct = choice === direction;
      setAnswer({ choice, correct });
      if (correct) {
        resolvedRef.current = true;
        feedbackTimerRef.current = window.setTimeout(() => onCorrect?.(task?.conceptId, task?.card?.id), 450);
        return;
      }
      // As above, keep the wrong answer visible before SessionScreen remounts
      // this task to start its retry and record the strict-stars reset.
      feedbackTimerRef.current = window.setTimeout(() => {
        setAnswer(null);
        onMistake?.(task?.conceptId, task?.card?.id);
      }, 650);
    }

    const isWordChoice = exercise === "choose_word";
    const showHint = taskRetry > 0;
    return h("section", { className: "navigator-learning", "aria-label": isWordChoice ? "Выбери слово к стрелке" : "Выбери стрелку к слову" },
      h("div", { className: "navigator-learning__eyebrow" }, isWordChoice ? "Куда показывает стрелка?" : "Найди нужную стрелку"),
      h("div", { className: "navigator-learning__card navigator-learning__card--quiz" },
        isWordChoice
          ? h(NavigatorLearningArrow, { direction })
          : h("div", { className: "navigator-learning__word" }, NAVIGATOR_LABEL[direction]),
      ),
      h("div", { className: `navigator-learning__choices${isWordChoice ? "" : " navigator-learning__choices--arrows"}` }, choices.map((choice) => {
        const state = answer?.choice === choice ? (answer.correct ? " is-correct" : " is-wrong") : "";
        return h("button", {
          key: choice,
          type: "button",
          className: `navigator-learning__choice${state}${showHint && choice === direction ? " is-hinted" : ""}`,
          disabled: Boolean(answer),
          onClick: () => choose(choice),
        }, isWordChoice ? NAVIGATOR_LABEL[choice] : DIRECTION[choice].arrow);
      })),
      showHint ? h("div", { className: "navigator-learning__hint", role: "status" }, "Подсказка: правильный ответ подсвечен") : null,
      answer ? h("div", { className: `navigator-learning__feedback${answer.correct ? " is-correct" : " is-wrong"}`, "aria-live": "polite" }, answer.correct ? "Верно!" : "Попробуй ещё раз") : null,
    );
  }

  function NavigatorLearningTask(props) {
    return props.sessionParams?.learningExercise === "cards" || !props.sessionParams?.learningExercise
      ? h(NavigatorLearningCards, props)
      : h(NavigatorLearningChoiceTask, props);
  }

  function NavigatorTask(props) {
    return props.mode?.id === "navigator_learning"
      ? h(NavigatorLearningTask, props)
      : h(NavigatorPracticeTask, props);
  }
  function GridTask({ task, mode, onCorrect, onMistake, onAdvance }) {
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
    const rawArtwork = isRepeat ? REPEAT_ARTWORK[shape.id] ?? null : null;
    // A repeat is two separate workspaces, not two halves around an axis.
    // Keep a narrow visual gutter so it cannot be mistaken for symmetry.
    const repeatGap = isRepeat ? 1.5 : 0;
    const workOrigin = isRepeat ? axisCol + repeatGap : axisCol;
    const canvasColumns = columns + repeatGap;
    const repeatArtwork = useMemo(() => rawArtwork ? {
      ...rawArtwork,
      gridWidth: axisCol,
      gridHeight: rows,
    } : null, [rawArtwork, axisCol, rows]);
    const targetPaths = useMemo(
      () => repeatArtwork
        ? artworkToGridPaths(repeatArtwork, workOrigin)
        : (isRepeat ? translatePaths(sourcePaths, workOrigin) : mirrorPaths(sourcePaths, axisCol)),
      [sourcePaths, axisCol, workOrigin, isRepeat, repeatArtwork],
    );
    const targetSegments = useMemo(() => pathsToSegments(targetPaths), [targetPaths]);
    const hintPoints = useMemo(() => repeatArtwork ? artworkHintPoints(repeatArtwork, workOrigin) : targetPaths.flat(), [targetPaths, repeatArtwork, workOrigin]);

    function pointFromEvent(event) {
      const svg = svgRef.current;
      if (!svg) return null;
      const point = svg.createSVGPoint();
      point.x = event.clientX;
      point.y = event.clientY;
      const ctm = svg.getScreenCTM();
      if (!ctm) return null;
      const local = point.matrixTransform(ctm.inverse());
      if (local.x < -0.45 || local.x > canvasColumns + 0.45 || local.y < -0.45 || local.y > rows + 0.45) return null;
      // The model on the left is deliberately inert in "Repeat". Drawing
      // can only begin in the clearly marked workspace on the right.
      if (isRepeat && local.x < workOrigin - 0.35) return null;
      return {
        // In repeat mode the work panel is shifted to the right by the visual
        // gutter, so its last column sits beyond the original card width.
        col: Math.max(0, Math.min(canvasColumns, local.x)),
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
        setResult({ percent: 100, complete: true, coveredIndexes: coverage.coveredIndexes });
        // A card solved with the hint showing still counts as done for the
        // child, but shouldn't earn a star - skip onCorrect (which drives the
        // streak/reward count) and just move on ourselves instead.
        if (hintUsed) setTimeout(() => onAdvance?.(), 1200);
        else onCorrect?.(task.conceptId, shape.id);
        return;
      }
      onMistake?.(task.conceptId, shape.id);
      setResult({ percent, complete: false, coveredIndexes: coverage.coveredIndexes });
    }

    const gridLines = [];
    const nodes = [];
    const paper = [];
    const addGrid = (origin, width, keyPrefix, panelClass = "") => {
      paper.push(h("rect", { key: `${keyPrefix}-paper`, className: `symmetry-draw__paper ${panelClass}`.trim(), x: origin - .5, y: "-.72", width: width + 1, height: rows + 1.45, rx: "0.12" }));
      for (let col = 0; col <= width; col += 1) {
        const x = origin + col;
        gridLines.push(h("line", { key: `${keyPrefix}-v-${col}`, className: "symmetry-draw__line", x1: x, y1: 0, x2: x, y2: rows }));
        for (let row = 0; row <= rows; row += 1) nodes.push(h("circle", { key: `${keyPrefix}-p-${col}-${row}`, className: "symmetry-draw__point", cx: x, cy: row, r: "0.05" }));
      }
      for (let row = 0; row <= rows; row += 1) gridLines.push(h("line", { key: `${keyPrefix}-h-${row}`, className: "symmetry-draw__line", x1: origin, y1: row, x2: origin + width, y2: row }));
    };
    if (isRepeat) {
      addGrid(0, axisCol, "sample", "symmetry-draw__paper--sample");
      addGrid(workOrigin, axisCol, "work", "symmetry-draw__paper--work");
    } else {
      addGrid(0, columns, "grid");
    }

    const instruction = mode?.ui?.instruction ?? "Дорисуй вторую половину фигуры";
    const repeatStart = repeatArtwork ? null : targetPaths[0]?.[0] ?? null;
    const coveredSegments = new Set(result?.coveredIndexes ?? []);

    return h("section", { className: `symmetry-draw${isRepeat ? " symmetry-draw--repeat" : ""}`, "aria-label": shape.label ?? "Симметричный рисунок" },
      h("span", { className: "symmetry-draw__tape", "aria-hidden": "true" }),
      h("div", { className: "symmetry-draw__head" },
        h("div", { className: "symmetry-draw__head-text" },
          h("div", { className: "symmetry-draw__title" }, shape.label ?? "Фигура"),
          h("div", { className: "symmetry-draw__instruction" }, instruction),
        ),
        h("span", { className: `symmetry-draw__mirror-chip${isRepeat ? " symmetry-draw__mirror-chip--repeat" : ""}` }, isRepeat ? "↔ сделай так же" : "↔ зеркало"),
      ),
      h("div", { className: "symmetry-draw__canvas" },
        isRepeat ? h("div", { className: "symmetry-draw__repeat-labels", "aria-hidden": "true" },
          h("span", { className: "symmetry-draw__repeat-label symmetry-draw__repeat-label--sample" }, "Смотри"),
          h("span", { className: "symmetry-draw__repeat-label symmetry-draw__repeat-label--work" }, "Нарисуй так же"),
        ) : null,
        h("svg", {
          ref: svgRef,
          className: "symmetry-draw__grid",
          viewBox: `-0.55 -0.78 ${canvasColumns + 1.1} ${rows + 1.58}`,
          onPointerDown: startDrawing,
          onPointerMove: continueDrawing,
          onPointerUp: stopDrawing,
          onPointerCancel: stopDrawing,
          onPointerLeave: stopDrawing,
        },
          paper,
          gridLines,
          !isRepeat ? Array.from({ length: columns + 1 }, (_, col) => h("text", { key: `col-${col}`, className: "symmetry-draw__coordinate", x: col, y: "-0.31", textAnchor: "middle" }, col + 1)) : null,
          !isRepeat ? Array.from({ length: rows + 1 }, (_, row) => h("text", { key: `row-${row}`, className: "symmetry-draw__coordinate", x: "-0.33", y: row + 0.08, textAnchor: "middle" }, row + 1)) : null,
          nodes,
          !isRepeat ? [
                h("line", { key: "axis", className: "symmetry-draw__mirror-line", x1: axisCol, y1: 0.15, x2: axisCol, y2: rows - 0.15 }),
                h("path", { key: "chev-top", className: "symmetry-draw__mirror-chevron", d: `M ${axisCol - 0.22} 0.55 L ${axisCol} 0.1 L ${axisCol + 0.22} 0.55 Z` }),
                h("path", { key: "chev-bottom", className: "symmetry-draw__mirror-chevron", d: `M ${axisCol - 0.22} ${rows - 0.55} L ${axisCol} ${rows - 0.1} L ${axisCol + 0.22} ${rows - 0.55} Z` }),
              ] : null,
          repeatArtwork
            ? h("g", { className: "symmetry-draw__source-artwork", transform: `scale(${axisCol / repeatArtwork.width} ${rows / repeatArtwork.height})` }, repeatArtwork.paths.map((path, index) => h("path", { key: `source-artwork-${index}`, d: path.d, fillRule: path.fillRule })))
            : sourcePaths.map((path, index) => h("path", { key: `source-${index}`, className: "symmetry-draw__source", d: pathToD(path) })),
          isRepeat && repeatStart ? h("g", { className: "symmetry-draw__repeat-start", "aria-hidden": "true" },
            h("circle", { cx: repeatStart.col, cy: repeatStart.row, r: ".23" }),
            h("circle", { cx: repeatStart.col, cy: repeatStart.row, r: ".11" }, h("animate", { attributeName: "r", values: ".11;.17;.11", dur: "1.15s", repeatCount: "indefinite" })),
          ) : null,
          drawnPaths.map((path, index) => path.length > 1 ? h("path", { key: `drawn-glow-${index}`, className: "symmetry-draw__stroke-glow", d: pathToD(path) }) : null),
          drawnPaths.map((path, index) => path.length > 1 ? h("path", { key: `drawn-${index}`, className: "symmetry-draw__stroke", d: pathToD(path) }) : null),
          isRepeat && result ? targetSegments.map((segment, index) => h("line", {
            key: `feedback-${index}`,
            className: `symmetry-draw__repeat-feedback symmetry-draw__repeat-feedback--${coveredSegments.has(index) ? "covered" : "missed"}`,
            x1: segment.a.col, y1: segment.a.row, x2: segment.b.col, y2: segment.b.row,
          })) : null,
          showHint ? (repeatArtwork
            ? h("g", { className: "symmetry-draw__hint-artwork", transform: `translate(${workOrigin} 0) scale(${axisCol / repeatArtwork.width} ${rows / repeatArtwork.height})` }, repeatArtwork.paths.map((path, index) => h("path", { key: `hint-artwork-${index}`, d: path.d, fillRule: path.fillRule })))
            : targetPaths.map((path, index) => h("path", { key: `hint-line-${index}`, className: "symmetry-draw__hint-line", d: pathToD(path) }))
          ) : null,
          showHint ? hintPoints.map((point, index) => h("circle", { key: `hint-point-${index}`, className: "symmetry-draw__hint-point", cx: point.col, cy: point.row, r: "0.17" })) : null,
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
    if (props.task?.type === "coordinates") return h(CoordinatePracticeTask, props);
    if (props.task?.type === "navigator") return h(NavigatorTask, props);
    return isDictationLike ? h(DictationTask, props) : h(GridTask, props);
  };
})();
