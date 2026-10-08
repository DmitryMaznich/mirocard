import {
  accountName,
  isOnline,
  topicAccess,
  filterAccounts,
  sortAccounts,
  accountsCsv,
  STATUS_LABELS,
  PLAN_LABELS,
} from "./admin-model.js";
const $ = (id) => document.getElementById(id);
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const FLAGS = [
  ["planner", "Меню и магазин"],
  ["lesson_plan", "План занятий"],
  ["instructions", "Инструкции"],
  ["beta", "Beta-темы (старый флаг)"],
  ["experimental", "Экспериментальные темы (старый флаг)"],
];
const ROLES = {
  parent: "Родитель",
  specialist: "Специалист",
  teacher: "Педагог",
  admin: "Администратор",
};
if (matchMedia("(max-width: 700px)").matches) $("page-size").value = "10";
let token = sessionStorage.getItem("mrc_admin_token") || "";
let accounts = [],
  catalog = [],
  loaded = false,
  catalogLoaded = false,
  page = 1,
  sortKey = "lastSeenAt",
  sortDir = "desc";
let refreshTimer,
  toastTimer,
  loading = false,
  generation = 0,
  selectedId = null,
  mutating = false,
  promoLoading = false;
const sessionsCache = new Map();
function date(value, withTime = false) {
  if (!value || !Number.isFinite(Date.parse(value))) return "—";
  return new Date(value).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}
function badge(a) {
  return `<span class="badge ${a.status === "active" ? "green" : a.status === "pending" ? "amber" : "red"}">${esc(STATUS_LABELS[a.status] ?? a.status)}</span>`;
}
function plan(a) {
  return a.subscription
    ? (PLAN_LABELS[a.subscription.plan] ?? a.subscription.plan)
    : "Нет активного доступа";
}
function topicLabel(id) {
  const title = catalog.find((t) => t.id === id)?.title;
  return typeof title === "string" ? title : (title?.ru ?? id);
}
function initials(a) {
  return accountName(a)
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => Array.from(s)[0])
    .join("")
    .toLocaleUpperCase("ru");
}
function error(message, auth = false) {
  const el = auth
    ? $("auth-error")
    : $("account-dialog").open
      ? $("detail-error")
      : $("error-banner");
  if (el) {
    el.textContent = message;
    el.hidden = !message;
  }
}
function toast(message) {
  clearTimeout(toastTimer);
  $("toast").textContent = message;
  $("toast").hidden = false;
  toastTimer = setTimeout(() => {
    $("toast").hidden = true;
  }, 4500);
}
async function api(path, options = {}) {
  const epoch = generation;
  let res;
  try {
    res = await fetch("/api/admin" + path, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });
  } catch {
    throw new Error(
      "Нет связи с сервером. Проверьте соединение и повторите попытку.",
    );
  }
  if (epoch !== generation) throw new Error("Сеанс завершён.");
  if (res.status === 401 || res.status === 403) {
    logout();
    throw new Error(
      "Токен не принят. Войдите с действующим токеном администратора.",
    );
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new Error(
      body.error || `Не удалось выполнить запрос (${res.status}).`,
    );
  return body;
}
function logout() {
  generation++;
  clearInterval(refreshTimer);
  sessionStorage.removeItem("mrc_admin_token");
  token = "";
  accounts = [];
  catalog = [];
  loaded = false;
  catalogLoaded = false;
  sessionsCache.clear();
  selectedId = null;
  $("account-dialog").close();
  $("confirm-dialog").close();
  $("deletion-dialog").close();
  $("panel").hidden = true;
  $("auth-screen").hidden = false;
  $("token-input").value = "";
  $("accounts-body").replaceChildren();
  $("promo-body").replaceChildren();
  $("toast").hidden = true;
  $("account-content").replaceChildren();
  $("stats").replaceChildren();
  $("promo-form").reset();
  promoKind();
  $("token-input").focus();
}
async function enter() {
  $("auth-screen").hidden = true;
  $("panel").hidden = false;
  clearInterval(refreshTimer);
  await loadData();
  if (!token) return;
  refreshTimer = setInterval(() => {
    if (!document.hidden && !$("account-dialog").open && !mutating && token)
      loadData(true);
  }, 30000);
}
$("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("login-button").disabled = true;
  error("", true);
  token = $("token-input").value.trim();
  try {
    const data = await api("/accounts");
    accounts = data;
    sessionStorage.setItem("mrc_admin_token", token);
    $("token-input").value = "";
    await enter();
  } catch (e) {
    error(e.message, true);
  } finally {
    $("login-button").disabled = false;
  }
});
$("logout").addEventListener("click", logout);
async function loadData(silent = false) {
  if (loading || mutating) return;
  loading = true;
  $("refresh").disabled = true;
  const epoch = generation;
  if (!silent) {
    error("");
    $("refresh").textContent = "Загрузка…";
  }
  try {
    const data = await api("/accounts");
    if (epoch !== generation) return;
    accounts = data;
    loaded = true;
    if (!catalogLoaded || !silent) {
      try {
        catalog = (await api("/catalog")).decks ?? [];
        catalogLoaded = true;
      } catch (e) {
        if (epoch !== generation) return;
        error("Каталог тем недоступен. " + e.message);
      }
    }
    $("updated-at").textContent =
      "Обновлено в " +
      new Date().toLocaleTimeString("ru-RU", {
        hour: "2-digit",
        minute: "2-digit",
      });
    renderAccounts();
    if (!silent) sessionsCache.clear();
  } catch (e) {
    if (epoch === generation && token) {
      error(e.message);
      if (!loaded) {
        $("list-state").textContent =
          "Не удалось загрузить пользователей. Нажмите «Обновить», чтобы повторить.";
      }
    } else if (!token) error(e.message, true);
  } finally {
    loading = false;
    $("refresh").disabled = false;
    $("refresh").textContent = "↻ Обновить";
  }
}
function filters() {
  return {
    query: $("search").value,
    status: $("status-filter").value,
    activity: $("activity-filter").value,
    access: $("access-filter").value,
  };
}
function visibleAccounts() {
  return sortAccounts(filterAccounts(accounts, filters()), sortKey, sortDir);
}
function renderAccounts() {
  const active = accounts.filter((a) =>
    ["active", "pending"].includes(a.status),
  );
  const week = active.filter(
    (a) =>
      a.lastSeenAt && Date.parse(a.lastSeenAt) >= Date.now() - 7 * 86400000,
  ).length;
  const stats = [
    [
      "Всего пользователей",
      accounts.length,
      "Все зарегистрированные аккаунты",
      "◎",
    ],
    [
      "Сейчас онлайн",
      active.filter(isOnline).length,
      "Пользователи за последние 2 минуты",
      "◉",
    ],
    ["Активны за 7 дней", week, "Посетили приложение за неделю", "↗"],
    [
      "Ждут подтверждения",
      accounts.filter((a) => a.status === "pending").length,
      "Email ещё не подтверждён",
      "◷",
    ],
  ];
  $("stats").innerHTML = stats
    .map(
      ([label, value, hint, icon]) =>
        `<div class="stat"><div class="stat-label">${label}<span class="stat-icon" aria-hidden="true">${icon}</span></div><div class="stat-value">${value.toLocaleString("ru")}</div><small>${hint}</small></div>`,
    )
    .join("");
  $("nav-count").textContent = accounts.length;
  $("total-count").textContent = accounts.length;
  const removedCount = accounts.filter((a) =>
    ["archived", "deleted", "deletion_pending", "purged"].includes(a.status),
  ).length;
  $("removed-count").textContent = removedCount;
  $("current-count").textContent = accounts.length - removedCount;
  document
    .querySelectorAll("[data-scope]")
    .forEach((b) =>
      b.setAttribute(
        "aria-pressed",
        String(
          b.dataset.scope ===
            ($("status-filter").value === "removed" ? "removed" : "current"),
        ),
      ),
    );
  const filtered = visibleAccounts(),
    size = Number($("page-size").value),
    pages = Math.max(1, Math.ceil(filtered.length / size));
  page = Math.min(page, pages);
  const start = (page - 1) * size;
  $("accounts-body").innerHTML = filtered
    .slice(start, start + size)
    .map(
      (a) => `<tr>
    <td><div class="identity"><div class="avatar" aria-hidden="true">${esc(initials(a))}</div><div><button class="name-button" data-account="${esc(a.id)}">${esc(accountName(a))}</button><span class="caption">${a.status === "purged" ? "Личные данные очищены" : esc(a.email)}</span></div></div></td>
    <td data-label="Статус">${badge(a)}</td><td data-label="Подписка"><span class="${a.subscription ? "badge purple" : "caption"}">${esc(plan(a))}</span>${a.subscription && a.subscription.plan !== "all_access" ? `<span class="cell-sub">до ${date(a.subscription.currentPeriodEnd)}</span>` : ""}</td>
    <td data-label="Последний визит">${isOnline(a) ? '<span class="online-indicator"></span><span>Онлайн</span>' : a.lastSeenAt ? date(a.lastSeenAt) : '<span class="caption">Ещё не заходил</span>'}${a.lastSeenAt ? `<span class="cell-sub">${date(a.lastSeenAt, true)}</span>` : ""}</td>
    <td class="numeric" data-label="Занятия / 7 дней"><strong>${a.sessions7d ?? 0}</strong><span class="cell-sub">${a.sessionsTotal ?? 0} всего</span></td><td class="numeric" data-label="Регистрация">${date(a.createdAt)}</td>
    <td><button class="btn small" data-account="${esc(a.id)}" aria-label="Открыть пользователя ${esc(accountName(a))}">Открыть →</button></td></tr>`,
    )
    .join("");
  $("list-state").hidden = filtered.length > 0;
  $("list-state").textContent = accounts.length
    ? "По этим условиям пользователи не найдены. Измените поиск или фильтры."
    : "Пользователей пока нет.";
  $("results-count").textContent = filtered.length
    ? `${start + 1}–${Math.min(start + size, filtered.length)} из ${filtered.length} пользователей`
    : "0 пользователей";
  $("page-label").textContent = `${page} / ${pages}`;
  $("prev-page").disabled = page <= 1;
  $("next-page").disabled = page >= pages;
  $("export").disabled = !filtered.length;
  document.querySelectorAll("[data-sort]").forEach((button) => {
    const selected = button.dataset.sort === sortKey;
    button.parentElement.setAttribute(
      "aria-sort",
      selected ? (sortDir === "asc" ? "ascending" : "descending") : "none",
    );
    button.querySelector("span").textContent = selected
      ? sortDir === "asc"
        ? "↑"
        : "↓"
      : "";
  });
}
$("refresh").addEventListener("click", () => {
  loadData();
  if (!$("promos-view").hidden) loadPromos();
});
for (const id of [
  "search",
  "status-filter",
  "activity-filter",
  "access-filter",
  "page-size",
])
  $(id).addEventListener(id === "search" ? "input" : "change", () => {
    page = 1;
    if (loaded) renderAccounts();
  });
$("prev-page").addEventListener("click", () => {
  page--;
  renderAccounts();
});
$("next-page").addEventListener("click", () => {
  page++;
  renderAccounts();
});
document.querySelectorAll("[data-sort]").forEach((button) =>
  button.addEventListener("click", () => {
    sortDir =
      button.dataset.sort === sortKey && sortDir === "asc" ? "desc" : "asc";
    sortKey = button.dataset.sort;
    page = 1;
    renderAccounts();
  }),
);
$("accounts-body").addEventListener("click", (e) => {
  const button = e.target.closest("[data-account]");
  if (button) openAccount(button.dataset.account);
});
$("export").addEventListener("click", () => {
  const url = URL.createObjectURL(
    new Blob([accountsCsv(visibleAccounts())], {
      type: "text/csv;charset=utf-8",
    }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `mironium-users-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast("Экспортирован текущий список с учётом поиска и фильтров.");
});
document.querySelectorAll("[data-view]").forEach((button) =>
  button.addEventListener("click", () => {
    const promos = button.dataset.view === "promos";
    $("users-view").hidden = promos;
    $("promos-view").hidden = !promos;
    $("breadcrumb").textContent = promos ? "Промокоды" : "Пользователи";
    document.querySelectorAll("[data-view]").forEach((b) => {
      const current = b === button;
      b.classList.toggle("selected", current);
      if (current) b.setAttribute("aria-current", "page");
      else b.removeAttribute("aria-current");
    });
    if (promos) loadPromos();
  }),
);
function openAccount(id) {
  const a = accounts.find((a) => a.id === id);
  if (!a) return;
  selectedId = id;
  renderDetail(a);
  if (!$("account-dialog").open) $("account-dialog").showModal();
}
function renderDetail(a) {
  const deleted = !["active", "pending"].includes(a.status),
    assigned = topicAccess(a);
  const available = catalog.filter(
    (t) =>
      ["beta", "individual"].includes(t.publication) &&
      !assigned.some((x) => x.topicId === t.id),
  );
  $("account-content").innerHTML =
    `<header class="detail-header"><div class="identity"><div class="avatar" aria-hidden="true">${esc(initials(a))}</div><div><p class="eyebrow">КАРТОЧКА ПОЛЬЗОВАТЕЛЯ</p><h2 id="account-title">${esc(accountName(a))}</h2><p class="detail-email">${a.status === "purged" ? "Личные данные очищены" : esc(a.email)}</p></div></div><button class="btn small" data-action="close" aria-label="Закрыть карточку">✕</button></header>
    <div class="detail-body"><p id="detail-error" class="error" role="alert" hidden></p>
    <dl class="detail-meta"><div><dt>Статус аккаунта</dt><dd>${badge(a)}</dd></div><div><dt>Роль</dt><dd>${esc(ROLES[a.role] ?? a.role ?? "Не указана")}</dd></div><div><dt>Дата регистрации</dt><dd>${date(a.createdAt, true)}</dd></div><div><dt>ID пользователя</dt><dd>${esc(a.id)}</dd></div><div><dt>Последний визит</dt><dd>${date(a.lastSeenAt, true)}</dd></div><div><dt>Рассылки</dt><dd>${a.marketingOptIn ? "Согласие получено" : "Нет согласия"}</dd></div></dl>
    ${deleted ? '<p class="access-note">Доступ к аккаунту закрыт. Изменение функций и назначений недоступно.</p>' : a.status === "pending" ? '<div class="detail-section access-note">Email не подтверждён. Подтвердите его вручную, если личность пользователя проверена.<br><button class="btn small" data-action="verify">Подтвердить email</button></div>' : ""}
    <section class="detail-section"><div class="section-title"><h3>Активность</h3><button class="btn small" data-action="sessions">История занятий</button></div><div class="detail-stats"><div class="detail-stat"><strong>${a.openCount ?? 0}</strong><small>открытий приложения</small></div><div class="detail-stat"><strong>${a.sessions7d ?? 0}</strong><small>занятий за 7 дней</small></div><div class="detail-stat"><strong>${a.sessionsTotal ?? 0}</strong><small>занятий всего</small></div></div>
    ${(a.activeSessions ?? []).length ? `<p class="empty-note"><span class="online-indicator"></span>Сейчас онлайн: ${a.activeSessions.map((s) => esc(s.device || "Устройство не указано") + (s.topicId ? " · " + esc(topicLabel(s.topicId)) : "")).join("; ")}</p>` : ""}<div id="sessions-container" hidden></div></section>
    <section class="detail-section"><div class="section-title"><h3>Подписка и доступ</h3></div><div class="access-note"><strong>${esc(plan(a))}</strong>${a.subscription && a.subscription.plan !== "all_access" ? ` · до ${date(a.subscription.currentPeriodEnd, true)}${a.subscription.cancelAtPeriodEnd ? " · отмена в конце периода" : ""}` : ""}<br>Подписка открывает опубликованные платные темы. Отдельные назначения ниже дают доступ к beta- и индивидуальным темам.</div>
    <div class="topic-list">${assigned.length ? assigned.map((t) => `<div class="topic-item"><div>${esc(topicLabel(t.topicId))}<small>${t.assignment ? "Назначение администратора" : t.source === "paid" ? "Покупка" : t.source === "free" ? "Бесплатная тема" : "Выданный доступ"} · ${date(t.assignedAt ?? t.acquiredAt)}</small></div>${!deleted && (t.assignment || ["grant", "assigned"].includes(t.source)) ? `<button class="btn small" data-action="revoke" data-topic="${esc(t.topicId)}">Отозвать</button>` : ""}</div>`).join("") : '<p class="empty-note">Отдельных назначений нет.</p>'}</div>
    ${!deleted ? `<div class="grant-form"><select id="grant-topic" aria-label="Тема для назначения" ${!catalogLoaded || !available.length ? "disabled" : ""}><option value="">${catalogLoaded ? (available.length ? "Выберите beta- или индивидуальную тему" : "Нет тем для назначения") : "Каталог недоступен — обновите данные"}</option>${available.map((t) => `<option value="${esc(t.id)}">${esc(topicLabel(t.id))} · ${t.publication === "beta" ? "Beta" : "Индивидуальная"}</option>`).join("")}</select><button class="btn primary small" data-action="grant" disabled>Назначить тему</button></div>` : ""}</section>
    <section class="detail-section"><div class="section-title"><h3>Дополнительные функции</h3></div><p class="empty-note">Изменения применяются после сохранения. Доступ к beta-темам выдаётся отдельным назначением выше.</p><div class="flag-list">${FLAGS.map(([key, label]) => `<label class="flag-item"><input type="checkbox" data-flag="${key}" ${(a.featureFlags ?? []).includes(key) ? "checked" : ""} ${deleted ? "disabled" : ""}>${label}</label>`).join("")}</div>${!deleted ? '<div class="flags-actions"><button class="btn primary small" data-action="flags" disabled>Сохранить функции</button><span id="flags-hint" class="caption">Нет несохранённых изменений</span></div>' : ""}</section>${lifecycleSection(a)}</div>`;
}
$("account-dialog").addEventListener("close", () => {
  selectedId = null;
});
$("account-dialog").addEventListener("cancel", (e) => {
  e.preventDefault();
  if (!mutating)
    $("account-content").querySelector('[data-action="close"]')?.click();
});
$("account-content").addEventListener("change", (e) => {
  if (e.target.id === "grant-topic")
    $("account-content").querySelector('[data-action="grant"]').disabled =
      !e.target.value;
  if (e.target.matches("[data-flag]")) {
    const a = accounts.find((a) => a.id === selectedId);
    const changed = [...document.querySelectorAll("[data-flag]")].some(
      (input) =>
        input.checked !== (a.featureFlags ?? []).includes(input.dataset.flag),
    );
    $("account-content").querySelector('[data-action="flags"]').disabled =
      !changed;
    $("flags-hint").textContent = changed
      ? "Есть несохранённые изменения"
      : "Нет несохранённых изменений";
  }
});
function confirmAction(title, message, label) {
  $("confirm-title").textContent = title;
  $("confirm-text").textContent = message;
  $("confirm-submit").textContent = label;
  $("confirm-dialog").returnValue = "";
  return new Promise((resolve) => {
    $("confirm-dialog").addEventListener(
      "close",
      () => resolve($("confirm-dialog").returnValue === "confirm"),
      { once: true },
    );
    $("confirm-dialog").showModal();
  });
}
async function mutate(path, body, message, id) {
  if (mutating) return;
  mutating = true;
  const epoch = generation;
  error("");
  const priorControls = [
    ...$("account-content").querySelectorAll("button,input,select,textarea"),
  ].map((el) => [el, el.disabled]);
  for (const [el] of priorControls) el.disabled = true;
  try {
    await api(path, { method: "POST", body: JSON.stringify(body) });
    toast(message);
    try {
      accounts = await api("/accounts");
      renderAccounts();
    } catch {
      if (epoch === generation)
        error(
          "Изменение сохранено, но обновить список не удалось. Обновите данные перед следующей операцией.",
        );
      return;
    }
    if (selectedId === id) renderDetail(accounts.find((a) => a.id === id));
  } catch (e) {
    if (epoch === generation) error(e.message);
    else error(e.message, true);
  } finally {
    mutating = false;
    if (epoch === generation && selectedId === id) {
      for (const [el, wasDisabled] of priorControls)
        if (el.isConnected) el.disabled = wasDisabled;
    }
  }
}
$("account-content").addEventListener("click", async (e) => {
  const button = e.target.closest("[data-action]");
  if (!button || mutating) return;
  const a = accounts.find((a) => a.id === selectedId);
  if (!a) return;
  const action = button.dataset.action;
  if (action === "close") {
    if (
      [...document.querySelectorAll("[data-flag]")].some(
        (input) =>
          input.checked !== (a.featureFlags ?? []).includes(input.dataset.flag),
      ) &&
      !(await confirmAction(
        "Закрыть без сохранения?",
        "Изменения дополнительных функций будут отменены.",
        "Закрыть",
      ))
    )
      return;
    $("account-dialog").close();
  }
  if (["block", "unblock", "restore"].includes(action)) {
    const why = $("lifecycle-reason").value.trim();
    if (why.length < 3) {
      error("Укажите причину: минимум 3 символа.");
      $("lifecycle-reason").focus();
      return;
    }
    const titles = {
      block: "Заблокировать аккаунт?",
      unblock: "Разблокировать аккаунт?",
      restore: "Восстановить аккаунт?",
    };
    if (
      await confirmAction(
        titles[action],
        `${a.email}. Старые сеансы входа не будут восстановлены. Срок подписки не изменится.`,
        "Подтвердить",
      )
    ) {
      mutate(
        `/accounts/${encodeURIComponent(a.id)}/lifecycle`,
        { action, reason: why },
        "Статус аккаунта обновлён.",
        a.id,
      );
    }
  }
  if (action === "archive") beginDeletion(a, "archive");
  if (action === "sessions") loadSessions(a.id);
  if (
    action === "verify" &&
    (await confirmAction(
      "Подтвердить email?",
      `Аккаунт ${a.email} сможет войти без подтверждения по ссылке в письме.`,
      "Подтвердить email",
    ))
  )
    mutate("/verify-account", { email: a.email }, "Email подтверждён.", a.id);
  if (action === "grant") {
    const topicId = $("grant-topic").value;
    if (topicId)
      mutate(
        "/grant",
        { email: a.email, topicId },
        "Тема назначена пользователю.",
        a.id,
      );
  }
  if (
    action === "revoke" &&
    (await confirmAction(
      "Отозвать доступ к теме?",
      `У ${a.email} будет отозвано отдельное назначение «${topicLabel(button.dataset.topic)}». Подписка пользователя продолжит действовать.`,
      "Отозвать доступ",
    ))
  )
    mutate(
      "/revoke",
      { email: a.email, topicId: button.dataset.topic },
      "Отдельный доступ отозван.",
      a.id,
    );
  if (action === "flags") {
    const known = new Set(FLAGS.map(([key]) => key));
    const next = [
      ...(a.featureFlags ?? []).filter((f) => !known.has(f)),
      ...[...document.querySelectorAll("[data-flag]:checked")].map(
        (input) => input.dataset.flag,
      ),
    ];
    mutate(
      "/account/flags",
      { email: a.email, flags: next },
      "Настройки функций сохранены.",
      a.id,
    );
  }
});
async function loadSessions(id) {
  const el = $("sessions-container");
  if (!el.hidden) {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  el.innerHTML = '<p class="empty-note">Загрузка истории…</p>';
  try {
    const rows =
      sessionsCache.get(id) ??
      (await api(`/accounts/${encodeURIComponent(id)}/sessions`));
    sessionsCache.set(id, rows);
    if (selectedId !== id || !el.isConnected) return;
    el.innerHTML = rows.length
      ? `<p class="empty-note">Последние ${rows.length} занятий (до 30 записей).</p><div class="session-table"><table><thead><tr><th>Тема / режим</th><th>Завершено</th><th>Результат</th></tr></thead><tbody>${rows.map((s) => `<tr><td>${esc(topicLabel(s.topicId))}<span class="cell-sub">${esc(s.mode ?? "—")}</span></td><td>${date(s.completedAt, true)}</td><td>${s.percentCorrect == null ? "—" : esc(s.percentCorrect) + "%"}</td></tr>`).join("")}</tbody></table></div>`
      : '<p class="empty-note">Занятий пока нет.</p>';
  } catch (e) {
    if (selectedId === id && el.isConnected) {
      el.innerHTML = `<p class="error">${esc(e.message)}</p>`;
    }
  }
}
async function loadPromos() {
  if (promoLoading) return;
  promoLoading = true;
  try {
    const codes = await api("/promo-codes");
    $("promo-body").innerHTML = codes
      .map((c) => {
        const expired = c.expiresAt && Date.parse(c.expiresAt) <= Date.now(),
          exhausted =
            c.maxRedemptions != null && c.redeemedCount >= c.maxRedemptions;
        const conditions =
          c.kind === "free_grant"
            ? `Бесплатно · ${c.grantDurationDays ?? "—"} дней`
            : c.kind === "percent_off"
              ? `${c.value}%`
              : `${(c.value / 100).toFixed(2)} ${c.currency ?? ""}`;
        return `<tr><td><strong>${esc(c.code)}</strong><span class="cell-sub">${esc(PLAN_LABELS[c.appliesToPlan] ?? c.appliesToPlan ?? "Любой план")}</span></td><td>${esc(conditions)}</td><td>${c.redeemedCount ?? 0} / ${c.maxRedemptions ?? "∞"}</td><td>${c.expiresAt ? date(c.expiresAt, true) : "Без срока"}</td><td><span class="badge ${expired || exhausted ? "amber" : "green"}">${expired ? "Истёк" : exhausted ? "Лимит исчерпан" : "Действует"}</span></td><td>${esc(c.note || "—")}</td></tr>`;
      })
      .join("");
    $("promo-state").hidden = codes.length > 0;
    $("promo-state").textContent = "Промокодов пока нет.";
  } catch (e) {
    if (token) error(e.message);
    else error(e.message, true);
    $("promo-state").hidden = false;
    $("promo-state").textContent =
      "Не удалось загрузить промокоды. Нажмите «Обновить».";
  } finally {
    promoLoading = false;
  }
}
function promoKind() {
  const form = $("promo-form"),
    kind = form.elements.kind.value,
    free = kind === "free_grant",
    fixed = kind === "fixed_off";
  $("promo-value-label").hidden = free;
  $("promo-currency-label").hidden = !fixed;
  $("promo-days-label").hidden = !free;
  $("promo-value-label").firstChild.textContent = fixed
    ? "Скидка, в валюте"
    : "Скидка, %";
  form.elements.value.required = !free;
  form.elements.value.disabled = free;
  form.elements.value.min = fixed ? ".01" : "1";
  form.elements.value.step = fixed ? ".01" : "1";
  form.elements.value.max = fixed ? "" : "100";
  form.elements.grantDurationDays.required = free;
  form.elements.grantDurationDays.disabled = !free;
}
$("promo-form").elements.kind.addEventListener("change", promoKind);
$("promo-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  if (!form.reportValidity()) return;
  const kind = form.elements.kind.value,
    value = form.elements.value.value;
  const epoch = generation;
  const body = {
    code: form.elements.code.value.trim().toUpperCase(),
    kind,
    value:
      kind === "free_grant"
        ? null
        : kind === "fixed_off"
          ? Math.round(Number(value) * 100)
          : Number(value),
    currency: kind === "fixed_off" ? form.elements.currency.value : null,
    grantDurationDays:
      kind === "free_grant"
        ? Number(form.elements.grantDurationDays.value)
        : null,
    appliesToPlan: form.elements.appliesToPlan.value || null,
    maxRedemptions: form.elements.maxRedemptions.value
      ? Number(form.elements.maxRedemptions.value)
      : null,
    expiresAt: form.elements.expiresAt.value
      ? new Date(form.elements.expiresAt.value + "T23:59:59").toISOString()
      : null,
    note: form.elements.note.value.trim() || null,
  };
  $("create-promo").disabled = true;
  error("");
  try {
    await api("/promo-codes", { method: "POST", body: JSON.stringify(body) });
    if (epoch !== generation) return;
    form.reset();
    promoKind();
    toast("Промокод создан.");
    await loadPromos();
  } catch (e) {
    error(e.message, !token);
  } finally {
    $("create-promo").disabled = false;
  }
});
promoKind();
if (token) enter();
function lifecycleSection(a) {
  const labels = {
    block: "Блокировка",
    unblock: "Разблокировка",
    archive: "Перенос в удалённые",
    restore: "Восстановление",
    purge: "Личные данные удалены",
    "schedule-deletion": "Прежнее удаление запланировано",
    "cancel-deletion": "Удаление отменено",
  };
  const removed = ["archived", "deleted", "deletion_pending"].includes(
    a.status,
  );
  return `<section class="detail-section danger-zone"><div class="section-title"><h3>Управление аккаунтом</h3></div>
    ${
      a.status === "purged"
        ? '<p class="empty-note">Данные были очищены по прежним правилам. Восстановление через панель невозможно.</p>'
        : `${removed ? '<p class="access-note">Аккаунт в разделе «Удалённые». Данные сохранены, автоматической очистки нет. Можно восстановить доступ.</p>' : '<p class="empty-note">Блокировка и перенос в удалённые закрывают вход на всех устройствах. Данные сохраняются, срок подписки продолжает идти.</p>'}
      <label>Причина блокировки или восстановления<textarea id="lifecycle-reason" rows="2" minlength="3" maxlength="500" placeholder="Кратко опишите причину"></textarea></label>
      <div class="lifecycle-actions">${removed ? '<button class="btn primary" data-action="restore">Восстановить аккаунт</button>' : `${a.status === "blocked" ? '<button class="btn" data-action="unblock">Разблокировать</button>' : '<button class="btn" data-action="block">Заблокировать аккаунт</button>'}<button class="btn danger" data-action="archive">Перенести в удалённые…</button>`}</div>`
    }
    ${(a.adminEvents ?? []).length ? `<h3 class="audit-heading">Последние действия администратора</h3><ul class="audit-list">${a.adminEvents.map((e) => `<li><strong>${esc(labels[e.action] ?? e.action)}</strong><small>${date(e.createdAt, true)} · ${e.actor === "admin_token" ? "администратор" : "автоматически"}</small><p>${esc(e.reason)}</p></li>`).join("")}</ul>` : ""}</section>`;
}
let deletionPreview = null;
async function beginDeletion(a, mode) {
  if (mutating) return;
  try {
    const preview = await api(
      `/accounts/${encodeURIComponent(a.id)}/deletion-preview`,
      { method: "POST", body: JSON.stringify({ mode }) },
    );
    if (selectedId !== a.id) return;
    deletionPreview = preview;
    $("deletion-form").reset();
    $("deletion-fields")
      .querySelectorAll("input,textarea")
      .forEach((el) => {
        el.disabled = true;
      });
    $("deletion-fields").hidden = true;
    $("deletion-submit").hidden = true;
    $("deletion-submit").disabled = true;
    $("deletion-next").hidden = false;
    $("deletion-title").textContent = "Перенести в удалённые";
    $("deletion-summary").innerHTML =
      `<p class="deletion-identity"><strong>${esc(accountName(a))}</strong><br>${esc(preview.email)}</p><div class="deletion-counts"><span><strong>${preview.students}</strong> учеников</span><span><strong>${preview.sessions}</strong> занятий</span><span><strong>${preview.audio}</strong> аудиозаписей</span><span><strong>${preview.materials}</strong> записей материалов</span></div><p class="empty-note">Платёжных заказов: ${preview.orders}, из них оплачено: ${preview.paidOrders}. ${preview.activeAccess || preview.hasUnlimitedAccess ? "Есть действующий доступ." : "Действующий доступ не обнаружен."}</p><p class="empty-note">Все данные сохранятся. Восстановление доступно в разделе «Удалённые».</p>`;
    $("deletion-dialog").showModal();
  } catch (e) {
    error(e.message, !token);
  }
}
$("deletion-cancel").addEventListener("click", () =>
  $("deletion-dialog").close(),
);
$("deletion-dialog").addEventListener("close", () => {
  deletionPreview = null;
  $("deletion-form").reset();
  $("deletion-summary").replaceChildren();
});
$("deletion-next").addEventListener("click", () => {
  $("deletion-fields")
    .querySelectorAll("input,textarea")
    .forEach((el) => {
      el.disabled = false;
    });
  $("deletion-fields").hidden = false;
  $("deletion-submit").hidden = false;
  $("deletion-next").hidden = true;
  $("deletion-reason").focus();
});
$("deletion-form").addEventListener("input", () => {
  $("deletion-submit").disabled =
    !deletionPreview ||
    $("deletion-reason").value.trim().length < 3 ||
    $("deletion-email").value.trim() !== deletionPreview.email ||
    $("deletion-word").value.trim() !== "УДАЛИТЬ" ||
    !$("deletion-ack-data").checked ||
    !$("deletion-ack-retention").checked;
});
$("deletion-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!deletionPreview || $("deletion-submit").disabled || mutating) return;
  const preview = deletionPreview,
    epoch = generation;
  const body = {
    mode: preview.mode,
    confirmationToken: preview.confirmationToken,
    confirmEmail: $("deletion-email").value.trim(),
    confirmWord: $("deletion-word").value.trim(),
    reason: $("deletion-reason").value.trim(),
    acknowledgeData: $("deletion-ack-data").checked,
    acknowledgeRetention: $("deletion-ack-retention").checked,
  };
  if (
    !(await confirmAction(
      "Последнее подтверждение",
      `${preview.email}: доступ будет закрыт, аккаунт переместится в «Удалённые». Данные сохранятся.`,
      "Да, перенести в удалённые",
    ))
  )
    return;
  if (epoch !== generation || selectedId !== preview.accountId) return;
  $("deletion-dialog").close();
  sessionsCache.delete(preview.accountId);
  mutate(
    `/accounts/${encodeURIComponent(preview.accountId)}/delete`,
    body,
    "Аккаунт перенесён в удалённые. Данные сохранены.",
    preview.accountId,
  );
});

$("mobile-sort").addEventListener("change", (e) => {
  [sortKey, sortDir] = e.target.value.split(":");
  page = 1;
  renderAccounts();
});

document.querySelectorAll("[data-scope]").forEach((b) =>
  b.addEventListener("click", () => {
    $("status-filter").value = b.dataset.scope;
    page = 1;
    renderAccounts();
  }),
);
