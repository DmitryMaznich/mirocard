// Names are native to each language. This registry describes preferences,
// not availability of translated lessons or adult UI.
export const LANGUAGES = Object.freeze([
  Object.freeze({ code: "ru", label: "Русский" }),
  Object.freeze({ code: "sl", label: "Slovenščina" }),
  Object.freeze({ code: "en", label: "English" }),
]);
export const isLessonLanguage = (value) => LANGUAGES.some(({ code }) => code === value);
export const languageName = (value) => LANGUAGES.find(({ code }) => code === value)?.label ?? value;
