// Games share a topic; new games can be added to its library independently.
export function buildGamesTopicRecord() {
  return {
    meta: {
      id: "games",
      renderer: "games",
      version: "1.1.0",
      title: { ru: "Игры", sl: "Igre" },
      avatar: "media/avatar_games.svg",
      builtin: true,
      about: {
        description: "Играйте вместе с ребёнком: гонки и строительство небоскрёбов с настоящими кубиками.",
        goals: ["Сравнивать числа от 1 до 6.", "Соблюдать правила совместной игры."],
        flow: ["Бросьте по кубику и отметьте числа.", "Сравните результаты: машинки поедут, а краны построят этажи."],
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
      ui: { title: { ru: "До облаков" }, instruction: { ru: "Строим небоскрёбы до 20 этажей" } },
    }],
    cards: [],
    installedAt: "builtin",
  };
}
