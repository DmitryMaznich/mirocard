// Stable names and spoken phrases for the graphic-dictation recording bank.
// The renderer ships as a raw browser script, so it mirrors the two path
// helpers below rather than importing this Node-only module.

const DIRECTION_LABELS = {
  up: "вверх",
  down: "вниз",
  right: "вправо",
  left: "влево",
  up_right: "вправо-вверх",
  down_right: "вправо-вниз",
  up_left: "влево-вверх",
  down_left: "влево-вниз",
};

const MAX_COMMAND_CELLS = 20;
const MAX_COORDINATE_LETTERS = 20;
const MAX_COORDINATE_NUMBERS = 20;

export const COLUMN_LETTERS = [
  "А", "Б", "В", "Г", "Д", "Е", "Ж", "И", "К", "Л", "М", "Н",
  "О", "П", "Р", "С", "Т", "У", "Ф", "Х",
].slice(0, MAX_COORDINATE_LETTERS);

function positiveInteger(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) throw new Error(`${label} must be a positive integer`);
  return number;
}

function commandCells(command) {
  const cells = positiveInteger(command?.cells, "command.cells");
  if (cells > MAX_COMMAND_CELLS) throw new Error(`command.cells must not exceed ${MAX_COMMAND_CELLS}: ${cells}`);
  return cells;
}

function commandDirection(command) {
  if (!DIRECTION_LABELS[command?.direction]) throw new Error(`Unknown dictation direction: ${command?.direction}`);
  return command.direction;
}

function cellsText(cells) {
  const word = cells === 1 ? "клетка" : cells < 5 ? "клетки" : "клеток";
  return `${cells} ${word}`;
}

export function directionCommandText(command) {
  return `${cellsText(commandCells(command))} ${DIRECTION_LABELS[commandDirection(command)]}`;
}

export function coordinateCommandText(point) {
  const col = Number(point?.col);
  const row = Number(point?.row);
  if (!Number.isInteger(col) || !COLUMN_LETTERS[col] || !Number.isInteger(row) || row < 0) {
    throw new Error(`Invalid dictation coordinate: ${JSON.stringify(point)}`);
  }
  return `Точка ${COLUMN_LETTERS[col]}, ${row + 1}`;
}

function coordinateColumn(col) {
  const index = Number(col);
  if (!Number.isInteger(index) || !COLUMN_LETTERS[index]) {
    throw new Error(`Invalid dictation coordinate column: ${col}`);
  }
  return index;
}

// A command is spoken as two reusable recordings, "Две клетки" then
// "вправо". Any new figure is voiced automatically (up to 20 cells per move):
// do not go back to one recording per direction × count pair.
export function cellsAudioPath(cells) {
  return `audio/dictation/cells/${commandCells({ cells })}.mp3`;
}

export function directionWordAudioPath(direction) {
  return `audio/dictation/directions/${commandDirection({ direction })}.mp3`;
}

export function directionAudioPaths(command) {
  return [cellsAudioPath(command?.cells), directionWordAudioPath(command?.direction)];
}

export function coordinateLetterAudioPath(col) {
  return `audio/dictation/coordinate_letters/${coordinateColumn(col)}.mp3`;
}

export function coordinateNumberAudioPath(number) {
  const value = positiveInteger(number, "coordinate number");
  if (value > MAX_COORDINATE_NUMBERS) {
    throw new Error(`Coordinate number must not exceed ${MAX_COORDINATE_NUMBERS}: ${value}`);
  }
  return `audio/dictation/coordinate_numbers/${value}.mp3`;
}

// A coordinate is spoken as two reusable recordings, e.g. "Е" then "10".
// Do not restore a recording for every pair: a 20 × 20 grid needs at most
// forty coordinate assets, not four hundred.
export function coordinateAudioPaths(point) {
  coordinateCommandText(point); // validates both values and the column label
  return [
    coordinateLetterAudioPath(point.col),
    coordinateNumberAudioPath(Number(point.row) + 1),
  ];
}

export function collectDictationAudioEntries(topic) {
  const entriesByPath = new Map();
  const add = (path, text) => {
    const previous = entriesByPath.get(path);
    if (previous && previous.text !== text) throw new Error(`Audio path collision: ${path}`);
    entriesByPath.set(path, { path, text });
  };

  for (const card of topic?.cards ?? []) {
    if (card.taskKind === "dictation") {
      for (const command of card.commands ?? []) {
        directionCommandText(command); // validates both parts
        add(cellsAudioPath(command.cells), cellsText(Number(command.cells)));
        add(directionWordAudioPath(command.direction), DIRECTION_LABELS[command.direction]);
      }
    }
    if (card.taskKind === "coordinate") {
      for (const point of card.points ?? []) {
        coordinateCommandText(point); // validates before calculating either component
        add(coordinateLetterAudioPath(point.col), COLUMN_LETTERS[point.col]);
        add(coordinateNumberAudioPath(Number(point.row) + 1), String(Number(point.row) + 1));
      }
    }
  }

  // The default direction-based dictation is the core drill; list its
  // recordings first.
  return [...entriesByPath.values()].sort((a, b) => {
    const groupA = a.path.includes("/coordinate_") ? 1 : 0;
    const groupB = b.path.includes("/coordinate_") ? 1 : 0;
    return groupA - groupB || a.path.localeCompare(b.path);
  });
}
