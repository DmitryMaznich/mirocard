// Developer-only access for the database created by .devcontainer/start.mjs.
// Never uses MIROCARD_DATA_DIR, a remote API, or production credentials.
import { DatabaseSync } from "node:sqlite";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const dbPath = path.join(root, "runtime", "codespaces", "data", "mirocard.db");
if (process.env.RAILWAY_ENVIRONMENT || !existsSync(dbPath)) {
  console.error("Команда предназначена только для существующей тестовой базы runtime/codespaces/data/mirocard.db.");
  process.exit(1);
}
if (process.argv.length > 3) {
  console.error('Использование: node .devcontainer/grant-access.mjs "email тестового аккаунта"');
  process.exit(1);
}
const email = process.argv[2]?.trim().toLowerCase();
const db = new DatabaseSync(dbPath);
try {
  db.exec("PRAGMA busy_timeout=5000; BEGIN IMMEDIATE");
  const accounts = db.prepare("SELECT id, email, feature_flags FROM accounts WHERE status = 'active' ORDER BY email").all();
  const account = email ? accounts.find((candidate) => candidate.email.toLowerCase() === email)
    : accounts.length === 1 ? accounts[0] : null;
  if (!account) {
    console.error(email ? "Активный тестовый аккаунт с такой почтой не найден." : "Укажите аккаунт, которому открыть темы.");
    console.error("Активные аккаунты тестовой базы:");
    for (const candidate of accounts) console.error(`  ${candidate.email}`);
    console.error('Команда: node .devcontainer/grant-access.mjs "email"');
    db.exec("ROLLBACK");
    process.exitCode = 1;
  } else {
    const previous = JSON.parse(account.feature_flags || "[]");
    if (!Array.isArray(previous)) throw new Error("Некорректный список прав аккаунта; изменения не внесены.");
    const flags = [...new Set([...previous, "all_access", "catalog_all_access"])];
    db.prepare("UPDATE accounts SET feature_flags = ? WHERE id = ?").run(JSON.stringify(flags), account.id);
    db.exec("COMMIT");
    console.log(`Готово: ${account.email} — платные, скрытые, beta- и индивидуальные темы доступны без срока окончания.`);
    console.log("Обновите тестовое приложение. Если каталог не изменился, выйдите из аккаунта и войдите снова.");
    console.log("Архивные темы остаются в архиве; production не изменён.");
  }
} catch (error) {
  if (db.isTransaction) db.exec("ROLLBACK");
  throw error;
} finally {
  db.close();
}
