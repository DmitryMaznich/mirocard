// Additive, shared vocabulary. The legacy relation string remains readable.
export const wordKey = value => String(value ?? '').normalize('NFKC').toLocaleLowerCase('ru').replaceAll('ё', 'е').replace(/\s+/g, ' ').trim();
const FORMS = {
  мама: ['mother', 'маму'], папа: ['father', 'папу'], сестра: ['sister', 'сестру'], брат: ['brother', 'брата'],
  бабушка: ['grandmother', 'бабушку'], дедушка: ['grandfather', 'дедушку'], тетя: ['aunt', 'тётю'], дядя: ['uncle', 'дядю'],
  друг: ['friend_m', 'друга'], подруга: ['friend_f', 'подругу'], одноклассник: ['classmate_m', 'одноклассника'],
  одноклассница: ['classmate_f', 'одноклассницу'], учитель: ['teacher_m', 'учителя'], учительница: ['teacher_f', 'учительницу'],
};
export function relationEntry(value) {
  const label = String(value ?? '').trim();
  const known = FORMS[wordKey(label)];
  return { key: known?.[0] ?? `custom_${wordKey(label)}`, label, acceptedLabels: [label], questionForm: known?.[1] ?? '' };
}
export function personRelations(person) {
  const entries = Array.isArray(person?.relations) ? person.relations.filter(r => r?.label?.trim()).map(r => ({ ...relationEntry(r.label), ...r })) : [];
  if (person?.relation?.trim() && !entries.some(r => wordKey(r.label) === wordKey(person.relation))) entries.unshift(relationEntry(person.relation));
  return [...new Map(entries.map(r => [r.key, r])).values()];
}
export function comparePeopleDocuments(a, b) {
  if (!b) return 1;
  return (Number(a?.revision) || 0) - (Number(b?.revision) || 0) || String(a?.id ?? '').localeCompare(String(b?.id ?? ''));
}
export function isPeopleDocumentKey(key) { return /^my_people:v2:[^:]+:(plan|draft|route|exposure):/.test(key); }
