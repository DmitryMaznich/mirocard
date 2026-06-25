import { LETTER_DATA } from "./renderers/written_letters/letterData.js";

export const BUILTIN_TOPICS = [
  {
    meta: {
      id: "written_letters",
      renderer: "written_letters",
      version: "1.0.0",
      title: { ru: "Письменные буквы" },
      avatar: "media/avatar.svg",
      builtin: true,
      about: {
        description: "Тема тренирует распознавание рукописных букв русского алфавита: строчные и заглавные, соответствие печатной и письменной форм.",
        goals: [
          "Научить ребёнка различать строчные и заглавные рукописные буквы.",
          "Закрепить соответствие печатной и рукописной формы каждой буквы.",
          "Научить находить пару: заглавная рукописная ↔ строчная рукописная.",
        ],
        finalGoal: "Ребёнок уверенно узнаёт любую букву алфавита в рукописном написании и соотносит её с печатным образцом.",
        flow: [
          "Начинайте с режима «Строчная или заглавная?».",
          "Переходите к «Найди рукописную» / «Найди печатную» для закрепления.",
          "«Найди пару» — завершающий режим для автоматизации.",
        ],
      },
    },
    modes: [
      {
        id: "sort_case",
        type: "sort_case",
        evaluation: "auto",
        ui: {
          title: { ru: "Строчная или заглавная?" },
          instruction: { ru: "Потяни букву в нужную группу" },
          icon: "media/icons/written_sort_case.svg",
        },
      },
      {
        id: "match_print_to_written",
        type: "match_print_to_written",
        evaluation: "auto",
        ui: {
          title: { ru: "Найди рукописную" },
          instruction: { ru: "Нажми на рукописную букву" },
          icon: "media/icons/written_match_print.svg",
        },
      },
      {
        id: "match_written_to_print",
        type: "match_written_to_print",
        evaluation: "auto",
        ui: {
          title: { ru: "Найди печатную" },
          instruction: { ru: "Нажми на печатную букву" },
          icon: "media/icons/written_match_written.svg",
        },
      },
      {
        id: "match_pair",
        type: "match_pair",
        evaluation: "auto",
        ui: {
          title: { ru: "Найди пару" },
          instruction: { ru: "Нажми на строчную пару заглавной буквы" },
          icon: "media/icons/written_match_pair.svg",
        },
      },
    ],
    cards: LETTER_DATA,
    installedAt: "builtin",
  },
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

export const FIRST_PARTY_DECK_IDS = new Set(["written_letters"]);
