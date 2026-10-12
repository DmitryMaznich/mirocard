// Shared by the browser and server. myPeople is the canonical store; closeAdults
// is a compatibility projection for older clients, never a second editor.
const list = (value) => Array.isArray(value) ? value : [];
const relationWords = new Set(['мама', 'папа', 'бабушка', 'дедушка', 'тётя', 'тетя', 'дядя']);
export const personTime = (p) => p?.deletedAt ?? p?.updatedAt ?? p?.createdAt ?? '';

export function mergePeopleRecords(local, incoming) {
  const byId = new Map();
  for (const person of [...list(local), ...list(incoming)]) {
    if (!person?.id) continue;
    const current = byId.get(person.id);
    if (current?.deletedAt && !person.deletedAt) continue;
    const resolved = list(current?.photos).some((photo) => typeof photo === 'string' && photo.startsWith('/api/photos/'));
    const temporary = list(person.photos).some((photo) => typeof photo === 'string' && photo.startsWith('data:'));
    if (current && personTime(current) === personTime(person) && resolved && temporary) continue;
    if (!current || (person.deletedAt && !current.deletedAt) || personTime(person) >= personTime(current)) {
      byId.set(person.id, { ...current, ...person });
    }
  }
  return [...byId.values()];
}

export function studentPeople(student) {
  const people = list(student?.myPeople).map((p) => ({ ...p }));
  for (const adult of list(student?.closeAdults)) {
    if (!adult?.id || !adult.name) continue;
    const id = `adult_${adult.id}`;
    // Stable aliases, including deleted records, make migration idempotent.
    let existing = people.find((p) => p.id === id || p.id === adult.id || p.legacyAdultId === adult.id || list(p.legacyAdultIds).includes(adult.id));
    if (existing) continue;
    // Never deduplicate by name alone. Only an unambiguous identical photo
    // and identity can link a legacy entry to an existing learning record.
    const matches = adult.photo ? people.filter((p) => !p.deletedAt && list(p.photos).includes(adult.photo)
      && [p.name, p.relation].some((s) => s?.trim().toLowerCase() === adult.name.trim().toLowerCase())) : [];
    existing = matches.length === 1 ? matches[0] : null;
    if (existing && !existing.legacyAdultId) {
      Object.assign(existing, { legacyAdultId: adult.id, sentenceLabel: adult.name, useInSentences: true, useInChat: true });
      continue;
    }
    const timestamp = student?.closeAdultsUpdatedAt ?? student?.updatedAt ?? student?.createdAt ?? null;
    people.push({ id, legacyAdultId: adult.id, legacyImported: true,
      type: 'person', name: adult.name, relation: relationWords.has(adult.name.trim().toLowerCase()) ? adult.name : '',
      contexts: ['family'], photos: adult.photo ? [adult.photo] : [],
      introducedAxes: [], enabled: true, useInSentences: true, useInChat: true,
      sentenceLabel: adult.name, createdAt: timestamp, updatedAt: timestamp, deletedAt: null });
  }
  return people;
}

export function personLabel(person) {
  return person.sentenceLabel?.trim() || person.relation?.trim() || person.name?.trim() || '';
}

export function peopleFor(student, purpose) {
  const flag = purpose === 'chat' ? 'useInChat' : 'useInSentences';
  return studentPeople(student).filter((p) => !p.deletedAt && p.type !== 'pet' && p[flag] === true && personLabel(p))
    .map((p) => ({ id: p.legacyAdultId ?? p.id, personId: p.id, name: personLabel(p), photo: list(p.photos)[0] ?? null }));
}

export function legacyAdults(people) {
  return list(people).filter((p) => !p.deletedAt && p.type !== 'pet' && (p.useInSentences || p.useInChat) && personLabel(p))
    .map((p) => ({ id: p.legacyAdultId ?? p.id, name: personLabel(p), photo: list(p.photos)[0] ?? null }));
}

export function migrateStudentPeople(student) {
  if (!student) return student;
  if (!list(student.closeAdults).length) return student;
  return { ...student, myPeople: studentPeople(student), peopleSchemaVersion: 1 };
}

// Translate legacy whole-list updates without deleting richer records belonging
// to other topics. Per-person timestamps protect concurrent canonical edits.
export function applyLegacyAdults(student, adults, timestamp) {
  const people = studentPeople(student);
  const incoming = list(adults);
  const seen = new Set();
  for (const adult of incoming) {
    if (!adult?.id || !adult.name) continue;
    let person = people.find((p) => (p.legacyAdultId ?? p.id) === adult.id || list(p.legacyAdultIds).includes(adult.id));
    if (person?.mergedInto) person = people.find((p) => p.id === person.mergedInto) ?? person;
    if (!person) {
      person = studentPeople({ closeAdults: [adult], closeAdultsUpdatedAt: timestamp })[0];
      people.push(person);
    }
    seen.add(person.id);
    if (person.deletedAt || personTime(person) > timestamp) continue;
    person.legacyAdultId ??= adult.id;
    if (person.legacyImported) person.name = adult.name;
    person.sentenceLabel = adult.name;
    person.photos = adult.photo ? [adult.photo, ...list(person.photos).filter((p) => p !== adult.photo)] : list(person.photos);
    person.useInSentences = true;
    person.useInChat = true;
    person.updatedAt = timestamp;
  }
  for (const person of people) {
    if (seen.has(person.id) || person.deletedAt || personTime(person) > timestamp || (!person.useInSentences && !person.useInChat)) continue;
    // An old client can remove a person from its subjects/contacts without
    // erasing their album photos, progress or important-date references.
    person.useInSentences = false;
    person.useInChat = false;
    person.updatedAt = timestamp;
  }
  return people;
}

export function resolvePerson(people, id) {
  const visited = new Set();
  let person = list(people).find((p) => p.id === id);
  while (person?.mergedInto && !visited.has(person.id)) {
    visited.add(person.id);
    person = list(people).find((p) => p.id === person.mergedInto);
  }
  return person && !person.deletedAt ? person : null;
}

export function mergePeopleCards(people, sourceId, targetId, timestamp) {
  const source = resolvePerson(people, sourceId), target = resolvePerson(people, targetId);
  if (!source || !target || source.id === target.id || source.type !== target.type) return people;
  const unique = (a, b) => [...new Set([...list(a), ...list(b)])];
  const merged = { ...target, photos: unique(target.photos, source.photos),
    contexts: unique(target.contexts, source.contexts), introducedAxes: unique(target.introducedAxes, source.introducedAxes),
    relation: target.relation || source.relation, enabled: target.enabled || source.enabled,
    sentenceLabel: target.sentenceLabel || source.sentenceLabel,
    useInSentences: target.useInSentences || source.useInSentences, useInChat: target.useInChat || source.useInChat,
    legacyAdultId: target.legacyAdultId ?? source.legacyAdultId,
    legacyAdultIds: unique([target.legacyAdultId, target.id, ...list(target.legacyAdultIds)].filter(Boolean), [source.legacyAdultId, source.id, ...list(source.legacyAdultIds)].filter(Boolean)),
    updatedAt: timestamp };
  return people.map((p) => p.id === target.id ? merged : p.id === source.id
    ? { ...p, photos: [], deletedAt: timestamp, updatedAt: timestamp, mergedInto: target.id } : p);
}
