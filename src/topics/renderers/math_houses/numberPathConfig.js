export const NUMBER_PATH_TITLE = { ru: "Состав числа", en: "Number Composition" };
export const NUMBER_PATH_ICON = "media/icons/number_path.svg";
export const NUMBER_PATH_NUMBERS = [2, 3, 4, 5, 6, 7, 8, 9, 10];

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
    boardSize: {
      type: "enum",
      label: { ru: "Сложность" },
      values: [5, 10, 14],
      labels: { ru: { 5: "Начальная · 5 × 5", 10: "Средняя · 10 × 10", 14: "Продвинутая · 10 × 14 / 14 × 10" } },
      default: 5,
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

export function normalizeNumberPathSize(value) {
  const { values, default: defaultSize } = NUMBER_PATH_MODE.params.boardSize;
  const size = Number(value);
  if (size === 15) return 14;
  return values.includes(size) ? size : defaultSize;
}
