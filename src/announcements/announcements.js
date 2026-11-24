// Announcements: one-time messages to users (docs/announcements.md). An entry here + a deploy = the announcement is out.
// Each user sees it once: after «Понятно» it is never shown again on this account (on any device), or on this device when
// signed out. Shown on the home screen, never during a lesson. Newest first — the first due entry is shown, the next one
// on a later visit.
//
// {
//   id: "propis2-0-8-0",              // unique, never reused or changed: the «read» mark is kept under it
//   title: { ru, sl, en },            // interface languages; missing ones fall back (language → English → Russian)
//   body: { ru: ["абзац", …], … },    // paragraphs
//   from: "2026-11-24",               // optional: not before this day
//   until: "2027-01-31",              // optional: not from this day on (keep it: an old news item should not greet a user months later)
//   topics: ["propis2"],              // optional: only to accounts that have one of these topics
//   accountsCreatedBefore: "2026-11-24", // optional: only to accounts made before this day (news of a change)
//   languages: ["ru"],                // optional: only to these interface languages
//   match: async (ctx) => true,       // optional: any other rule (ctx: announcementHost's context)
// }
export const ANNOUNCEMENTS = [
  {
    id: "propis2-0-8-0",
    topics: ["propis2"],
    accountsCreatedBefore: "2026-11-24",
    until: "2027-01-31",
    title: {
      ru: "«Прописи» обновились",
      sl: "Zvezki za pisanje so posodobljeni",
      en: "The Copybook has been updated",
    },
    body: {
      ru: [
        "В одной теме теперь русский, болгарский, казахский, английский и словенский. Отметьте свои языки кнопкой «＋» на экране тетрадей — тема покажет только их.",
        "Тетради других языков никуда не делись: они собраны под «Другие».",
        "Русские прописные буквы доработаны, у каждой буквы можно выбрать отдельные элементы для письма. Старые тетради открываются уже с новым начертанием — если вы допечатываете страницы к распечатанной раньше тетради, лучше перепечатать её целиком.",
      ],
      sl: [
        "V eni temi so zdaj ruščina, bolgarščina, kazaščina, angleščina in slovenščina. Na zaslonu zvezkov z gumbom »＋« označite svoje jezike — tema bo prikazala samo njih.",
        "Zvezki v drugih jezikih niso izginili: zbrani so pod »Другие« (drugi).",
        "Ruske pisane črke so izboljšane, pri vsaki črki lahko izberete posamezne elemente za pisanje. Stari zvezki se že odprejo z novo obliko črk — če tiskate dodatne strani k prej natisnjenemu zvezku, ga raje natisnite v celoti znova.",
      ],
      en: [
        "One topic now holds Russian, Bulgarian, Kazakh, English and Slovenian. Mark your languages with the «＋» button on the notebooks screen — the topic will show only those.",
        "Notebooks in other languages are still there, under «Другие» (other).",
        "The Russian cursive letters have been refined: you can now pick separate elements of a letter to write. Old notebooks open with the new letter shapes — if you print extra pages for a notebook printed earlier, it is better to reprint the whole notebook.",
      ],
    },
  },
];
