export function buildDailyOrientationTopicRecord() {
  return {
    meta: {
      id: "daily_orientation",
      renderer: "daily_orientation",
      version: "1.0.0",
      title: { ru: "Сегодня" },
      builtin: true,
      about: {
        description: "Постоянный визуальный ориентир для коротких разговоров о дне, дате, месяце, времени года и текущем времени.",
        goals: [
          "Связать понятия «вчера», «сегодня» и «завтра» с реальными датами.",
          "Поддерживать совместное называние дня недели, числа, месяца, времени года и времени.",
        ],
        finalGoal: "Ребёнок пользуется экраном как понятной визуальной опорой и отвечает доступным ему способом: словом, жестом, указанием или AAC.",
        flow: [
          "Оставьте тему открытой на планшете; по умолчанию в центре карусели — «Сегодня».",
          "Коснитесь «Вчера» или «Завтра», чтобы обсудить соседний день, затем вернитесь к «Сегодня».",
        ],
      },
    },
    modes: [
      {
        id: "daily_orientation",
        type: "daily_orientation",
        evaluation: "none",
        ui: {
          title: { ru: "Экран на сегодня" },
          instruction: { ru: "Интерактивный ориентир для ежедневного разговора" },
        },
      },
    ],
    cards: [{ id: "daily_orientation", conceptId: "daily_orientation", primary: true }],
    installedAt: "builtin",
  };
}
