// A first-party, per-student topic. Cards are generated only from the
// pupil's private profile; there is intentionally no downloadable deck.

const peopleCountParam = {
  peopleCount: {
    type: "enum",
    label: { ru: "Людей в альбоме" },
    values: [4, 6, 8],
    default: 4,
  },
};

const mode = (id, title, instruction) => ({
  id,
  type: "people_album",
  evaluation: "auto",
  loop: true,
  regenerateOnLoop: true,
  hideConceptPicker: true,
  params: peopleCountParam,
  ui: { title: { ru: title }, instruction: { ru: instruction } },
});

const aboutMeMode = {
  id: "about_me",
  type: "about_me",
  // The child answers out loud, with a gesture, or through AAC; the adult
  // records the response quality using the session's standard controls.
  evaluation: "adult",
  loop: true,
  regenerateOnLoop: true,
  hideConceptPicker: true,
  ui: {
    title: { ru: "Обо мне" },
    instruction: { ru: "Ответьте в жизненной ситуации, взрослый отметит качество" },
  },
};

const whoIsThisMode = {
  id: "who_is_this",
  type: "person_naming",
  // The child names the person or their relationship out loud; the adult
  // records the response quality using the session's standard controls.
  evaluation: "adult",
  loop: true,
  regenerateOnLoop: true,
  hideConceptPicker: true,
  ui: {
    title: { ru: "Кто это?" },
    instruction: { ru: "Назовите человека на фотографии или его связь с вами" },
  },
};

export function buildMyPeopleTopicRecord() {
  return {
    meta: {
      id: "my_people",
      renderer: "my_people",
      version: "1.1.0",
      title: { ru: "Мои люди" },
      avatar: "media/avatar_my_people.svg",
      builtin: true,
      about: {
        description: "Индивидуальная тема с фотографиями значимых людей из жизни ребёнка.",
        goals: [
          "Различать имя человека и его связь с ребёнком.",
          "Узнавать несколько людей внутри одного знакомого круга.",
          "Переносить навык между разными фотографиями и кругами общения.",
        ],
        finalGoal: "Ребёнок уверенно узнаёт значимых людей и понимает, кто они для него.",
        flow: [
          "Выберите круг людей и размер фотоальбома.",
          "Сначала сопоставляйте фотографии с именами.",
          "Затем используйте тот же формат для связей с ребёнком.",
          "Переходите к «Всем людям», когда отдельные круги стали знакомыми.",
        ],
      },
    },
    modes: [
      aboutMeMode,
      mode("family_names", "Семья и питомцы: имена", "Подберите имена к фотографиям"),
      mode("family_relations", "Семья и питомцы: кто это", "Подберите связь с ребёнком"),
      mode("home_names", "Люди дома: имена", "Подберите имена к фотографиям"),
      mode("home_relations", "Люди дома: кто это", "Подберите связь с ребёнком"),
      mode("school_names", "Школа: имена", "Подберите имена к фотографиям"),
      mode("school_relations", "Школа: кто это", "Подберите связь с ребёнком"),
      mode("mix", "Все люди", "Сначала имена, затем кто эти люди"),
      whoIsThisMode,
    ],
    // A metadata card makes generic navigation and legacy selection links safe;
    // the engine deliberately ignores it and uses the pupil's own records.
    cards: [{ id: "my_people_profile", conceptId: "my_people_profile", primary: true }],
    installedAt: "builtin",
  };
}
