export const LINE_OPERATIONS_MODE = "line_operations";

export const lineTicks = [17, 39, 61, 83];
const nodes = Object.fromEntries(lineTicks.flatMap((x, column) =>
  lineTicks.map((y, row) => [String(column) + row, [x, y]]),
));

// A node is its column followed by its row. Each step is one cell wide or high.
const centerSquare = ["11", "21", "22", "12", "11"];
const leftToBottomStep = ["01", "11", "12", "22", "23"];
const topToRightStep = ["10", "11", "21", "22", "32"];

const examples = {
  plus: [
    {
      first: [["01", "11", "21"], ["12", "22", "32"]],
      second: [["10", "11", "12"], ["20", "21", "22", "23"]],
    },
    {
      first: [["01", "11", "10"], ["32", "22", "23"]],
      second: [["20", "21", "31"], ["02", "12"]],
    },
    {
      first: [centerSquare],
      second: [["01", "11", "21", "20"], ["32", "22", "23"]],
    },
    {
      first: [leftToBottomStep],
      second: [topToRightStep],
    },
  ],
  minus: [
    {
      first: [["10", "11", "12", "13"], ["20", "21", "22", "23"]],
      second: [["10", "11"], ["21", "22", "23"]],
    },
    {
      first: [leftToBottomStep, topToRightStep],
      second: [topToRightStep],
    },
    {
      first: [centerSquare, ["01", "11", "10"], ["31", "21", "20"], ["32", "22"]],
      second: [centerSquare],
    },
    {
      first: [["01", "11", "21", "31"], ["02", "12", "22", "32"], ["10", "11", "12", "13"]],
      second: [["01", "11", "10"], ["12", "22", "32"]],
    },
  ],
};

// Mix both operations in short, unequal runs so the sign stays informative.
const mixedOrder = [
  "plus", "minus", "plus", "plus", "minus", "minus", "plus", "minus",
  "minus", "plus", "minus", "plus", "plus", "minus", "minus", "plus",
];

const edgeKey = (a, b) => a < b ? a + "-" + b : b + "-" + a;
const edges = (paths) => paths.flatMap((path) => path.slice(1).map((node, i) => edgeKey(path[i], node)));

export function lineExamplePoints(path) {
  return path.map((node) => nodes[node]);
}

function rotateNode(node, turns) {
  let [x, y] = [...node].map(Number);
  for (let turn = 0; turn < turns; turn += 1) [x, y] = [3 - y, x];
  return String(x) + y;
}

function lineOperationTarget(first, second, operation) {
  const firstEdges = edges(first);
  const secondEdges = new Set(edges(second));
  return [...new Set(operation === "plus"
    ? [...firstEdges, ...secondEdges]
    : firstEdges.filter((edge) => !secondEdges.has(edge)))];
}

export function generateLineOperationTasks(selection, card) {
  if (!card) return [];
  const positions = { plus: 0, minus: 0 };
  return mixedOrder.map((mixedOperation) => {
    const operation = selection === "mixed" ? mixedOperation : selection === "minus" ? "minus" : "plus";
    const bank = examples[operation];
    const position = positions[operation]++;
    const base = bank[position % bank.length];
    const turns = Math.floor(position / bank.length);
    const rotate = (paths) => paths.map((path) => path.map((node) => rotateNode(node, turns)));
    const first = rotate(base.first);
    const second = rotate(base.second);
    return {
      type: LINE_OPERATIONS_MODE,
      conceptId: card.conceptId,
      card,
      operation,
      first,
      second,
      target: lineOperationTarget(first, second, operation),
    };
  });
}

function distanceToSegment([x, y], [left, top], [right, bottom]) {
  const dx = right - left;
  const dy = bottom - top;
  const t = Math.max(0, Math.min(1, ((x - left) * dx + (y - top) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - left - t * dx, y - top - t * dy);
}

function nearbyNode([x, y]) {
  for (const [node, [nx, ny]] of Object.entries(nodes)) {
    const distance = Math.hypot(x - nx, y - ny);
    if (distance <= 8.5) return { node, distance };
  }
  return null;
}

// Pointer events can skip the intersection between two consecutive edges.
function interpolate(points) {
  const samples = [points[0]];
  for (let i = 1; i < points.length; i += 1) {
    const [x, y] = points[i - 1];
    const dx = points[i][0] - x;
    const dy = points[i][1] - y;
    const intervals = Math.ceil(Math.hypot(dx, dy) / 2.5);
    for (let step = 1; step <= intervals; step += 1) {
      samples.push([x + dx * step / intervals, y + dy * step / intervals]);
    }
  }
  return samples;
}

export function evaluateLineOperationStroke(points, target) {
  if (!points.length) return { kind: "idle" };
  const [x0, y0] = points[0];
  if (points.every(([x, y]) => Math.hypot(x - x0, y - y0) < 10)) return { kind: "idle" };
  if (!nearbyNode(points[0]) || !nearbyNode(points.at(-1))) return { kind: "incorrect" };

  const samples = interpolate(points);
  const visits = [];
  samples.forEach((point, index) => {
    const hit = nearbyNode(point);
    if (!hit) return;
    const last = visits.at(-1);
    if (last?.node !== hit.node) visits.push({ ...hit, index });
    else if (hit.distance < last.distance) Object.assign(last, hit, { index });
  });

  const found = new Set();
  for (let i = 1; i < visits.length; i += 1) {
    const from = visits[i - 1];
    const to = visits[i];
    const edge = edgeKey(from.node, to.node);
    if (!target.has(edge) || found.has(edge)) return { kind: "incorrect" };
    const startIndex = i === 1 ? 0 : from.index;
    const endIndex = i === visits.length - 1 ? samples.length - 1 : to.index;
    const section = samples.slice(startIndex, endIndex + 1);
    if (section.some((point) => distanceToSegment(point, nodes[from.node], nodes[to.node]) > 9)) {
      return { kind: "incorrect" };
    }
    found.add(edge);
  }
  return found.size ? { kind: "correct", edges: [...found] } : { kind: "incorrect" };
}
