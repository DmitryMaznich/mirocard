const $ = (id) => document.getElementById(id);
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const title = (t) =>
  typeof t.title === "string" ? t.title : (t.title?.ru ?? t.title?.en ?? t.id);
const labels = {
  release: "Опубликована",
  beta: "Beta",
  individual: "Индивидуальная",
  hidden: "Скрыта",
  draft: "Вне каталога",
  removed: "Удалена из каталога",
  builtin: "Встроенная",
};
const historySettings = (value) => {
  try {
    const s = JSON.parse(value);
    return `${s.listed ? labels[s.status] : "Нет в каталоге"} · ${s.access === "paid" ? "Платная" : "Бесплатная"}`;
  } catch {
    return "Настройки изменены";
  }
};
const date = (v) =>
  v
    ? new Date(v).toLocaleString("ru-RU", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : "Нет данных";
export function createAdminTopics({ api, confirmAction, onChanged }) {
  let rows = [],
    selected = null,
    epoch = 0,
    loading = false,
    saving = false;
  function filtered() {
    const q = $("topics-search").value.trim().toLowerCase(),
      status = $("topics-filter").value;
    return rows
      .filter(
        (t) =>
          (!q || `${title(t)} ${t.id}`.toLowerCase().includes(q)) &&
          (status === "all" || t.publication === status),
      )
      .sort((a, b) =>
        $("topics-sort").value === "updated"
          ? String(b.adminUpdatedAt ?? b.sourceUpdatedAt ?? "").localeCompare(
              a.adminUpdatedAt ?? a.sourceUpdatedAt ?? "",
            )
          : $("topics-sort").value === "status"
            ? a.publication.localeCompare(b.publication) ||
              title(a).localeCompare(title(b), "ru")
            : title(a).localeCompare(title(b), "ru"),
      );
  }
  function render() {
    $("topics-stats").innerHTML = [
      ["Всего тем", rows.length],
      ["В каталоге", rows.filter((t) => t.inCatalog).length],
      ["Вне каталога", rows.filter((t) => t.publication === "draft").length],
      ["Встроенные", rows.filter((t) => t.builtin).length],
    ]
      .map(
        ([label, n]) =>
          `<div class="stat"><div class="stat-label">${label}</div><div class="stat-value">${n}</div></div>`,
      )
      .join("");
    const visible = filtered();
    $("topics-message").textContent = visible.length
      ? `Показано ${visible.length} из ${rows.length}. Настройки каталога применяются после сохранения.`
      : "Тем по этому фильтру нет.";
    $("topics-body").innerHTML = visible
      .map(
        (t) =>
          `<tr><td><button class="name-button" data-topic="${esc(t.id)}">${esc(title(t))}</button><span class="caption">${esc(t.id)}</span>${t.reason ? `<small class="caption">${esc(t.reason)}</small>` : ""}</td><td data-label="Версии"><strong>${esc(t.catalogVersion ?? "—")}</strong><small class="caption">Разработка: ${esc(t.sourceVersion ?? "—")}${t.catalogVersion && t.catalogVersion !== t.sourceVersion ? " · отличаются" : ""}</small></td><td data-label="Изменения">${date(t.adminUpdatedAt ?? t.sourceUpdatedAt)}<small class="caption">${t.adminUpdatedAt ? "Администратор" : "Исходники / пакет"}</small></td><td data-label="Статус"><span class="badge">${esc(labels[t.publication])}</span></td><td data-label="Флаги">${t.builtin ? "Встроенная" : t.access === "paid" ? "Платная" : "Бесплатная"}<small class="caption">${t.inCatalog ? (t.hidden ? "Скрыта в каталоге" : "В каталоге") : "Нет в каталоге"}</small></td><td data-label="Пакет">${t.bundleAvailable ? "ZIP готов" : t.builtin ? "В приложении" : "ZIP отсутствует"}</td><td><button class="btn small" data-topic="${esc(t.id)}">${t.canManage ? "Управление" : "Подробнее"}</button></td></tr>`,
      )
      .join("");
  }
  async function load() {
    if (loading) return;
    loading = true;
    const generation = epoch;
    $("topics-message").textContent = "Загрузка реестра…";
    try {
      const r = await api("/topics");
      if (epoch !== generation) return;
      rows = r.topics;
      render();
    } catch (e) {
      if (epoch === generation) $("topics-message").textContent = e.message;
    } finally {
      if (epoch === generation) loading = false;
    }
  }
  function show(id) {
    selected = rows.find((t) => t.id === id);
    if (!selected) return;
    const t = selected;
    $("topic-detail").innerHTML =
      `<header class="detail-header"><div><p class="eyebrow">УПРАВЛЕНИЕ ТЕМОЙ</p><h2>${esc(title(t))}</h2><p class="caption">${esc(t.id)}</p></div><button class="btn small" data-topic-action="close" aria-label="Закрыть тему">✕</button></header><div class="detail-body"><p id="topic-error" class="error" role="alert"></p><dl class="detail-meta"><div><dt>Версия в каталоге</dt><dd>${esc(t.catalogVersion ?? "Нет")}</dd></div><div><dt>Версия разработки</dt><dd>${esc(t.sourceVersion ?? "Нет")}</dd></div><div><dt>Изменения исходников</dt><dd>${date(t.sourceUpdatedAt)}</dd></div><div><dt>Ручные изменения</dt><dd>${date(t.adminUpdatedAt)}</dd></div></dl>${t.reason ? `<p class="access-note">${esc(t.reason)}</p>` : ""}${t.canManage ? `<form id="topic-form"><label>Статус публикации<select id="topic-status">${["release", "beta", "individual", "hidden"].map((s) => `<option value="${s}" ${t.settings.status === s ? "selected" : ""}>${labels[s]}</option>`).join("")}</select></label><label>Доступ<select id="topic-access"><option value="paid" ${t.access === "paid" ? "selected" : ""}>Платная</option><option value="free" ${t.access === "free" ? "selected" : ""}>Бесплатная</option></select></label><p class="empty-note">Опубликована — видна всем. Beta и индивидуальная — по назначению. Скрыта — обычным пользователям не показывается. Оплата и видимость задаются отдельно.</p><div class="lifecycle-actions"><button class="btn primary" type="submit">${t.inCatalog ? "Сохранить флаги" : "Добавить в каталог"}</button>${t.inCatalog ? '<button class="btn danger" type="button" data-topic-action="remove">Удалить из каталога</button>' : ""}</div></form>` : '<p class="empty-note">Флаги каталога здесь недоступны: требуется отдельный ZIP-пакет либо изменение встроенной темы в коде приложения.</p>'}<section class="detail-section"><h3>Источники</h3><ul class="topic-sources">${(t.sources ?? []).map((s) => `<li>${esc(s)}</li>`).join("") || "<li>Только запись каталога</li>"}</ul></section><section class="detail-section"><h3>Последние ручные изменения</h3><ul class="audit-list">${t.history.map((e) => `<li><strong>${e.action === "remove" ? "Удаление из каталога" : e.action === "restore" ? "Добавление в каталог" : "Изменение флагов"}</strong><small>${date(e.createdAt)}</small><p>${esc(historySettings(e.settings))}</p></li>`).join("") || "<li>Ручных изменений ещё нет.</li>"}</ul></section></div>`;
    if (!$("topic-dialog").open) $("topic-dialog").showModal();
    $("topic-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      await save(true);
    });
  }
  async function save(listed) {
    if (saving || !selected) return;
    const t = selected,
      generation = epoch;
    const status = $("topic-status").value,
      access = $("topic-access").value;
    if (
      !(await confirmAction(
        listed ? "Применить настройки темы?" : "Удалить тему из каталога?",
        listed
          ? `${title(t)}: ${labels[status]}, ${access === "paid" ? "платная" : "бесплатная"}. Эти настройки изменят выдачу каталога и условия новых установок.`
          : `${title(t)}. Тема исчезнет из каталога и новых установок. Исходники, установленные копии и история занятий не удаляются. Вернуть тему можно в этом реестре.`,
        listed ? "Применить" : "Удалить из каталога",
      ))
    )
      return;
    if (generation !== epoch || selected !== t) return;
    saving = true;
    const controls = [...$("topic-detail").querySelectorAll("button,select")];
    controls.forEach((e) => (e.disabled = true));
    $("topic-error").textContent = "";
    try {
      const r = await api(`/topics/${encodeURIComponent(t.id)}`, {
        method: "POST",
        body: JSON.stringify({
          listed,
          status,
          access,
          expectedRevision: t.overrideRevision,
        }),
      });
      if (generation !== epoch) return;
      rows = rows.map((x) => (x.id === t.id ? r.topic : x));
      render();
      show(t.id);
      await onChanged();
    } catch (e) {
      if (generation === epoch) $("topic-error").textContent = e.message;
    } finally {
      saving = false;
      controls.forEach((e) => (e.disabled = false));
    }
  }
  $("topics-body").addEventListener("click", (e) => {
    const b = e.target.closest("[data-topic]");
    if (b) show(b.dataset.topic);
  });
  $("topic-detail").addEventListener("click", (e) => {
    const action = e.target.closest("[data-topic-action]")?.dataset.topicAction;
    if (action === "close" && !saving) $("topic-dialog").close();
    if (action === "remove") save(false);
  });
  $("topic-dialog").addEventListener("cancel", (e) => {
    if (saving) e.preventDefault();
  });
  for (const id of ["topics-search", "topics-filter", "topics-sort"])
    $(id).addEventListener(id === "topics-search" ? "input" : "change", render);
  $("topics-export").addEventListener("click", () => {
    const cell = (v) =>
      '"' +
      (/^[=+@-]/.test(String(v)) ? "'" : "") +
      String(v ?? "").replaceAll('"', '""') +
      '"';
    const data = [
      [
        "Тема",
        "ID",
        "Версия каталога",
        "Версия разработки",
        "Статус",
        "Доступ",
        "Исходники изменены",
        "Ручные изменения",
      ],
      ...filtered().map((t) => [
        title(t),
        t.id,
        t.catalogVersion,
        t.sourceVersion,
        labels[t.publication],
        t.access,
        t.sourceUpdatedAt,
        t.adminUpdatedAt,
      ]),
    ]
      .map((r) => r.map(cell).join(";"))
      .join("\r\n");
    const url = URL.createObjectURL(
      new Blob(["\uFEFF", data], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "topics.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  return {
    load,
    clear() {
      epoch++;
      rows = [];
      selected = null;
      loading = false;
      $("topic-dialog").close();
      $("topic-detail").replaceChildren();
      $("topics-body").replaceChildren();
      $("topics-stats").replaceChildren();
      $("topics-message").textContent = "";
    },
  };
}
