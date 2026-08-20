// A topic is "personal" — belongs in the "Мои темы" section instead of the
// shared category grid — when it was either imported by hand (a therapist's
// own ZIP, never published to the shared catalog) or explicitly granted to
// this account by an admin (source: "grant" in ownedTopics), as opposed to
// a free/paid deck from the general catalog.
export function getTopicOrigin(meta, ownedTopics) {
  if (meta.origin === "imported") return "imported";
  const owned = (ownedTopics ?? []).find((o) => o.topicId === meta.id);
  if (owned?.source === "grant") return "grant";
  return null;
}

export function isPersonalTopic(meta, ownedTopics) {
  return getTopicOrigin(meta, ownedTopics) != null;
}

export function getPersonalTopicCaption(meta, ownedTopics) {
  const origin = getTopicOrigin(meta, ownedTopics);
  if (origin === "imported") return "Импортирована вручную";
  if (origin === "grant")    return "Открыта специально для вас";
  return null;
}
