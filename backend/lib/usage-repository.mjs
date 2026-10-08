const KINDS = new Set([
  "app_open",
  "screen_view",
  "topic_open",
  "time",
  "session_start",
  "session_exit",
  "sync_error",
]);
const text = (v, max = 100) => (typeof v === "string" ? v.slice(0, max) : null);
export function appendUsageEvent(db, accountId, data, now = Date.now()) {
  if (
    !data ||
    !KINDS.has(data.kind) ||
    typeof data.id !== "string" ||
    data.id.length > 150 ||
    !data.id.length
  )
    return;
  const at = Date.parse(data.occurredAt);
  if (
    !Number.isFinite(at) ||
    at > now + 300000 ||
    at < Date.parse("2026-01-01")
  )
    return;
  const ms = (v) =>
    Number.isFinite(v) ? Math.min(30000, Math.max(0, Math.round(v))) : 0;
  const foreground = ms(data.foregroundMs),
    active = Math.min(foreground, ms(data.activeMs));
  db.prepare(
    `INSERT OR IGNORE INTO usage_events (account_id,id,kind,occurred_at,received_at,topic_id,screen,session_id,mode,foreground_ms,active_ms,device,version,visit_id)
 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(
    accountId,
    data.id,
    data.kind,
    new Date(at).toISOString(),
    new Date(now).toISOString(),
    text(data.topicId),
    text(data.screen, 60),
    text(data.sessionId),
    text(data.mode),
    data.kind === "time" ? foreground : 0,
    data.kind === "time" ? active : 0,
    text(data.device, 60),
    text(data.version, 30),
    text(data.visitId),
  );
}
function todayStart(now) {
  const d = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Ljubljana",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(now));
  const guess = Date.parse(d + "T00:00:00Z");
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Ljubljana",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(new Date(guess)),
  );
  return guess - hour * 3600000;
}
export function getUsageReport(db, accountId, period = "30", now = Date.now()) {
  if (!["today", "7", "30", "all"].includes(period))
    throw { status: 400, message: "Неизвестный период" };
  const since = new Date(
    period === "all"
      ? 0
      : period === "today"
        ? todayStart(now)
        : now - Number(period) * 86400000,
  ).toISOString();
  const events = db
    .prepare(
      "SELECT * FROM usage_events WHERE account_id=? AND occurred_at>=? ORDER BY occurred_at",
    )
    .all(accountId, since);
  const sessions = db
    .prepare(
      "SELECT * FROM sessions WHERE account_id=? AND started_at>=? ORDER BY started_at",
    )
    .all(accountId, since);
  const dayFormatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Ljubljana",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const completedIds = new Set(
    db
      .prepare("SELECT id FROM sessions WHERE account_id=?")
      .all(accountId)
      .map((s) => s.id),
  );
  const topics = new Map(),
    screens = new Map(),
    days = new Set(),
    visits = new Set();
  const topic = (id) => {
    if (!topics.has(id))
      topics.set(id, {
        topicId: id,
        opens: 0,
        timeSamples: 0,
        hasUsage: false,
        foregroundMs: 0,
        activeMs: 0,
        completed: 0,
        interrupted: 0,
        unclosed: 0,
        exerciseActiveMs: 0,
        measuredSessions: 0,
        elapsedMs: 0,
        lastAt: null,
        modes: {},
      });
    return topics.get(id);
  };
  const touch = (t, at) => {
    if (!t.lastAt || at > t.lastAt) t.lastAt = at;
  };
  const starts = new Map(),
    exits = new Set();
  let foregroundMs = 0,
    activeMs = 0;
  for (const e of events) {
    days.add(dayFormatter.format(new Date(e.occurred_at)));
    if (e.visit_id) visits.add(e.visit_id);
    const t = e.topic_id ? topic(e.topic_id) : null;
    if (t) {
      touch(t, e.occurred_at);
      t.hasUsage = true;
    }
    if (e.kind === "topic_open" && t) t.opens++;
    if (e.kind === "session_start" && e.session_id) starts.set(e.session_id, e);
    if (e.kind === "session_exit" && e.session_id) exits.add(e.session_id);
    if (e.kind === "time") {
      foregroundMs += e.foreground_ms;
      activeMs += e.active_ms;
      if (t) {
        t.timeSamples++;
        t.foregroundMs += e.foreground_ms;
        t.activeMs += e.active_ms;
      }
      const key = e.screen ?? "unknown";
      const x = screens.get(key) ?? {
        screen: key,
        foregroundMs: 0,
        activeMs: 0,
        views: 0,
      };
      x.foregroundMs += e.foreground_ms;
      x.activeMs += e.active_ms;
      screens.set(key, x);
    }
    if (e.kind === "screen_view") {
      const x = screens.get(e.screen) ?? {
        screen: e.screen,
        foregroundMs: 0,
        activeMs: 0,
        views: 0,
      };
      x.views++;
      screens.set(e.screen, x);
    }
  }
  for (const s of sessions) {
    days.add(dayFormatter.format(new Date(s.started_at)));
    const t = topic(s.topic_id);
    t.completed++;
    touch(t, s.completed_at);
    t.modes[s.mode] = (t.modes[s.mode] ?? 0) + 1;
    if (s.active_duration_ms != null) {
      t.exerciseActiveMs += s.active_duration_ms;
      t.measuredSessions++;
    }
    const elapsed =
      s.elapsed_duration_ms ??
      Date.parse(s.completed_at) - Date.parse(s.started_at);
    if (Number.isFinite(elapsed) && elapsed >= 0) t.elapsedMs += elapsed;
  }
  for (const [id, e] of starts) {
    if (completedIds.has(id)) continue;
    const t = e.topic_id ? topic(e.topic_id) : null;
    if (t) {
      if (exits.has(id)) t.interrupted++;
      else t.unclosed++;
    }
  }
  const timeline = events
    .filter((e) => e.kind !== "time")
    .map((e) => ({
      id: e.id,
      kind: e.kind,
      at: e.occurred_at,
      topicId: e.topic_id,
      screen: e.screen,
      mode: e.mode,
      device: e.device,
    }));
  // Continuous work stays visible without flooding the timeline with 10-second
  // samples. Each minute/topic/screen/visit is one explicitly labelled entry.
  const activity = new Map();
  for (const e of events) {
    if (e.kind !== "time") continue;
    const key = JSON.stringify([
      e.occurred_at.slice(0, 16),
      e.topic_id,
      e.screen,
      e.visit_id,
    ]);
    const item = activity.get(key) ?? {
      kind: "activity",
      at: e.occurred_at,
      topicId: e.topic_id,
      screen: e.screen,
      device: e.device,
      foregroundMs: 0,
      activeMs: 0,
    };
    if (e.occurred_at > item.at) item.at = e.occurred_at;
    item.foregroundMs += e.foreground_ms;
    item.activeMs += e.active_ms;
    activity.set(key, item);
  }
  timeline.push(...activity.values());
  timeline.push(
    ...sessions.map((s) => ({
      id: s.id,
      kind: "session_complete",
      at: s.completed_at,
      topicId: s.topic_id,
      mode: s.mode,
      activeMs: s.active_duration_ms,
      elapsedMs:
        s.elapsed_duration_ms ??
        Date.parse(s.completed_at) - Date.parse(s.started_at),
    })),
  );
  const acquired = db
    .prepare(
      "SELECT topic_id,acquired_at FROM account_topics WHERE account_id=? AND acquired_at>=? AND deleted_at IS NULL",
    )
    .all(accountId, since);
  timeline.push(
    ...acquired.map((t) => ({
      kind: "topic_acquired",
      topicId: t.topic_id,
      at: t.acquired_at,
    })),
  );
  const orders = db
    .prepare(
      "SELECT id,plan,status,created_at,updated_at FROM orders WHERE account_id=? AND (created_at>=? OR updated_at>=?)",
    )
    .all(accountId, since, since);
  for (const order of orders) {
    if (order.created_at >= since)
      timeline.push({
        id: order.id,
        kind: "checkout_created",
        at: order.created_at,
        plan: order.plan,
        orderStatus: order.status,
      });
    if (order.updated_at >= since && order.updated_at !== order.created_at)
      timeline.push({
        id: order.id + ":status",
        kind: "order_status",
        at: order.updated_at,
        plan: order.plan,
        orderStatus: order.status,
      });
  }
  const a = db
    .prepare("SELECT created_at,last_seen_at FROM accounts WHERE id=?")
    .get(accountId);
  const first = (table, col) =>
    db
      .prepare(`SELECT MIN(${col}) at FROM ${table} WHERE account_id=?`)
      .get(accountId).at;
  const measuredSince = first("usage_events", "occurred_at");
  const latest =
    db
      .prepare(
        "SELECT received_at,device,version FROM usage_events WHERE account_id=? ORDER BY received_at DESC LIMIT 1",
      )
      .get(accountId) ?? null;
  return {
    period,
    since,
    timezone: "Europe/Ljubljana",
    measuredSince,
    summary: {
      foregroundMs,
      activeMs,
      timeSamples: events.filter((e) => e.kind === "time").length,
      visits: visits.size,
      activeDays: days.size,
      completed: sessions.length,
      topics: topics.size,
      interrupted: [...topics.values()].reduce((n, t) => n + t.interrupted, 0),
    },
    topics: [...topics.values()].sort(
      (a, b) => b.foregroundMs - a.foregroundMs,
    ),
    features: [...screens.values()].sort(
      (a, b) => b.foregroundMs - a.foregroundMs,
    ),
    timeline: timeline.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 100),
    technical: latest,
    clients: db
      .prepare(
        "SELECT device,client_version AS version,current_screen AS screen,last_topic_id AS topicId,last_seen_at AS lastSeenAt FROM auth_tokens WHERE account_id=? AND last_seen_at>=? ORDER BY last_seen_at DESC LIMIT 8",
      )
      .all(accountId, new Date(now - 86400000).toISOString()),
    milestones: {
      registeredAt: a?.created_at,
      firstVisitAt: db
        .prepare(
          "SELECT MIN(occurred_at) at FROM usage_events WHERE account_id=? AND kind='app_open'",
        )
        .get(accountId).at,
      seenAt: a?.last_seen_at,
      firstStudentAt: first("students", "created_at"),
      firstTopicAt: first("account_topics", "acquired_at"),
      firstSessionAt: first("sessions", "started_at"),
    },
  };
}
