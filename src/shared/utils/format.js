export function formatDate(isoString) {
  if (!isoString) return "";
  return new Date(isoString).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function getTopicTitle(title, lang = "ru") {
  if (!title) return "";
  if (typeof title === "string") return title;
  return title[lang] ?? title.ru ?? title.en ?? "";
}

export function getInitials(name) {
  const str = typeof name === "string" ? name : getTopicTitle(name);
  if (!str) return "?";
  return str
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

// Returns "not_installed" | "installed" | "update_available"
export function getTopicCatalogStatus(catalogEntry, topicRecords) {
  const installed = topicRecords.find((r) => r.meta.id === catalogEntry.id);
  if (!installed) return "not_installed";
  if (installed.meta.version !== catalogEntry.version) return "update_available";
  return "installed";
}
