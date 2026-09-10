export function isCorrectAssociation(axis, answer, entry) {
  if (answer.personId === entry.personId) return true;
  // A label such as «учитель» may legitimately appear twice. The child does
  // not have to distinguish two identical words; either matching label is
  // valid for either person with that relationship.
  return axis === "relation" && answer.label === entry.label;
}
