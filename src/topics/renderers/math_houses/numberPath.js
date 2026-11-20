import { normalizeNumberPathSize, NUMBER_PATH_MODE, NUMBER_PATH_NUMBERS } from "./numberPathConfig.js";

export function arePathNeighbors(a, b, size) {
  return Math.abs(Math.floor(a / size) - Math.floor(b / size)) + Math.abs(a % size - b % size) === 1;
}

function readRoute(layout) {
  const rows = layout.trim().split(/\s+/);
  const cells = [...rows.join("")].flatMap((cell, index) => cell === "#" ? [index] : []);
  const route = [cells.shift()];
  while (cells.length) {
    const next = cells.findIndex((cell) => arePathNeighbors(route.at(-1), cell, rows.length));
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
  15: [
    readRoute(`
      #..########....
      ####......#....
      ..........#....
      ..........##...
      ...........#...
      ..........##...
      ..........#....
      ####......#....
      #..##...###....
      ###.#####......
      ..#......###...
      ..#......#.##..
      ###..###.#..##.
      #....#.#.#...#.
      ######.###...##
    `),
    readRoute(`
      #..........###.
      ##.........#.#.
      .##.......##.##
      ..##.....##...#
      ...##....#...##
      ....##...###.#.
      .....##....#.##
      ......#....#..#
      ......####.##.#
      .........#..#.#
      ......####.##.#
      ....###....#.##
      ...##..#####.#.
      ...#.###.....#.
      ...###.......##
    `),
  ],
};

function transformCell(cell, size, variant) {
  let row = Math.floor(cell / size);
  let column = cell % size;
  if (variant >= 4) [row, column] = [column, row];
  if (variant % 2 === 1) row = size - 1 - row;
  if (variant % 4 >= 2) column = size - 1 - column;
  return row * size + column;
}

function layoutsForSize(size) {
  const trims = size === 5 ? [[0, 0]] : [[1, 2], [2, 1], [3, 3], [0, 3], [3, 0]];
  return ROUTES[size].flatMap((base) => trims.flatMap(([start, end]) =>
    Array.from({ length: 8 }, (_, variant) => base.slice(start, base.length - end)
      .map((cell) => transformCell(cell, size, variant))),
  ));
}

const LAYOUTS = new Map(NUMBER_PATH_MODE.params.boardSize.values.map((size) => [size, layoutsForSize(size)]));

function createTask(card, number, size, route, layoutIndex) {
  const innerRoute = route.slice(1, -1);
  const cells = Array.from({ length: size * size }, (_, index) => {
    if (index === route[0]) return [number, 0];
    if (index === route.at(-1)) return [0, number];
    const step = innerRoute.indexOf(index);
    if (step !== -1) {
      const first = (step % (number - 1)) + 1;
      return [first, number - first];
    }
    const otherTotal = index % 2 === 0 && number < 10 ? number + 1 : number - 1;
    const first = (index + number - 1) % (otherTotal + 1);
    return [first, otherTotal - first];
  });

  return { type: NUMBER_PATH_MODE.type, cardId: card.id, conceptId: card.conceptId, number, size, cells, route, layoutIndex };
}

export function generateNumberPath(cards, params, previousRound = []) {
  const size = normalizeNumberPathSize(params.boardSize);
  const layouts = LAYOUTS.get(size);
  // Only the first round needs randomness. Advancing from saved tasks yields
  // the same next round if the session state update is replayed.
  const initialIndex = previousRound.length ? (previousRound[0].layoutIndex ?? -1) + 1
    : Math.floor(Math.random() * layouts.length);
  const tasks = [];
  for (const number of NUMBER_PATH_NUMBERS) {
    const card = cards.find((item) => Number(item.params?.number ?? item.params?.total) === number);
    if (!card) continue;
    const prior = tasks.at(-1) ?? previousRound.at(-1);
    const lastLayout = previousRound.find((task) => task.number === number)?.layoutIndex;
    let layoutIndex = (initialIndex + tasks.length * 7) % layouts.length;
    while (layoutIndex === lastLayout || (prior?.route[0] === layouts[layoutIndex][0]
      && prior.route.at(-1) === layouts[layoutIndex].at(-1))) {
      layoutIndex = (layoutIndex + 1) % layouts.length;
    }
    tasks.push(createTask(card, number, size, layouts[layoutIndex], layoutIndex));
  }
  return tasks;
}
