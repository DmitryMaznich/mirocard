export function buildDailyOrientationTopicRecord() {
  return {
    meta: {
      id: "daily_orientation",
      renderer: "daily_orientation",
      version: "1.0.0",
      title: { ru: "Сегодня" },
      avatar: "media/avatar_daily_orientation.svg",
      builtin: true,
      about: {
        description: "Постоянный визуальный ориентир для коротких разговоров о дне, дате, месяце, времени года, времени суток и текущем времени.",
        goals: [
          "Связать понятия «вчера», «сегодня» и «завтра» с реальными датами.",
          "Поддерживать совместное называние дня недели, числа, месяца, времени года, времени суток и времени.",
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
          showDaypart: {
            type: "boolean",
            label: { ru: "Сейчас (утро, день, вечер, ночь)" },
            default: true,
            section: "Что показывать",
          },
          showWeather: {
            type: "boolean",
            label: { ru: "Погода (отмечает ребёнок)" },
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
          // «План на день»: the weekly plan's events for the day (2026-11-23).
          // The wall screen no longer shows an analog dial (it is in the «Часы»
          // modal), so there is no showAnalogClock switch any more.
          showPlan: {
            type: "boolean",
            label: { ru: "План на день" },
            default: true,
            section: "Что показывать",
          },
          // Where each part of the day starts (daypartBounds in timeUtils.js):
          // утро с = wakeHour and ночь с = bedHour keep their old names, so
          // settings saved as «Подъём»/«Отбой» still hold.
          wakeHour: {
            type: "enum",
            label: { ru: "Утро с" },
            values: [4, 5, 6, 7, 8, 9, 10],
            labels: { ru: { 4: "4:00", 5: "5:00", 6: "6:00", 7: "7:00", 8: "8:00", 9: "9:00", 10: "10:00" } },
            default: 7,
            compact: true,
            section: "Режим дня",
          },
          dayHour: {
            type: "enum",
            label: { ru: "День с" },
            values: [9, 10, 11, 12, 13, 14, 15],
            labels: { ru: { 9: "9:00", 10: "10:00", 11: "11:00", 12: "12:00", 13: "13:00", 14: "14:00", 15: "15:00" } },
            default: 12,
            compact: true,
            section: "Режим дня",
          },
          eveningHour: {
            type: "enum",
            label: { ru: "Вечер с" },
            values: [14, 15, 16, 17, 18, 19, 20],
            labels: { ru: { 14: "14:00", 15: "15:00", 16: "16:00", 17: "17:00", 18: "18:00", 19: "19:00", 20: "20:00" } },
            default: 18,
            compact: true,
            section: "Режим дня",
          },
          bedHour: {
            type: "enum",
            label: { ru: "Ночь с" },
            values: [18, 19, 20, 21, 22, 23],
            labels: { ru: { 18: "18:00", 19: "19:00", 20: "20:00", 21: "21:00", 22: "22:00", 23: "23:00" } },
            default: 21,
            compact: true,
            section: "Режим дня",
          },
          // After bedtime the wall screen goes dark: the night pictogram,
          // «НОЧЬ», a dim clock and what comes next (2026-11-24). A tap shows the
          // usual screen for a minute.
          nightScreen: {
            type: "boolean",
            label: { ru: "Тёмный экран ночью" },
            default: true,
            section: "Режим дня",
          },
          // The first tap puts the screen in fullscreen (hides Android's bars).
          // Off for a pinned app: each entry made Android show its «swipe from
          // the top to exit» hint (owner, 2026-11-24).
          fullscreen: {
            type: "boolean",
            label: { ru: "Во весь экран" },
            default: true,
            section: "Что показывать",
          },
          // "СРЕДА" or "Среда" on the cards -- one form everywhere, for a
          // child who reads whole words.
          letterCase: {
            type: "enum",
            label: { ru: "Буквы на карточках" },
            values: ["upper", "sentence"],
            labels: { ru: { upper: "ЗАГЛАВНЫЕ", sentence: "Обычные" } },
            default: "upper",
            section: "Что показывать",
          },
          // "девять часов двадцать минут" or "двадцать минут десятого".
          timeWordsStyle: {
            type: "enum",
            label: { ru: "Время словами" },
            values: ["exact", "spoken"],
            labels: { ru: { exact: "Точно", spoken: "Как говорят дома" } },
            default: "exact",
            section: "Что показывать",
          },
          // Speaker buttons on the cards. Off by default: the screen is used
          // with an adult and the child answers; switch on for a child who
          // can't say the answer, so the speaker becomes their voice.
          cardSound: {
            type: "boolean",
            label: { ru: "Озвучка карточек" },
            default: false,
            section: "Озвучка",
          },
          // How the screen marks a day from the student's "Важные даты":
          // garland + warm background, the ribbon alone, or nothing at all.
          importantDatesStyle: {
            type: "enum",
            label: { ru: "Важные даты на экране" },
            values: ["bright", "calm", "off"],
            labels: { ru: { bright: "Празднично", calm: "Спокойно", off: "Не показывать" } },
            default: "bright",
            section: "Важные даты",
          },
          weeklyPlan: {
            type: "free_text",
            label: { ru: "План на неделю" },
            hint: {
              ru: "По строке на день: «Пн: Школа». Пустая или отсутствующая строка — день просто не показывается в окне недели (открывается тапом по карточке «День недели»).",
            },
            default: "",
            rows: 8,
            placeholder: { ru: "Пн: Школа\nВт: Школа\nСр: Школа\nЧт: Школа\nПт: Школа\nСб: Поездка в парк\nВс: " },
            section: "План на неделю",
          },
          // Photos of the plan's items: JSON of item key -> /api/photos/… URL,
          // edited only by the weekly plan editor (see weekPlan.js).
          planPhotos: {
            type: "free_text",
            label: { ru: "Фото дел плана" },
            default: "",
            section: "План на неделю",
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
