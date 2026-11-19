// Games share a topic; new games can be added to its library independently.
export function buildGamesTopicRecord() {
  return {
    meta: {
      id: "games",
      renderer: "games",
      version: "1.7.0",
      title: { ru: "Игры", sl: "Igre" },
      avatar: "media/avatar_games.svg",
      builtin: true,
      about: {
        description: "Игры с ребёнком и настоящими кубиками: гонки, строительство небоскрёбов, наполнение стаканов, перетягивание каната и парковка.",
        goals: ["Сравнивать числа от 1 до 6.", "Соблюдать правила совместной игры."],
        flow: ["Выберите игру и её правила.", "Играйте вместе, соблюдая очередность ходов."],
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
      ui: { title: { ru: "Перетягивание каната" }, instruction: { ru: "Перетяни ленточку за свою линию" } },
    }, {
      id: "parking", type: "parking", evaluation: "none", hideVideoReward: true, hideConceptPicker: true,
      ui: { title: { ru: "Парковка", sl: "Parkirišče", en: "Parking" }, instruction: { ru: "Расставь машинки по цветным гаражам", sl: "Parkiraj avtomobile po barvah", en: "Park the cars by colour" } },
    }],
    cards: [],
    installedAt: "builtin",
  };
}
