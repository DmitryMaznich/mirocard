export const WORD_FORMATION_OPTION_COUNT = {
  type: "enum", label: { ru: "Вариантов ответа" }, values: [2, 3, 4],
  labels: { ru: { 2: "2 — начало", 3: "3", 4: "4" } }, default: 2,
  hint: { ru: "Начните с двух слов. Увеличивайте число вариантов после уверенного выбора." },
};

// Apply the same parameter schema to new ZIPs and previously installed decks.
export function alignWordFormationMode(mode) {
  const params = { ...(mode.params ?? {}) };
  delete params.hintMode;
  params.showImage = { type: "boolean", label: { ru: "Показывать изображения" }, default: true,
    hint: { ru: "Изображения поддерживают смысл. При отключении сохраняется полное условие; новый материал без подготовленных визуалов предъявляется текстом." } };
  params.materialSet = { type: "enum", label: { ru: "Материал занятия" },
    values: ["trained", "transfer"], default: "trained",
    labels: { ru: { trained: "Знакомые сочетания", transfer: "Новые сочетания — перенос" } },
    hint: { ru: "Знакомое прилагательное с новым предметом. Новые сочетания предъявляются текстом; чтение условия можно включить отдельно. Доступен подготовленный набор еды, материалов и сезонов. Результаты переноса учитываются отдельно. Если выбранная категория не содержит новых сочетаний, заданий не будет." },
  };
  params.speechEnabled = { type: "boolean", label: { ru: "Помощь: прочитать условие" }, default: false,
    hint: { ru: "Необязательная помощь взрослому. На экране одна кнопка условия; варианты ребёнок читает сам." } };
  if (mode.type === "pair_intro") params.introStage = {
    type: "enum", label: { ru: "Предъявление в знакомстве" }, values: ["model", "answer"], default: "model",
    labels: { ru: { model: "С образцом", answer: "Без готового ответа" } },
    hint: { ru: "Выбирается взрослым в настройках. В занятии нет переключателей образца и ручных оценок. Устный ответ не оценивается автоматически; выбор слова и согласование учитываются по нажатиям ребёнка." },
  };
  if (params.category) params.category = { ...params.category, default: ["soup"] };
  if (mode.type === "pick_form") {
    delete params.difficulty;
    delete params.hideOptionImages;
    params.optionCount = WORD_FORMATION_OPTION_COUNT;
    return { ...mode, ui: { ...mode.ui, title: "Выбор прилагательного" }, params };
  }
  if (mode.type === "season_form_pick") {
    params.activityStage = { type: "enum", label: { ru: "Этап согласования" },
      values: ["training", "check"], default: "training",
      labels: { ru: { training: "Обучение", check: "Проверка без вопроса и выделения окончания" } },
      hint: { ru: "В проверке сохраняются существительное и время года, но убираются вопрос и цветовая подсказка окончания. Перенос всегда начинается с проверки." },
    };
    params.optionCount = WORD_FORMATION_OPTION_COUNT;
    params.questionHint = {
      type: "boolean", label: { ru: "Вопрос-подсказка" }, default: true,
      hint: { ru: "Сначала показывайте «какой / какая / какое / какие». Для проверки согласования отключите вопрос." },
    };
    params.category = { type: "enum_multi", label: { ru: "Материал согласования" },
      values: ["soup", "seasons"], labels: { ru: { soup: "Еда — знакомые прилагательные", seasons: "Времена года" } }, default: ["soup"] };
    return { ...mode, ui: { ...mode.ui, title: "Согласование прилагательных" },
      methodology: { ...mode.methodology, tips: ["Сначала убедитесь, что ребёнок понимает значение прилагательного.", "Сохраняйте условие «из чего» или время года. В проверке уберите вопрос и выделение окончания."] }, params };
  }
  return { ...mode, params };
}
