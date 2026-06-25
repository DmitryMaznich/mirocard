export const BUILTIN_TOPICS = [
  {
    meta: {
      id: "streak_tracker",
      renderer: "streak_tracker",
      version: "1.0.0",
      title: { ru: "5 из 5" },
      avatar: "media/avatar_streak_tracker.svg",
      builtin: true,
      about: {
        description: "Универсальный трекер серии ответов. Подходит для любого занятия — специалист отмечает результат вручную.",
        goals: [
          "Поощрить серию правильных ответов подряд.",
          "Дать ребёнку ощущение прогресса через нарастающую серию звёзд.",
        ],
        finalGoal: "Ребёнок получает приз после 5 верных ответов подряд без единой ошибки.",
        flow: [
          "Задавайте задание устно, жестами или на реальном материале.",
          "Нажимайте ✓ если ответ верный, ✗ если ошибка — серия обнуляется.",
        ],
      },
    },
    modes: [
      {
        id: "streak",
        type: "streak",
        evaluation: "instant",
        ui: {
          title: { ru: "5 из 5" },
          instruction: { ru: "Отмечайте ответы ребёнка" },
          icon: "media/avatar_streak_tracker.svg",
        },
      },
    ],
    cards: [{ id: "streak_task", conceptId: "streak_task", primary: true }],
    installedAt: "builtin",
  },
];

export const BUILTIN_TOPIC_IDS = new Set(BUILTIN_TOPICS.map((t) => t.meta.id));

export const FIRST_PARTY_DECK_IDS = new Set([]);
