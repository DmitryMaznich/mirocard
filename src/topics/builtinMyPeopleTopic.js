// A first-party, per-student topic.  Cards are made at session start from
// that student's private profile; there is intentionally no downloadable deck.

const mode = (id, type, title, instruction, options = {}) => ({
  id,
  type,
  evaluation: type === "intro" ? "none" : (type === "question_answer" ? "none" : "auto"),
  hideConceptPicker: true,
  ui: { title: { ru: title }, instruction: { ru: instruction } },
  ...options,
});

export function buildMyPeopleTopicRecord() {
  return {
    meta: {
      id: "my_people",
      renderer: "my_people",
      version: "1.0.0",
      title: { ru: "Мои люди" },
      avatar: "media/avatar_my_people.svg",
      builtin: true,
      about: {
        description: "Индивидуальная тема с фотографиями людей из жизни ребёнка.",
        goals: [
          "Различать имя человека и его связь с ребёнком.",
          "Узнавать людей семьи, дома и школы в знакомом и смешанном контексте.",
          "Отрабатывать личные ответы: имя, фамилию и место проживания.",
        ],
        finalGoal: "Ребёнок уверенно узнаёт и называет значимых людей в разных ситуациях.",
        flow: [
          "Сначала познакомьте с фотографией: имя и связь — отдельными карточками.",
          "Затем выбирайте человека среди фотографий в одной группе.",
          "После этого переходите к смешанному режиму.",
        ],
      },
    },
    modes: [
      mode("family_names_intro", "intro", "Семья: знакомство с именами", "Слушайте имя и листайте карточки"),
      mode("family_names_find", "find_n", "Семья: найди по имени", "Кто это?", { params: { optionCount: { type: "enum", label: { ru: "Вариантов" }, values: [2, 4], default: 2 } } }),
      mode("family_relations_intro", "intro", "Семья: кто кому", "Слушайте связь и листайте карточки"),
      mode("family_relations_find", "find_n", "Семья: найди по связи", "Кто это?", { params: { optionCount: { type: "enum", label: { ru: "Вариантов" }, values: [2, 4], default: 2 } } }),
      mode("home_names_intro", "intro", "Дома: знакомство с именами", "Слушайте имя и листайте карточки"),
      mode("home_names_find", "find_n", "Дома: найди по имени", "Кто это?", { params: { optionCount: { type: "enum", label: { ru: "Вариантов" }, values: [2, 4], default: 2 } } }),
      mode("home_relations_intro", "intro", "Дома: кто это", "Слушайте связь и листайте карточки"),
      mode("home_relations_find", "find_n", "Дома: найди по связи", "Кто это?", { params: { optionCount: { type: "enum", label: { ru: "Вариантов" }, values: [2, 4], default: 2 } } }),
      mode("school_names_intro", "intro", "Школа: знакомство с именами", "Слушайте имя и листайте карточки"),
      mode("school_names_find", "find_n", "Школа: найди по имени", "Кто это?", { params: { optionCount: { type: "enum", label: { ru: "Вариантов" }, values: [2, 4], default: 2 } } }),
      mode("school_relations_intro", "intro", "Школа: кто это", "Слушайте связь и листайте карточки"),
      mode("school_relations_find", "find_n", "Школа: найди по связи", "Кто это?", { params: { optionCount: { type: "enum", label: { ru: "Вариантов" }, values: [2, 4], default: 2 } } }),
      mode("mix", "find_n", "Микс", "Кто это?", { params: { optionCount: { type: "enum", label: { ru: "Вариантов" }, values: [2, 4], default: 4 } } }),
      mode("self_name", "intro", "Моё имя", "Слушайте и листайте карточку"),
      mode("family_name", "question_answer", "Моя фамилия", "Какая у тебя фамилия?"),
      mode("family_label", "question_answer", "Наша семья", "Как называется ваша семья?"),
      mode("city", "question_answer", "Где я живу", "В каком городе ты живёшь?"),
      mode("address", "question_answer", "Мой адрес", "По какому адресу ты живёшь?"),
    ],
    // A metadata card makes generic navigation and legacy selection links safe;
    // the engine deliberately ignores it and uses the pupil's own records.
    cards: [{ id: "my_people_profile", conceptId: "my_people_profile", primary: true }],
    installedAt: "builtin",
  };
}
