export const NUMBER_PATH_TITLE = { ru: "Состав числа", en: "Number Composition" };
export const NUMBER_PATH_ICON = "media/icons/number_path.svg";
export const NUMBER_PATH_NUMBERS = [2, 3, 4, 5, 6, 7, 8, 9, 10];
const MIN_PATH_NUMBER = 3;
const MAX_PATH_NUMBER = 20;
const SMALL_BOARD_THROUGH = 5;

export const MATH_HOUSE_MODES = [
  {
    id: "math_houses_practice",
    type: "math_houses_practice",
    evaluation: "auto",
    ui: { title: "Домик", instruction: "Работай с домиком числа", icon: "media/icons/math_houses.svg" },
    params: {
      subtype: {
        type: "enum", label: { ru: "Задание" }, default: "fill",
        values: ["fill", "read", "recall", "selective"],
        labels: { ru: { fill: "Дополняю", read: "Читаю", recall: "Вспоминаю", selective: "Выборочно" } },
      },
      hiddenWindows: {
        type: "number", min: 1, max: 6, default: 1, label: { ru: "Скрытых окон" },
        showWhen: { subtype: "selective" },
      },
      shufflePairs: {
        type: "boolean", default: false, label: { ru: "Перемешивать пары" },
        hint: { ru: "Не показывать пары подряд по порядку" }, showWhen: { subtype: "selective" },
      },
    },
  },
  {
    id: "math_houses_grow",
    type: "math_houses_grow",
    evaluation: "auto",
    ui: { title: "Растущий домик", instruction: "Вспомни все пары числа", icon: "media/icons/math_houses_grow.svg" },
  },
];

export const NUMBER_PATH_MODE = {
  id: "number_path",
  type: "number_path",
  evaluation: "auto",
  loop: true,
  allCards: true,
  hideConceptPicker: true,
  paramsScope: "mode",
  ui: {
    title: "Найди дорожку",
    instruction: "Нажимай на соседние клетки с нужной суммой.",
    icon: NUMBER_PATH_ICON,
  },
  params: {
    minNumber: {
      type: "number", min: MIN_PATH_NUMBER, max: MAX_PATH_NUMBER, default: MIN_PATH_NUMBER,
      label: { ru: "Минимальное число", sl: "Najmanjše število" },
    },
    maxNumber: {
      type: "number", min: MIN_PATH_NUMBER, max: MAX_PATH_NUMBER, default: 10,
      label: { ru: "Максимальное число" },
    },
    boardSize: {
      type: "enum",
      label: { ru: "Сложность" },
      values: [5, 10, 14],
      labels: { ru: { 5: "Начальная · 5 × 5", 10: "Средняя · 10 × 10", 14: "Продвинутая · 10 × 14 / 14 × 10" } },
      default: 5,
      hint: { ru: "Для больших полей минимальное число — 6.", sl: "Pri večjih mrežah je najmanjše število 6." },
    },
    mistakeBehavior: {
      type: "enum",
      label: { ru: "После ошибки" },
      values: ["retry", "restart"],
      labels: { ru: { retry: "Повторить ход", restart: "Начать дорожку заново" } },
      default: "retry",
    },
  },
};

function normalizeNumberPathSize(value) {
  const { values, default: defaultSize } = NUMBER_PATH_MODE.params.boardSize;
  const size = Number(value);
  if (size === 15) return 14;
  return values.includes(size) ? size : defaultSize;
}

export function numberPathBoardSizes(number) {
  const { values } = NUMBER_PATH_MODE.params.boardSize;
  return number <= SMALL_BOARD_THROUGH ? values.slice(0, 1) : values;
}

export function numberPathMinForBoard(boardSize) {
  return boardSize === NUMBER_PATH_MODE.params.boardSize.default ? MIN_PATH_NUMBER : SMALL_BOARD_THROUGH + 1;
}

export function normalizeNumberPathParams(params = {}) {
  const definitions = NUMBER_PATH_MODE.params;
  function clampNumber(key) {
    const { min, max, default: fallback } = definitions[key];
    const value = Number(params[key] ?? fallback);
    return Number.isFinite(value) ? Math.max(min, Math.min(max, Math.round(value))) : fallback;
  }
  const maxNumber = clampNumber("maxNumber");
  const boardSize = Math.min(normalizeNumberPathSize(params.boardSize), numberPathBoardSizes(maxNumber).at(-1));
  const minNumber = Math.max(numberPathMinForBoard(boardSize), Math.min(clampNumber("minNumber"), maxNumber));
  return { ...params, minNumber, maxNumber, boardSize };
}
