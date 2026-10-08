export const STATUS_LABELS = {
  active: "Подтверждён",
  pending: "Ждёт подтверждения",
  deleted: "Удалён · данные сохранены",
  archived: "Удалён · данные сохранены",
  blocked: "Заблокирован",
  deletion_pending: "Ожидает удаления",
  purged: "Данные удалены",
};
export const PLAN_LABELS = {
  monthly: "Месяц",
  half_year: "Полгода",
  annual: "Год",
  trial: "Пробный период",
  all_access: "Постоянный доступ",
};
export function accountName(a) {
  if (a.status === "purged") return "Удалённый аккаунт";
  return (
    a.displayName ||
    [a.firstName, a.lastName].filter(Boolean).join(" ") ||
    a.email ||
    "Без имени"
  );
}
export function isOnline(a) {
  return (a.activeSessions ?? []).length > 0;
}
export function topicAccess(a) {
  const topics = new Map(
    (a.ownedTopics ?? [])
      .filter((t) => t.source !== "download" && t.source !== "request")
      .map((t) => [t.topicId, { ...t, assignment: false }]),
  );
  for (const t of a.topicAssignments ?? [])
    topics.set(t.topicId, { ...t, assignment: true });
  return [...topics.values()];
}
export function filterAccounts(accounts, filters, now = Date.now()) {
  const query = (filters.query ?? "").trim().toLocaleLowerCase("ru");
  return accounts.filter((a) => {
    if (
      query &&
      ![accountName(a), a.email, a.id].some((s) =>
        String(s ?? "")
          .toLocaleLowerCase("ru")
          .includes(query),
      )
    )
      return false;
    const removed = [
      "archived",
      "deleted",
      "deletion_pending",
      "purged",
    ].includes(a.status);
    if (filters.status === "current" && removed) return false;
    if (filters.status === "removed" && !removed) return false;
    if (
      filters.status &&
      !["all", "current", "removed"].includes(filters.status) &&
      a.status !== filters.status
    )
      return false;
    if (filters.activity === "online" && !isOnline(a)) return false;
    if (
      filters.activity === "week" &&
      (!a.lastSeenAt || Date.parse(a.lastSeenAt) < now - 7 * 86400000)
    )
      return false;
    if (filters.activity === "never" && a.lastSeenAt) return false;
    if (filters.access === "active" && !a.subscription) return false;
    if (filters.access === "none" && a.subscription) return false;
    return true;
  });
}
export function sortAccounts(accounts, key, direction) {
  const value = (a) =>
    key === "name"
      ? accountName(a)
      : key === "status"
        ? (STATUS_LABELS[a.status] ?? a.status)
        : key === "sessions7d"
          ? (a.sessions7d ?? 0)
          : a[key]
            ? Date.parse(a[key])
            : null;
  return [...accounts].sort((a, b) => {
    const av = value(a),
      bv = value(b);
    if (av == null && bv != null) return 1;
    if (bv == null && av != null) return -1;
    const order =
      typeof av === "string"
        ? av.localeCompare(bv, "ru")
        : (av ?? 0) - (bv ?? 0);
    return (
      (direction === "asc" ? order : -order) ||
      String(a.id).localeCompare(String(b.id))
    );
  });
}
export function csvCell(value) {
  let s = String(value ?? "");
  // Prevent spreadsheet formulas from executing when administrators open exports.
  if (/^[\s]*[=+@-]/.test(s) || /^[\t\r\n]/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
}
export function accountsCsv(accounts) {
  const rows = [
    [
      "ID",
      "Имя",
      "Email",
      "Статус",
      "Подписка",
      "Доступ до",
      "Регистрация",
      "Последний визит",
      "Занятия за 7 дней",
      "Занятия всего",
    ],
    ...accounts.map((a) => [
      a.id,
      accountName(a),
      a.email,
      STATUS_LABELS[a.status] ?? a.status,
      a.subscription
        ? (PLAN_LABELS[a.subscription.plan] ?? a.subscription.plan)
        : "",
      a.subscription?.currentPeriodEnd ?? "",
      a.createdAt,
      a.lastSeenAt,
      a.sessions7d ?? 0,
      a.sessionsTotal ?? 0,
    ]),
  ];
  return "\uFEFF" + rows.map((row) => row.map(csvCell).join(";")).join("\r\n");
}
