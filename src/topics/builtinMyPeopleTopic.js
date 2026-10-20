// A first-party, per-student topic. Cards are generated only from the
// pupil's private profile; there is intentionally no downloadable deck.

// Every mode can run silent: the adult reads the question themselves, or
// the child is overwhelmed by the voice. On by default; off means no speech
// at all and no "hear it again" buttons.
const voiceParam = {
  voice: {
    type: "boolean",
    label: { ru: "Озвучка" },
    hint: { ru: "Голос задаёт вопрос и называет ответ. Выключите — только текст и фото." },
    default: true,
  },
};

// The seven old album modes (a circle × names/relations, plus «Все люди»).
// Replaced by «Подпиши фото» with the same two choices as parameters; kept
// as `retired` so session history and saved lesson plans that name them
// still resolve and run. Mode pickers leave retired modes out.
const retiredAlbumMode = (id, title) => ({
  id,
  type: "people_album",
  evaluation: "auto",
  loop: true,
  regenerateOnLoop: true,
  hideConceptPicker: true,
  retired: true,
  params: {
    peopleCount: { type: "enum", label: { ru: "Людей в альбоме" }, values: [2, 3, 4, 6], default: 4 },
  },
  ui: { title: { ru: title }, instruction: { ru: "Старый режим, заменён на «Подпиши фото»" } },
});

// «Подпиши фото»: drag a word onto each photo. Needs reading, so it comes
// after the spoken modes. Which circle and which words are parameters, not
// seven separate modes.
const labelPhotosMode = {
  id: "label_photos",
  type: "people_album",
  evaluation: "auto",
  loop: true,
  regenerateOnLoop: true,
  hideConceptPicker: true,
  params: {
    circle: {
      type: "enum",
      label: { ru: "Чьи фото" },
      values: ["family", "home", "school", "all"],
      labels: { ru: { family: "Семья и питомцы", home: "Люди дома", school: "Школа", all: "Все" } },
      default: "family",
    },
    labelKind: {
      type: "enum",
      label: { ru: "Что подписываем" },
      values: ["relation", "name", "both"],
      labels: { ru: { relation: "Мама, папа…", name: "Имена", both: "И то и другое" } },
      default: "relation",
    },
    peopleCount: {
      type: "enum",
      label: { ru: "Фото на странице" },
      // Eight words to sort was too many for most of these children; three
      // fits one row. Two to start with, as in «Покажи».
      values: [2, 3, 4, 6],
      default: 2,
    },
  },
  ui: {
    title: { ru: "Подпиши фото" },
    instruction: { ru: "Перетащить подпись на фото: «мама», «папа» или имя. Нужно уметь читать" },
  },
};

// «Найди такого же»: match two different photos of one person, no words.
// The first step, before «Покажи»: recognising a face across photos, apart
// from understanding "мама". Needs people with at least two photos.
const matchSameMode = {
  id: "match_same",
  type: "person_match",
  evaluation: "auto",
  loop: true,
  regenerateOnLoop: true,
  hideConceptPicker: true,
  params: {
    fieldSize: {
      type: "enum",
      label: { ru: "Фото на выбор" },
      values: [2, 3, 4],
      default: 2,
    },
  },
  ui: {
    title: { ru: "Найди такого же" },
    instruction: { ru: "Без слов: найти того же человека на другом фото. Нужно хотя бы 2 фото у человека" },
  },
};

// «Покажи»: "Где мама?" -- tap the right photo. The receptive step that
// comes before naming, and the one that needs no reading.
const showMeMode = {
  id: "show_me",
  type: "person_point",
  evaluation: "auto",
  loop: true,
  regenerateOnLoop: true,
  hideConceptPicker: true,
  params: {
    fieldSize: {
      type: "enum",
      label: { ru: "Фото на экране" },
      values: [1, 2, 3, 4],
      labels: { ru: { 1: "1 · без выбора" } },
      default: 2,
    },
  },
  ui: {
    title: { ru: "Покажи" },
    instruction: { ru: "«Где мама?» — ребёнок показывает нужное фото" },
  },
};

// Short fixed questions (name, age, mum's name...). The child answers out
// loud, with a gesture, or through AAC; the adult records the response
// quality using the session's standard controls. The questions come in four
// levels (engine ABOUT_ME_LEVELS); each round asks the not-yet-known ones
// first, so a few rounds cover them all.
const aboutMeMode = {
  id: "about_me",
  type: "about_me",
  evaluation: "adult",
  loop: true,
  regenerateOnLoop: true,
  hideConceptPicker: true,
  params: {
    levels: {
      type: "enum_multi",
      label: { ru: "Разделы вопросов" },
      values: ["self", "family", "day", "safety"],
      labels: { ru: { self: "Я: имя, возраст", family: "Семья и питомцы", day: "Садик или школа, день рождения", safety: "Фамилия, адрес, телефон" } },
      default: ["self", "family"],
    },
    questionCount: {
      type: "enum",
      label: { ru: "Вопросов за раунд" },
      values: [4, 6, 8],
      default: 6,
    },
  },
  ui: {
    title: { ru: "Обо мне" },
    instruction: { ru: "Короткие вопросы о себе: имя, возраст, семья, адрес и телефон, садик или школа" },
  },
};

// «Представься»: a new person asks the same short questions as «Обо мне»,
// the child answers in whole sentences and closes by telling it all at
// once. The advanced level, once the short answers are solid. Taught with
// script fading: the written answer, then only its opening words, then
// nothing -- the adult picks where to start.
const introduceSelfMode = {
  id: "introduce_self",
  type: "about_me",
  evaluation: "adult",
  loop: true,
  regenerateOnLoop: true,
  hideConceptPicker: true,
  params: {
    scriptHint: {
      type: "enum",
      label: { ru: "Подсказка на экране" },
      values: ["full", "starter", "none"],
      labels: { ru: { full: "Весь ответ", starter: "Начало фразы", none: "Без подсказки" } },
      default: "full",
    },
  },
  ui: {
    title: { ru: "Представься" },
    instruction: { ru: "Продвинутый уровень: познакомиться с новым человеком и рассказать о себе целыми фразами" },
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
    instruction: { ru: "Ребёнок называет человека по фотографии, взрослый отмечает ответ." },
  },
};

// "Озвучка" goes last in every mode's settings.
const withVoice = (mode) => ({ ...mode, params: { ...(mode.params ?? {}), ...voiceParam } });

export function buildMyPeopleTopicRecord() {
  return {
    meta: {
      id: "my_people",
      renderer: "my_people",
      version: "1.4.0",
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
          "Заполните «Окружение ребёнка»: близкие с фотографиями, для «Обо мне» — личные данные.",
          "«Найди такого же»: без слов найти того же человека на другом фото — для тех, кто ещё не понимает «Где мама?».",
          "«Покажи»: ребёнок находит человека по слову «Где мама?». Здесь же он знакомится с новыми людьми.",
          "«Кто это?»: ребёнок сам называет тех, кого уже находил.",
          "«Обо мне»: короткие вопросы о себе с подсказками по шагам.",
          "«Подпиши фото» — когда ребёнок читает: сначала семья и слова «мама», «папа», потом имена и другие круги.",
          "«Представься» — продвинутый уровень, когда короткие ответы уже уверенные.",
        ],
      },
    },
    // The teaching ladder: match («Найди такого же») → recognise by the
    // word («Покажи») → name («Кто это?») →
    // answer about yourself → label photos (needs reading) → introduce
    // yourself. Mode pickers keep this order.
    modes: [
      matchSameMode,
      showMeMode,
      whoIsThisMode,
      aboutMeMode,
      labelPhotosMode,
      introduceSelfMode,
      retiredAlbumMode("family_names", "Семья и питомцы: имена"),
      retiredAlbumMode("family_relations", "Семья и питомцы: кто это"),
      retiredAlbumMode("home_names", "Люди дома: имена"),
      retiredAlbumMode("home_relations", "Люди дома: кто это"),
      retiredAlbumMode("school_names", "Школа: имена"),
      retiredAlbumMode("school_relations", "Школа: кто это"),
      retiredAlbumMode("mix", "Все люди"),
    ].map(withVoice),
    // A metadata card makes generic navigation and legacy selection links safe;
    // the engine deliberately ignores it and uses the pupil's own records.
    cards: [{ id: "my_people_profile", conceptId: "my_people_profile", primary: true }],
    installedAt: "builtin",
  };
}
