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

const COLUMN_LETTERS = [
  "А", "Б", "В", "Г", "Д", "Е", "Ж", "И", "К", "Л", "М", "Н",
  "О", "П", "Р", "С", "Т", "У", "Ф", "Х", "Ц", "Ч", "Ш", "Щ", "Ъ",
  "Ы", "Ь", "Э", "Ю", "Я",
];

function positiveInteger(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) throw new Error(`${label} must be a positive integer`);
  return number;
}

export function directionCommandText(command) {
  const cells = positiveInteger(command?.cells, "command.cells");
  const direction = DIRECTION_LABELS[command?.direction];
  if (!direction) throw new Error(`Unknown dictation direction: ${command?.direction}`);
  const word = cells === 1 ? "клетка" : cells < 5 ? "клетки" : "клеток";
  return `${cells} ${word} ${direction}`;
}

export function coordinateCommandText(point) {
  const col = Number(point?.col);
  const row = Number(point?.row);
  if (!Number.isInteger(col) || !COLUMN_LETTERS[col] || !Number.isInteger(row) || row < 0) {
    throw new Error(`Invalid dictation coordinate: ${JSON.stringify(point)}`);
  }
  return `Точка ${COLUMN_LETTERS[col]}, ${row + 1}`;
}

export function directionAudioPath(command) {
  const cells = positiveInteger(command?.cells, "command.cells");
  if (!DIRECTION_LABELS[command?.direction]) throw new Error(`Unknown dictation direction: ${command?.direction}`);
  return `audio/dictation/directions/${command.direction}_${cells}.mp3`;
}

export function coordinateAudioPath(point) {
  const col = Number(point?.col);
  const row = Number(point?.row);
  coordinateCommandText(point); // validates both values and the column label
  return `audio/dictation/coordinates/${col}_${row + 1}.mp3`;
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
      for (const command of card.commands ?? []) add(directionAudioPath(command), directionCommandText(command));
    }
    if (card.taskKind === "coordinate") {
      for (const point of card.points ?? []) add(coordinateAudioPath(point), coordinateCommandText(point));
    }
  }

  // The default direction-based dictation is the core drill. Generate that
  // compact bank first, so a daily TTS cap never leaves the main mode half
  // voiced while a larger coordinate bank is still being made.
  return [...entriesByPath.values()].sort((a, b) => {
    const groupA = a.path.includes("/directions/") ? 0 : 1;
    const groupB = b.path.includes("/directions/") ? 0 : 1;
    return groupA - groupB || a.path.localeCompare(b.path);
  });
}
