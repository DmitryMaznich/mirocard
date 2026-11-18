// Games share a topic; new games can be added to its library independently.
export function buildGamesTopicRecord() {
  return {
    meta: {
      id: "games",
      renderer: "games",
      version: "1.4.0",
      title: { ru: "Игры", sl: "Igre" },
      avatar: "media/avatar_games.svg",
      builtin: true,
      about: {
        description: "Игры с ребёнком и настоящими кубиками: гонки, строительство небоскрёбов, наполнение стаканов и перетягивание каната.",
        goals: ["Сравнивать числа от 1 до 6.", "Соблюдать правила совместной игры."],
        flow: ["Бросьте по кубику и отметьте числа.", "Сравните результаты, чтобы запустить ход."],
      },
    },
    modes: [{
      id: "dice_race",
      type: "dice_race",
      evaluation: "none",
      hideVideoReward: true,
      hideConceptPicker: true,
      ui: { title: { ru: "Гонки" }, instruction: { ru: "Гонка с настоящими кубиками" } },
    }, {
      id: "skyscrapers",
      type: "skyscrapers",
      evaluation: "none",
      hideVideoReward: true,
      hideConceptPicker: true,
      ui: { title: { ru: "Дом до облаков" }, instruction: { ru: "Строим небоскрёбы до 20 этажей" } },
    }, {
      id: "water_fill", type: "water_fill", evaluation: "none", hideVideoReward: true, hideConceptPicker: true,
      ui: { title: { ru: "Наливаем до краёв" }, instruction: { ru: "У кого вода первой польётся через край?" } },
    }, {
      id: "tug_of_war", type: "tug_of_war", evaluation: "none", hideVideoReward: true, hideConceptPicker: true,
      ui: { title: { ru: "Перетягивание каната" }, instruction: { ru: "Кто первым дотянет канат до отметки 15?" } },
    }],
    cards: [],
    installedAt: "builtin",
  };
}
