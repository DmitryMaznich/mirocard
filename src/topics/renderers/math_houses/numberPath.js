import { normalizeNumberPathParams, NUMBER_PATH_MODE, NUMBER_PATH_NUMBERS } from "./numberPathConfig.js";

export function arePathNeighbors(a, b, columns) {
  return Math.abs(Math.floor(a / columns) - Math.floor(b / columns)) + Math.abs(a % columns - b % columns) === 1;
}

function readRoute(layout) {
  const rows = layout.trim().split(/\s+/);
  const cells = [...rows.join("")].flatMap((cell, index) => cell === "#" ? [index] : []);
  const route = [cells.shift()];
  while (cells.length) {
    const next = cells.findIndex((cell) => arePathNeighbors(route.at(-1), cell, rows[0].length));
    if (next === -1) throw new Error("Disconnected number path layout");
    route.push(cells.splice(next, 1)[0]);
  }
  return route;
}

// Each # marks a cell on the sole side-connected route. Larger boards can
// head back across the field using turns separated by distractor cells.
const ROUTES = {
  5: [[5, 6, 7, 2, 3, 4, 9, 14, 19, 18], [1, 6, 11, 16, 17, 18, 13, 8, 9]],
  10: [
    readRoute(`
      ##....####
      .#....#..#
      .#....#..#
      .##..##.##
      ..#.##.##.
      ..###..#..
      .......#..
      ......##..
      ......#...
      ......####
    `),
    readRoute(`
      ####......
      ...####...
      ......####
      ###......#
      #.##..####
      #..####...
      ##........
      .#........
      .##...####
      ..#####..#
    `),
  ],
  14: [
    readRoute(`
      ##....####
      .#....#..#
      .#....#..#
      .##..##.##
      ..#.##.##.
      ..###..#..
      .......#..
      ......##..
      ......#...
      ......####
      .........#
      ......####
      ......#...
      ..#####...
    `),
    readRoute(`
      ####......
      ...####...
      ......####
      ###......#
      #.##..####
      #..####...
      ##........
      .#........
      .##...####
      ..#####..#
      .........#
      .........#
      ...#######
      ...#......
    `),
  ],
};

function columnsForSize(size) {
  return size === 14 ? 10 : size;
}

function transformCell(cell, columns, rows, variant) {
  let row = Math.floor(cell / columns);
  let column = cell % columns;
  if (variant >= 4 && columns === rows) [row, column] = [column, row];
  if (variant % 2 === 1) row = rows - 1 - row;
  if (variant % 4 >= 2) column = columns - 1 - column;
  return row * columns + column;
}

function layoutsForSize(size) {
  const columns = columnsForSize(size);
  const trims = size === 5 ? [[0, 0]] : [[1, 2], [2, 1], [3, 3], [0, 3], [3, 0]];
  return ROUTES[size].flatMap((base) => trims.flatMap(([start, end]) =>
    Array.from({ length: 8 }, (_, variant) => {
      const route = base.slice(start, base.length - end);
      if (columns !== size && variant >= 4) route.reverse();
      return route.map((cell) => transformCell(cell, columns, size, variant));
    }),
  ));
}

const LAYOUTS = new Map(NUMBER_PATH_MODE.params.boardSize.values.map((size) => [size, layoutsForSize(size)]));

function createTask(card, number, size, route, layoutIndex) {
  const columns = columnsForSize(size);
  const innerRoute = route.slice(1, -1);
  const offset = number > NUMBER_PATH_NUMBERS.at(-1) ? layoutIndex : 0;
  const cells = Array.from({ length: columns * size }, (_, index) => {
    if (index === route[0]) return [number, 0];
    if (index === route.at(-1)) return [0, number];
    const step = innerRoute.indexOf(index);
    if (step !== -1) {
      const first = ((step + offset) % (number - 1)) + 1;
      return [first, number - first];
    }
    const otherTotal = index % 2 === 0 && number < NUMBER_PATH_MODE.params.maxNumber.max ? number + 1 : number - 1;
    const first = (index + number - 1) % (otherTotal + 1);
    return [first, otherTotal - first];
  });

  return { type: NUMBER_PATH_MODE.type, cardId: card.id, conceptId: card.conceptId, number, size, columns, cells, route, layoutIndex };
}

export function generateNumberPath(cards, params, previousRound = []) {
  const { minNumber, maxNumber, boardSize: size } = normalizeNumberPathParams(params);
  const layouts = LAYOUTS.get(size);
  // Only the first round needs randomness. Advancing from saved tasks yields
  // the same next round if the session state update is replayed.
  const seed = previousRound.length ? 0 : Math.random();
  const tasks = [];
  for (let number = minNumber; number <= maxNumber; number += 1) {
    // Sums above the house deck's range belong to this procedural mode only.
    const pathId = `number_path_${number}`;
    const card = cards.find((item) => Number(item.params?.number ?? item.params?.total) === number)
      ?? (number > NUMBER_PATH_NUMBERS.at(-1) ? { id: pathId, conceptId: pathId } : null);
    if (!card) continue;
    const prior = tasks.at(-1) ?? previousRound.at(-1);
    const lastLayout = previousRound.find((task) => task.number === number)?.layoutIndex;
    const initialIndex = lastLayout === undefined ? Math.floor(seed * layouts.length) + tasks.length * 7 : lastLayout + 1;
    let layoutIndex = initialIndex % layouts.length;
    while (layoutIndex === lastLayout || (prior?.size === size && prior.route[0] === layouts[layoutIndex][0]
      && prior.route.at(-1) === layouts[layoutIndex].at(-1))) {
      layoutIndex = (layoutIndex + 1) % layouts.length;
    }
    tasks.push(createTask(card, number, size, layouts[layoutIndex], layoutIndex));
  }
  return tasks;
}
