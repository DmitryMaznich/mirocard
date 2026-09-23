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
        // This is a standing visual support rather than a set of exercises:
        // there is one metadata card only so the normal session flow stays
        // compatible, but no concepts or rewards are meaningful here.
        hideConceptPicker: true,
        hideVideoReward: true,
        params: {
          showCarousel: {
            type: "boolean",
            label: { ru: "Вчера, сегодня, завтра" },
            default: true,
            section: "Что показывать",
          },
          showWeekday: {
            type: "boolean",
            label: { ru: "День недели" },
            default: true,
            section: "Что показывать",
          },
          showDayOfMonth: {
            type: "boolean",
            label: { ru: "Число" },
            default: true,
            section: "Что показывать",
          },
          showMonth: {
            type: "boolean",
            label: { ru: "Месяц" },
            default: true,
            section: "Что показывать",
          },
          showSeason: {
            type: "boolean",
            label: { ru: "Время года" },
            default: true,
            section: "Что показывать",
          },
          showAnalogClock: {
            type: "boolean",
            label: { ru: "Аналоговые часы" },
            default: true,
            section: "Что показывать",
          },
          showTimeWords: {
            type: "boolean",
            label: { ru: "Время словами" },
            default: true,
            section: "Что показывать",
          },
          showDigitalTime: {
            type: "boolean",
            label: { ru: "Цифровое время" },
            default: true,
            section: "Что показывать",
          },
        },
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
