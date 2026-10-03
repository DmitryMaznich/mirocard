// «Прописи 2»: конструктор страниц прописей. Builtin topic (no deck zip): glyph data is bundled
// from tools/propis (see topics/renderers/propis2/data.js). Its home is its own screen, not
// ParamsScreen -- App.jsx routes "params" to the builder for this renderer.
export const PROPIS2_TOPIC_ID = "propis2";

export function buildPropis2TopicRecord() {
  return {
    meta: {
      id: PROPIS2_TOPIC_ID,
      renderer: "propis2",
      version: "0.1.0",
      title: { ru: "Прописи 2" },
      builtin: true,
      about: {
        description: "Конструктор страниц прописей: взрослый собирает страницу из элементов, букв, слогов, слов и текстов; ребёнок пишет на бумаге и по нажатию смотрит анимацию написания.",
        goals: [
          "Собрать страницу для практики письма из готовых траекторий.",
          "Показать ребёнку написание любого образца на странице.",
        ],
        finalGoal: "Ребёнок пишет ручкой на бумаге, опираясь на экранный образец; оценку и повторение определяет взрослый.",
        flow: [
          "Соберите страницу или возьмите готовый набор.",
          "Откройте страницу в режиме ученика.",
          "Нажмите на образец, чтобы показать его написание.",
        ],
      },
    },
    modes: [
      {
        id: "builder",
        type: "builder",
        evaluation: "none",
        hideConceptPicker: true,
        hideVideoReward: true,
        ui: { title: { ru: "Конструктор страниц" }, instruction: { ru: "Соберите страницу прописи" } },
      },
    ],
    cards: [{ id: "propis2_page", conceptId: "propis2_page", primary: true }],
    installedAt: "builtin",
  };
}
