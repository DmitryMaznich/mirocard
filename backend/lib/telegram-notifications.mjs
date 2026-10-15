import { randomUUID } from "node:crypto";

// No FK: erasure must leave an ID-only notification after the account is gone.
export function enqueueAccountNotification(db, account, type, { method, actor = "admin_token", now = Date.now() } = {}) {
  const payload = type === "erased" ? {} : {
    name: account.display_name, email: account.email, role: account.role,
    referralSource: account.referral_source, method,
    status: method === "google" ? "active" : account.status, actor,
  };
  db.prepare(`INSERT INTO telegram_notifications
    (id, account_id, type, payload, created_at, next_attempt_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(randomUUID(), account.id, type, JSON.stringify(payload), new Date(now).toISOString(), now);
}

export function formatAccountNotification(row) {
  const p = JSON.parse(row.payload);
  const title = { registered: "🟢 Новый пользователь", archived: "🗑 Аккаунт удалён (перенесён в архив)", erased: "❌ Аккаунт стёрт безвозвратно" }[row.type];
  // Plain text, bounded fields: user input cannot inject Telegram formatting.
  const clean = (value) => String(value ?? "").replace(/[\r\n\t]/g, " ").slice(0, 180);
  const lines = [title];
  if (row.type !== "erased") {
    lines.push(`${clean(p.name)} · ${clean(p.email)}`);
    if (row.type === "registered") {
      lines.push(`Роль: ${{ parent: "родитель", specialist: "специалист" }[p.role] ?? clean(p.role)}`);
      lines.push(`Регистрация: ${p.method === "google" ? "Google, аккаунт активен" : "email, ожидает подтверждения"}`);
      lines.push(`Источник: ${clean(p.referralSource)}`);
    }
  }
  if (row.type !== "registered") lines.push(`Кто удалил: ${p.actor === "self" ? "пользователь" : "администратор"}`);
  lines.push(`ID: ${row.account_id}`);
  lines.push(`Время: ${new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Ljubljana", dateStyle: "short", timeStyle: "medium" }).format(new Date(row.created_at))} (Любляна)`);
  return lines.join("\n");
}

export function createTelegramDispatcher(db, {
  token, chatId, fetchImpl = fetch, now = Date.now, logger = console,
} = {}) {
  let running = false;
  return async function dispatch() {
    if (running || !token || !chatId) return;
    running = true;
    try {
      // Bound work per tick; pace requests to the same private chat.
      const rows = db.prepare(`SELECT * FROM telegram_notifications
        WHERE next_attempt_at <= ? ORDER BY created_at, rowid LIMIT 1`).all(now());
      for (const row of rows) {
        let retrySeconds = 0;
        let errorCode = "network";
        try {
          const response = await fetchImpl(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, text: formatAccountNotification(row) }),
            signal: AbortSignal.timeout(10_000),
          });
          const result = await response.json();
          if (!response.ok || result.ok !== true) {
            retrySeconds = Math.max(0, Number(result.parameters?.retry_after) || 0);
            errorCode = String(response.status);
            throw new Error("Telegram rejected notification");
          }
          // Successful delivery does not retain a second copy of personal data.
          db.prepare("DELETE FROM telegram_notifications WHERE id=?").run(row.id);
        } catch {
          const delay = Math.max(retrySeconds * 1000, Math.min(3_600_000, 5000 * 2 ** Math.min(row.attempts, 10)));
          db.prepare(`UPDATE telegram_notifications SET attempts=attempts+1, next_attempt_at=? WHERE id=?`)
            .run(now() + delay, row.id);
          // Never log a fetch error: it can contain the bot token in its URL.
          logger.warn(`[telegram] notification ${row.id} failed (${errorCode}); retry scheduled`);
        }
      }
    } finally {
      running = false;
    }
  };
}

export function startTelegramNotifications(db, env = process.env) {
  if (env.TELEGRAM_ACCOUNT_NOTIFICATIONS !== "1") return;
  if (!env.FEEDBACK_BOT_TOKEN || !/^\d+$/.test(env.FEEDBACK_BOT_OWNER_ID ?? "")) {
    console.warn("[telegram] account notifications disabled: missing bot token or private owner ID");
    return;
  }
  const dispatch = createTelegramDispatcher(db, { token: env.FEEDBACK_BOT_TOKEN, chatId: env.FEEDBACK_BOT_OWNER_ID });
  const tick = () => dispatch().catch(() => console.warn("[telegram] queue processing failed"));
  const timer = setInterval(tick, 1500);
  timer.unref();
  void tick();
  return () => clearInterval(timer);
}
