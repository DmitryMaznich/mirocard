# Email Verification & Extended Registration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Новые аккаунты создаются в статусе `pending`, не могут войти до подтверждения email, а форма регистрации собирает расширенные данные (имя, роль, источник, согласие).

**Architecture:** Новая таблица `email_verification_tokens` (зеркалит `password_reset_tokens`) + пять новых колонок в `accounts`. Backend блокирует логин для `pending`-аккаунтов и добавляет два новых endpoint. Frontend расширяет форму регистрации и добавляет два новых экрана.

**Tech Stack:** Node.js ESM, SQLite (node:sqlite), nodemailer, React (screen-based, no router), Zustand

## Global Constraints

- Все колонки `accounts` добавляются через `ALTER TABLE` (не пересоздание) — существующие пользователи остаются `active`
- Новые поля: `role` ∈ `['parent', 'specialist']`, `referral_source` ∈ `['friend', 'developer', 'other']`
- Токены верификации: `randomUUID()` → SHA-256 через `hashToken()`, TTL 24 часа
- Все тесты: `node:test` + `assert/strict`, БД в памяти через `initDb(":memory:")`
- Frontend: экраны добавляются в `SCREENS` объект в `src/App.jsx`, URL-детекция в boot `useEffect`
- Не сломать: `findAccountByEmail` (используется везде), legacy password flow в `handleLogin`

---

## Task 1: DB schema — новая таблица и колонки accounts

**Files:**
- Modify: `backend/lib/db.mjs`

**Interfaces:**
- Produces: таблица `email_verification_tokens(token_hash, account_id, expires_at, created_at)`, колонки `accounts.first_name`, `accounts.last_name`, `accounts.role`, `accounts.referral_source`, `accounts.consent_personal_data_at`

- [ ] **Step 1: Написать тест на существование новой таблицы и колонок**

Добавить в конец `backend/tests/db.test.mjs`:

```js
test("email_verification_tokens table exists", () => {
  const db = initDb(":memory:");
  const tables = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='email_verification_tokens'"
  ).all();
  assert.equal(tables.length, 1);
});

test("accounts has new columns", () => {
  const db = initDb(":memory:");
  const cols = db.prepare("PRAGMA table_info(accounts)").all().map(c => c.name);
  assert.ok(cols.includes("first_name"));
  assert.ok(cols.includes("last_name"));
  assert.ok(cols.includes("role"));
  assert.ok(cols.includes("referral_source"));
  assert.ok(cols.includes("consent_personal_data_at"));
});
```

- [ ] **Step 2: Запустить тест — убедиться что падает**

```bash
cd backend && node --test tests/db.test.mjs
```

Ожидаем: FAIL "email_verification_tokens table exists"

- [ ] **Step 3: Добавить таблицу и колонки в db.mjs**

В `backend/lib/db.mjs`, в блоке `db.exec(...)` (после CREATE TABLE account_kv), добавить перед закрывающим `\`)`):

```js
    CREATE TABLE IF NOT EXISTS email_verification_tokens (
      token_hash  TEXT PRIMARY KEY,
      account_id  TEXT NOT NULL REFERENCES accounts(id),
      expires_at  TEXT NOT NULL,
      created_at  TEXT NOT NULL
    );
```

Затем в CREATE TABLE accounts заменить строку определения таблицы, добавив новые колонки. Но поскольку таблица создаётся через `CREATE TABLE IF NOT EXISTS`, для существующих БД нужно ALTER TABLE. Добавить после секции `// Alter existing tables` (после блока `portalColumns`):

```js
  const accountColumns = db.prepare("PRAGMA table_info(accounts)").all().map(c => c.name);
  if (!accountColumns.includes("first_name")) {
    db.exec("ALTER TABLE accounts ADD COLUMN first_name TEXT NOT NULL DEFAULT ''");
  }
  if (!accountColumns.includes("last_name")) {
    db.exec("ALTER TABLE accounts ADD COLUMN last_name TEXT NOT NULL DEFAULT ''");
  }
  if (!accountColumns.includes("role")) {
    db.exec("ALTER TABLE accounts ADD COLUMN role TEXT NOT NULL DEFAULT 'parent'");
  }
  if (!accountColumns.includes("referral_source")) {
    db.exec("ALTER TABLE accounts ADD COLUMN referral_source TEXT NOT NULL DEFAULT 'other'");
  }
  if (!accountColumns.includes("consent_personal_data_at")) {
    db.exec("ALTER TABLE accounts ADD COLUMN consent_personal_data_at TEXT NOT NULL DEFAULT ''");
  }
```

- [ ] **Step 4: Запустить тест — убедиться что проходит**

```bash
cd backend && node --test tests/db.test.mjs
```

Ожидаем: все тесты PASS

- [ ] **Step 5: Commit**

```bash
git add backend/lib/db.mjs backend/tests/db.test.mjs
git commit -m "feat(db): add email_verification_tokens table and extended account columns"
```

---

## Task 2: account-repository.mjs — новые функции и обновление createAccount

**Files:**
- Modify: `backend/lib/account-repository.mjs`
- Modify: `backend/tests/account-repository.test.mjs`

**Interfaces:**
- Consumes: новые колонки accounts (Task 1)
- Produces:
  - `createAccount(db, { email, passwordHash, displayName?, firstName, lastName, role, referralSource, consentPersonalDataAt })` — создаёт аккаунт со `status = 'pending'`
  - `findAccountByEmailAny(db, email)` → row | null (без фильтра по status)
  - `createEmailVerificationToken(db, { tokenHash, accountId })` → void
  - `consumeEmailVerificationToken(db, tokenHash)` → accountId | null
  - `activateAccount(db, id)` → void

- [ ] **Step 1: Написать тесты для новых функций**

Добавить в `backend/tests/account-repository.test.mjs` (после существующих импортов, добавить в секцию импортов):

```js
import {
  findAccountByEmailAny,
  createEmailVerificationToken,
  consumeEmailVerificationToken,
  activateAccount,
} from "../lib/account-repository.mjs";
```

Добавить тесты в конце файла (перед закрытием):

```js
// ─── Extended registration & email verification ───────────────────────────────

function makeFullAccount(db) {
  return createAccount(db, {
    email: `full${Date.now()}${Math.random()}@x.com`,
    passwordHash: "h",
    firstName: "Мария",
    lastName: "Иванова",
    role: "parent",
    referralSource: "friend",
    consentPersonalDataAt: "2026-06-30T10:00:00.000Z",
  });
}

test("createAccount stores new fields and status=pending", () => {
  const db = makeDb();
  const acc = makeFullAccount(db);
  assert.equal(acc.status, "pending");
  assert.equal(acc.first_name, "Мария");
  assert.equal(acc.last_name, "Иванова");
  assert.equal(acc.role, "parent");
  assert.equal(acc.referral_source, "friend");
  assert.ok(acc.consent_personal_data_at);
  // display_name is computed from first + last
  assert.equal(acc.display_name, "Мария Иванова");
});

test("findAccountByEmail does NOT return pending account", () => {
  const db = makeDb();
  makeFullAccount(db);
  // findAccountByEmail only returns active accounts
  const found = findAccountByEmail(db, db.prepare("SELECT email FROM accounts").get().email);
  // The account is pending, so findAccountByEmail should return null
  assert.equal(found, null);
});

test("findAccountByEmailAny returns pending account", () => {
  const db = makeDb();
  const acc = makeFullAccount(db);
  const found = findAccountByEmailAny(db, acc.email);
  assert.ok(found);
  assert.equal(found.status, "pending");
});

test("activateAccount sets status to active", () => {
  const db = makeDb();
  const acc = makeFullAccount(db);
  assert.equal(acc.status, "pending");
  activateAccount(db, acc.id);
  const activated = findAccountByEmail(db, acc.email);
  assert.ok(activated);
  assert.equal(activated.status, "active");
});

test("createEmailVerificationToken and consumeEmailVerificationToken", () => {
  const db = makeDb();
  const acc = makeFullAccount(db);
  createEmailVerificationToken(db, { tokenHash: "vhash1", accountId: acc.id });
  const accountId = consumeEmailVerificationToken(db, "vhash1");
  assert.equal(accountId, acc.id);
  // Consumed — second call returns null
  assert.equal(consumeEmailVerificationToken(db, "vhash1"), null);
});

test("consumeEmailVerificationToken returns null for expired token", () => {
  const db = makeDb();
  const acc = makeFullAccount(db);
  // Insert token with past expiry directly
  db.prepare(
    "INSERT INTO email_verification_tokens (token_hash, account_id, expires_at, created_at) VALUES (?, ?, ?, ?)"
  ).run("expired_hash", acc.id, "2000-01-01T00:00:00.000Z", new Date().toISOString());
  assert.equal(consumeEmailVerificationToken(db, "expired_hash"), null);
});

test("createEmailVerificationToken replaces existing token (INSERT OR REPLACE)", () => {
  const db = makeDb();
  const acc = makeFullAccount(db);
  createEmailVerificationToken(db, { tokenHash: "old_hash", accountId: acc.id });
  createEmailVerificationToken(db, { tokenHash: "new_hash", accountId: acc.id });
  // old token is gone (same account_id, INSERT OR REPLACE by primary key)
  // Actually INSERT OR REPLACE keyed on token_hash, so both coexist.
  // The "replace old token" behavior is handled in server.mjs by
  // deleting old tokens for account before inserting. Test that both exist:
  const count = db.prepare(
    "SELECT COUNT(*) as n FROM email_verification_tokens WHERE account_id = ?"
  ).get(acc.id);
  assert.equal(count.n, 2); // both exist; cleanup is server-side
});
```

- [ ] **Step 2: Запустить тесты — убедиться что падают**

```bash
cd backend && node --test tests/account-repository.test.mjs 2>&1 | head -40
```

Ожидаем: FAIL (функции не экспортированы, createAccount не принимает новые поля)

- [ ] **Step 3: Обновить createAccount в account-repository.mjs**

Заменить функцию `createAccount` (строки 69-86):

```js
export function createAccount(db, {
  email,
  passwordHash,
  displayName = "",
  firstName = "",
  lastName = "",
  role = "parent",
  referralSource = "other",
  consentPersonalDataAt = "",
}) {
  const id = randomUUID();
  const ts = now();
  const computedDisplay = displayName || [firstName, lastName].filter(Boolean).join(" ") || email.split("@")[0];

  db.prepare(`
    INSERT INTO accounts
      (id, email, password_hash, display_name, first_name, last_name, role, referral_source,
       consent_personal_data_at, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
  `).run(id, email.toLowerCase().trim(), passwordHash, computedDisplay,
         firstName, lastName, role, referralSource, consentPersonalDataAt, ts, ts);

  db.prepare(`
    INSERT INTO account_settings (account_id, updated_at) VALUES (?, ?)
  `).run(id, ts);

  db.prepare(`
    INSERT OR IGNORE INTO sync_revision (account_id, revision) VALUES (?, 0)
  `).run(id);

  return findAccountByIdAny(db, id);
}
```

Добавить вспомогательную `findAccountByIdAny` (без фильтра статуса, только для внутреннего использования):

```js
function findAccountByIdAny(db, id) {
  return db.prepare("SELECT * FROM accounts WHERE id = ?").get(id) ?? null;
}
```

- [ ] **Step 4: Добавить новые экспортируемые функции в account-repository.mjs**

Добавить после `findAccountById`:

```js
export function findAccountByEmailAny(db, email) {
  return db.prepare(
    "SELECT * FROM accounts WHERE email = ?"
  ).get(email.toLowerCase().trim()) ?? null;
}
```

Добавить после `deleteAccount` (в секции accounts):

```js
export function activateAccount(db, id) {
  db.prepare(
    "UPDATE accounts SET status = 'active', updated_at = ? WHERE id = ?"
  ).run(now(), id);
}
```

Добавить новую секцию после `// ─── Password reset tokens`:

```js
// ─── Email verification tokens ────────────────────────────────────────────────

const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export function createEmailVerificationToken(db, { tokenHash, accountId }) {
  const expiresAt = new Date(Date.now() + VERIFICATION_TTL_MS).toISOString();
  db.prepare(`
    INSERT OR REPLACE INTO email_verification_tokens (token_hash, account_id, expires_at, created_at)
    VALUES (?, ?, ?, ?)
  `).run(tokenHash, accountId, expiresAt, now());
}

export function consumeEmailVerificationToken(db, tokenHash) {
  const row = db.prepare(`
    SELECT account_id FROM email_verification_tokens
    WHERE token_hash = ? AND expires_at > ?
  `).get(tokenHash, now());

  if (!row) return null;

  db.prepare("DELETE FROM email_verification_tokens WHERE token_hash = ?").run(tokenHash);
  return row.account_id;
}

export function deleteEmailVerificationTokensForAccount(db, accountId) {
  db.prepare("DELETE FROM email_verification_tokens WHERE account_id = ?").run(accountId);
}
```

- [ ] **Step 5: Исправить существующие тесты, которые используют createAccount без новых полей**

В `backend/tests/account-repository.test.mjs` функция `makeAccount` создаёт аккаунты без новых полей — это нормально (дефолты применяются). Но тест `createAccount and findAccountByEmail` ожидает что аккаунт найдётся через `findAccountByEmail`. Теперь аккаунт создаётся как `pending`, поэтому `findAccountByEmail` вернёт `null`.

Изменить тест "createAccount and findAccountByEmail":

```js
test("createAccount and findAccountByEmail", () => {
  const db = makeDb();
  const acc = createAccount(db, {
    email: "test@example.com",
    passwordHash: "hash123",
    displayName: "Tester",
  });
  assert.ok(acc.id);
  assert.equal(acc.email, "test@example.com");
  assert.equal(acc.status, "pending"); // new accounts start as pending

  // findAccountByEmail only returns active — must use findAccountByEmailAny
  const found = findAccountByEmailAny(db, "test@example.com");
  assert.equal(found.id, acc.id);
  assert.equal(found.display_name, "Tester");
});
```

Добавить импорт `findAccountByEmailAny` в начале файла (в существующий import блок):

```js
import {
  createAccount,
  findAccountByEmail,
  findAccountByEmailAny,     // добавить
  findAccountById,
  updateAccount,
  deleteAccount,
  storeAuthToken,
  findAccountByToken,
  deleteAuthToken,
  createPasswordResetToken,
  consumePasswordResetToken,
} from "../lib/account-repository.mjs";
```

Изменить `makeAccount` чтобы возвращать active аккаунт (многие тесты студентов/сессий зависят от этого):

```js
function makeAccount(db) {
  const acc = createAccount(db, { email: `u${Date.now()}${Math.random()}@x.com`, passwordHash: "h" });
  // Activate so account is usable in downstream tests (students, sessions, etc.)
  activateAccount(db, acc.id);
  return db.prepare("SELECT * FROM accounts WHERE id = ?").get(acc.id);
}
```

Добавить `activateAccount` в импорты (второй import блок в файле):

```js
import {
  findAccountByEmailAny,
  createEmailVerificationToken,
  consumeEmailVerificationToken,
  activateAccount,
} from "../lib/account-repository.mjs";
```

- [ ] **Step 6: Запустить все тесты репозитория**

```bash
cd backend && node --test tests/account-repository.test.mjs
```

Ожидаем: все тесты PASS

- [ ] **Step 7: Запустить все тесты backend**

```bash
cd backend && node --test tests/
```

Ожидаем: все тесты PASS

- [ ] **Step 8: Commit**

```bash
git add backend/lib/account-repository.mjs backend/tests/account-repository.test.mjs
git commit -m "feat(repo): extend createAccount with new fields, add email verification token functions"
```

---

## Task 3: mailer.mjs — письмо верификации

**Files:**
- Modify: `backend/lib/mailer.mjs`

**Interfaces:**
- Produces: `sendEmailVerificationEmail(email, rawToken)` → Promise<void>

- [ ] **Step 1: Добавить функцию в mailer.mjs**

Добавить после `sendPasswordResetEmail`:

```js
export async function sendEmailVerificationEmail(email, rawToken) {
  const transport = getTransport();
  const verifyUrl = `${APP_BASE_URL}/verify-email?token=${rawToken}`;

  const info = await transport.sendMail({
    from: SMTP_FROM,
    to: email,
    subject: "Подтвердите email — Mirocard",
    text: `Добро пожаловать в Mirocard!\n\nДля подтверждения email перейдите по ссылке (действует 24 часа):\n\n${verifyUrl}\n\nЕсли вы не регистрировались — проигнорируйте это письмо.`,
    html: `<p>Добро пожаловать в Mirocard!</p><p>Для подтверждения email нажмите <a href="${verifyUrl}">эту ссылку</a> (действует 24 часа).</p><p>Если вы не регистрировались — проигнорируйте это письмо.</p>`,
  });

  if (!SMTP_HOST) {
    console.log("[mailer] Verification email (dev):", JSON.parse(info.message).subject, "→", verifyUrl);
  }
}
```

- [ ] **Step 2: Проверить вручную что функция экспортируется без ошибок**

```bash
cd backend && node --input-type=module <<'EOF'
import { sendEmailVerificationEmail } from "./lib/mailer.mjs";
console.log("OK", typeof sendEmailVerificationEmail);
EOF
```

Ожидаем: `OK function`

- [ ] **Step 3: Commit**

```bash
git add backend/lib/mailer.mjs
git commit -m "feat(mailer): add sendEmailVerificationEmail"
```

---

## Task 4: server.mjs — обновлённые и новые endpoints

**Files:**
- Modify: `backend/server.mjs`

**Interfaces:**
- Consumes: `findAccountByEmailAny`, `createEmailVerificationToken`, `consumeEmailVerificationToken`, `activateAccount`, `deleteEmailVerificationTokensForAccount` (Task 2), `sendEmailVerificationEmail` (Task 3)
- Produces:
  - `POST /auth/register` — расширенные поля, `status=pending`, без auth token в ответе
  - `POST /auth/login` — 403 `email_not_verified` для pending аккаунтов
  - `GET /auth/verify-email?token=xxx` — активирует, возвращает auth token
  - `POST /auth/resend-verification` — повторная отправка письма

- [ ] **Step 1: Добавить импорты в server.mjs**

Найти строку с импортами из `account-repository.mjs` (начало файла) и добавить:

```js
import {
  // ... существующие импорты ...
  findAccountByEmailAny,
  createEmailVerificationToken,
  consumeEmailVerificationToken,
  activateAccount,
  deleteEmailVerificationTokensForAccount,
} from "./lib/account-repository.mjs";
```

Найти строку с импортом из `mailer.mjs` и добавить:

```js
import { sendPasswordResetEmail, sendEmailVerificationEmail } from "./lib/mailer.mjs";
```

- [ ] **Step 2: Добавить rate limiter для resend (после блока helpers)**

После функции `requireAuth` добавить:

```js
// ─── Resend verification rate limit ─────────────────────────────────────────
// Simple in-memory: max 3 resends per email per hour
const _resendLimiter = new Map(); // email -> { count, windowStart }

function checkResendLimit(email) {
  const now = Date.now();
  const entry = _resendLimiter.get(email);
  if (!entry || now - entry.windowStart > 60 * 60 * 1000) {
    _resendLimiter.set(email, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= 3) return false;
  entry.count++;
  return true;
}
```

- [ ] **Step 3: Обновить handleRegister**

Заменить функцию `handleRegister` (строки 158-181):

```js
async function handleRegister(req, res) {
  const body = await readJsonBody(req);
  const email = sanitizeEmail(body?.email);
  const password = String(body?.password || "");
  const firstName = String(body?.firstName || "").trim();
  const lastName = String(body?.lastName || "").trim();
  const role = String(body?.role || "");
  const referralSource = String(body?.referralSource || "");
  const consentPersonalData = body?.consentPersonalData === true;

  if (!email || !email.includes("@")) return writeJson(res, 400, { error: "Invalid email" });
  if (password.length < 8) return writeJson(res, 400, { error: "Password must be at least 8 characters" });
  if (!firstName) return writeJson(res, 400, { error: "First name is required" });
  if (!["parent", "specialist"].includes(role)) return writeJson(res, 400, { error: "Invalid role" });
  if (!["friend", "developer", "other"].includes(referralSource)) return writeJson(res, 400, { error: "Invalid referral source" });
  if (!consentPersonalData) return writeJson(res, 400, { error: "Consent to personal data processing is required" });
  if (findAccountByEmailAny(db, email)) return writeJson(res, 409, { error: "Email already registered" });

  const account = createAccount(db, {
    email,
    passwordHash: createPasswordHash(password),
    firstName,
    lastName,
    role,
    referralSource,
    consentPersonalDataAt: new Date().toISOString(),
  });

  const rawToken = randomUUID();
  createEmailVerificationToken(db, { tokenHash: hashToken(rawToken), accountId: account.id });
  await sendEmailVerificationEmail(account.email, rawToken).catch(console.error);

  writeJson(res, 201, { message: "Check your email" });
}
```

- [ ] **Step 4: Обновить handleLogin**

Заменить начало `handleLogin` (строки 183-206), сохранив legacy password logic:

```js
async function handleLogin(req, res) {
  const body = await readJsonBody(req);
  const email = sanitizeEmail(body?.email);
  const password = String(body?.password || "");

  const anyAccount = email ? findAccountByEmailAny(db, email) : null;

  if (anyAccount?.status === "pending") {
    return writeJson(res, 403, { error: "email_not_verified" });
  }

  const account = anyAccount?.status === "active" ? anyAccount : null;
  let passwordMatches = account && verifyPasswordHash(password, account.password_hash);
  let matchedLegacyPassword = false;

  if (account && !passwordMatches) {
    matchedLegacyPassword = getLegacyPasswordHashes(email).some((hash) =>
      verifyPasswordHash(password, hash)
    );
    if (matchedLegacyPassword) {
      updateAccountPasswordHash(db, account.id, createPasswordHash(password));
      passwordMatches = true;
    }
  }

  if (!account || !passwordMatches) {
    return writeJson(res, 401, { error: "Invalid email or password" });
  }

  clearLegacyPasswordHashes(email);

  const token = makeToken(account.id);
  const settings = getAccountSettings(db, account.id);
```

(Остаток функции — ответ с bootstrap — остаётся без изменений)

- [ ] **Step 5: Добавить handleVerifyEmail и handleResendVerification**

Добавить после `handleResetPassword`:

```js
async function handleVerifyEmail(req, res) {
  const url = new URL(req.url, "http://localhost");
  const rawToken = url.searchParams.get("token") || "";

  if (!rawToken) return writeJson(res, 400, { error: "Missing token" });

  const accountId = consumeEmailVerificationToken(db, hashToken(rawToken));
  if (!accountId) return writeJson(res, 400, { error: "invalid_or_expired_token" });

  activateAccount(db, accountId);
  const account = findAccountById(db, accountId);
  const token = makeToken(account.id);
  const settings = getAccountSettings(db, account.id);

  writeJson(res, 200, {
    account: { id: account.id, email: account.email, displayName: account.display_name },
    settings,
    token,
  });
}

async function handleResendVerification(req, res) {
  const body = await readJsonBody(req);
  const email = sanitizeEmail(body?.email);

  // Always return 200 — don't expose account existence
  if (!email || !checkResendLimit(email)) {
    return writeJson(res, 200, { message: "ok" });
  }

  const account = email ? findAccountByEmailAny(db, email) : null;
  if (account?.status === "pending") {
    deleteEmailVerificationTokensForAccount(db, account.id);
    const rawToken = randomUUID();
    createEmailVerificationToken(db, { tokenHash: hashToken(rawToken), accountId: account.id });
    await sendEmailVerificationEmail(account.email, rawToken).catch(console.error);
  }

  writeJson(res, 200, { message: "ok" });
}
```

- [ ] **Step 6: Зарегистрировать новые роуты**

Найти блок роутинга (около строки 796) и добавить два новых роута:

```js
if (method === "GET"    && p === "/auth/verify-email")         return await handleVerifyEmail(req, res);
if (method === "POST"   && p === "/auth/resend-verification")  return await handleResendVerification(req, res);
```

- [ ] **Step 7: Проверить что сервер запускается без ошибок**

```bash
cd backend && node server.mjs &
sleep 2
curl -s http://localhost:3012/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"12345678","firstName":"Test","role":"parent","referralSource":"other","consentPersonalData":true}' \
  | head -c 200
kill %1
```

Ожидаем: `{"message":"Check your email"}` (в dev-режиме без SMTP ссылка выведется в консоль)

- [ ] **Step 8: Commit**

```bash
git add backend/server.mjs
git commit -m "feat(api): email verification endpoints + extended registration validation"
```

---

## Task 5: Frontend — RegisterScreen.jsx (новая форма)

**Files:**
- Modify: `src/features/account/RegisterScreen.jsx`

**Interfaces:**
- Consumes: `POST /auth/register` с новыми полями, ответ `{ message: "Check your email" }` (без token)
- Produces: при успехе — переход на экран `verify_email_sent` (setScreen) с email в state

- [ ] **Step 1: Полностью заменить RegisterScreen.jsx**

```jsx
import { useState } from "react";
import { useAppStore } from "@/core/store";
import { api } from "@/core/api";
import Button from "@/shared/components/Button";

export default function RegisterScreen() {
  const setScreen = useAppStore((s) => s.setScreen);

  const [email,           setEmail]           = useState("");
  const [password,        setPassword]        = useState("");
  const [showPass,        setShowPass]        = useState(false);
  const [firstName,       setFirstName]       = useState("");
  const [lastName,        setLastName]        = useState("");
  const [role,            setRole]            = useState("");
  const [referralSource,  setReferralSource]  = useState("");
  const [consent,         setConsent]         = useState(false);
  const [error,           setError]           = useState("");
  const [loading,         setLoading]         = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (password.length < 8) {
      setError("Пароль должен содержать минимум 8 символов");
      return;
    }
    if (!consent) {
      setError("Необходимо дать согласие на обработку персональных данных");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await api.post("/auth/register", {
        email,
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        role,
        referralSource,
        consentPersonalData: true,
      });
      // Store email for the "check your email" screen
      useAppStore.getState().setPendingVerificationEmail(email);
      setScreen("verify_email_sent");
    } catch (err) {
      setError(err.message || "Ошибка регистрации. Попробуйте ещё раз.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-logo">Mirocard</div>
      <form className="auth-form" onSubmit={handleSubmit}>
        <input
          className="auth-input"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          required
          autoFocus
          autoComplete="email"
        />
        <div className="auth-password-wrap">
          <input
            className="auth-input"
            type={showPass ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Пароль (минимум 8 символов)"
            required
            autoComplete="new-password"
          />
          <button
            type="button"
            className="auth-password-toggle"
            onClick={() => setShowPass((v) => !v)}
            tabIndex={-1}
            aria-label={showPass ? "Скрыть пароль" : "Показать пароль"}
          >
            {showPass ? "🙈" : "👁"}
          </button>
        </div>
        <input
          className="auth-input"
          type="text"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          placeholder="Имя"
          required
          autoComplete="given-name"
        />
        <input
          className="auth-input"
          type="text"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          placeholder="Фамилия (необязательно)"
          autoComplete="family-name"
        />
        <fieldset className="auth-fieldset">
          <legend className="auth-legend">Я являюсь</legend>
          <label className="auth-radio-label">
            <input type="radio" name="role" value="parent" checked={role === "parent"}
              onChange={() => setRole("parent")} required />
            Родителем
          </label>
          <label className="auth-radio-label">
            <input type="radio" name="role" value="specialist" checked={role === "specialist"}
              onChange={() => setRole("specialist")} />
            Специалистом (логопед, дефектолог и др.)
          </label>
        </fieldset>
        <fieldset className="auth-fieldset">
          <legend className="auth-legend">Как вы узнали о нас?</legend>
          <label className="auth-radio-label">
            <input type="radio" name="referralSource" value="friend" checked={referralSource === "friend"}
              onChange={() => setReferralSource("friend")} required />
            Рекомендация друзей
          </label>
          <label className="auth-radio-label">
            <input type="radio" name="referralSource" value="developer" checked={referralSource === "developer"}
              onChange={() => setReferralSource("developer")} />
            Приглашение разработчика
          </label>
          <label className="auth-radio-label">
            <input type="radio" name="referralSource" value="other" checked={referralSource === "other"}
              onChange={() => setReferralSource("other")} />
            Другое
          </label>
        </fieldset>
        <label className="auth-checkbox-label">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />
          Я согласен(на) на обработку персональных данных
        </label>
        {error && <div className="form-error">{error}</div>}
        <Button type="submit" disabled={loading || !role || !referralSource} fullWidth>
          {loading ? "Создаём аккаунт…" : "Создать аккаунт"}
        </Button>
      </form>
      <button className="auth-link" onClick={() => setScreen("login")}>
        Уже есть аккаунт? Войти
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Добавить pendingVerificationEmail в store**

В `src/core/store.js` добавить поле и setter:

```js
pendingVerificationEmail: null,
setPendingVerificationEmail: (email) => set({ pendingVerificationEmail: email }),
```

- [ ] **Step 3: Commit (пока без нового экрана — RegisterScreen компилируется)**

```bash
git add src/features/account/RegisterScreen.jsx src/core/store.js
git commit -m "feat(register): extended registration form with new fields"
```

---

## Task 6: Frontend — LoginScreen.jsx (обработка email_not_verified)

**Files:**
- Modify: `src/features/account/LoginScreen.jsx`

**Interfaces:**
- Consumes: `POST /auth/login` → `403 { error: "email_not_verified" }` (`ApiError.status === 403`)
- Produces: при 403 — показывает сообщение + кнопку "Отправить повторно" которая вызывает `POST /auth/resend-verification`

- [ ] **Step 1: Обновить handleSubmit в LoginScreen.jsx**

Добавить состояние `notVerifiedEmail` и обработку в `catch`:

```jsx
const [notVerifiedEmail, setNotVerifiedEmail] = useState("");
const [resendSent,       setResendSent]       = useState(false);
const [resendLoading,    setResendLoading]     = useState(false);
```

Изменить блок `catch` в `handleSubmit`:

```js
} catch (err) {
  if (err.status === 403 && err.message === "email_not_verified") {
    setNotVerifiedEmail(email);
    setError("Email не подтверждён. Проверьте почту или запросите новое письмо.");
  } else {
    setNotVerifiedEmail("");
    setError(err.message || "Ошибка входа. Проверьте email и пароль.");
  }
}
```

Добавить функцию `handleResend`:

```js
async function handleResend() {
  setResendLoading(true);
  try {
    await api.post("/auth/resend-verification", { email: notVerifiedEmail });
    setResendSent(true);
    setError("Письмо отправлено повторно. Проверьте почту.");
  } catch {
    setError("Не удалось отправить письмо. Попробуйте позже.");
  } finally {
    setResendLoading(false);
  }
}
```

Добавить в JSX после блока `{error && ...}`:

```jsx
{notVerifiedEmail && !resendSent && (
  <button
    type="button"
    className="auth-link"
    onClick={handleResend}
    disabled={resendLoading}
  >
    {resendLoading ? "Отправляем…" : "Отправить письмо повторно"}
  </button>
)}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/account/LoginScreen.jsx
git commit -m "feat(login): handle email_not_verified with resend option"
```

---

## Task 7: Frontend — новые экраны и регистрация в App.jsx

**Files:**
- Create: `src/features/account/VerifyEmailSentScreen.jsx`
- Create: `src/features/account/VerifyEmailScreen.jsx`
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: `pendingVerificationEmail` из store (Task 5), `GET /auth/verify-email?token=xxx` (Task 4), `POST /auth/resend-verification` (Task 4)
- Produces: экраны `verify_email_sent` и `verify_email` в SCREENS; URL-детекция в boot

- [ ] **Step 1: Создать VerifyEmailSentScreen.jsx**

```jsx
import { useState } from "react";
import { useAppStore } from "@/core/store";
import { api } from "@/core/api";
import Button from "@/shared/components/Button";

export default function VerifyEmailSentScreen() {
  const setScreen = useAppStore((s) => s.setScreen);
  const email = useAppStore((s) => s.pendingVerificationEmail);

  const [resendLoading, setResendLoading] = useState(false);
  const [resendSent,    setResendSent]    = useState(false);
  const [resendCooldown, setResendCooldown] = useState(false);
  const [message, setMessage] = useState("");

  async function handleResend() {
    if (resendCooldown) return;
    setResendLoading(true);
    try {
      await api.post("/auth/resend-verification", { email });
      setResendSent(true);
      setMessage("Письмо отправлено повторно. Проверьте почту.");
      setResendCooldown(true);
      setTimeout(() => setResendCooldown(false), 60_000);
    } catch {
      setMessage("Не удалось отправить письмо. Попробуйте позже.");
    } finally {
      setResendLoading(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-logo">Mirocard</div>
      <div className="auth-form">
        <h2 className="auth-title">Проверьте почту</h2>
        <p className="auth-text">
          Мы отправили письмо с подтверждением на{" "}
          <strong>{email || "ваш email"}</strong>.{" "}
          Перейдите по ссылке в письме для завершения регистрации.
        </p>
        {message && <div className="form-success">{message}</div>}
        <Button
          onClick={handleResend}
          disabled={resendLoading || resendCooldown}
          fullWidth
        >
          {resendLoading ? "Отправляем…" : resendSent ? "Отправить ещё раз" : "Отправить письмо повторно"}
        </Button>
      </div>
      <button className="auth-link" onClick={() => setScreen("login")}>
        Уже подтвердили? Войти
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Создать VerifyEmailScreen.jsx**

```jsx
import { useEffect, useState } from "react";
import { useAppStore } from "@/core/store";
import { api, setApiToken } from "@/core/api";
import { getDb } from "@/core/db";
import { persistBootstrap, applyBootstrapToStore } from "@/core/bootstrap";
import Button from "@/shared/components/Button";

export default function VerifyEmailScreen() {
  const setScreen = useAppStore((s) => s.setScreen);
  const token = useAppStore((s) => s.verifyEmailToken);

  const [status, setStatus] = useState("loading"); // loading | success | error

  useEffect(() => {
    if (!token) { setStatus("error"); return; }

    (async () => {
      try {
        const { account, settings, token: authToken } = await api.get(
          `/auth/verify-email?token=${encodeURIComponent(token)}`
        );
        setApiToken(authToken);

        const [bootstrap, sessionsRaw] = await Promise.all([
          api.get("/account/bootstrap"),
          api.get("/sessions?limit=200"),
        ]);

        const payload = {
          token: authToken,
          account,
          settings: bootstrap.settings ?? settings,
          students: bootstrap.students,
          ownedTopics: bootstrap.ownedTopics,
          studentTopicLinks: bootstrap.studentTopicLinks,
          conceptProgress: bootstrap.conceptProgress,
          sessions: sessionsRaw,
        };

        const db = await getDb();
        await persistBootstrap(db, payload);
        applyBootstrapToStore(payload);

        // Clean URL
        window.history.replaceState({}, "", "/");
        setStatus("success");
        setTimeout(() => setScreen("home"), 1500);
      } catch {
        setStatus("error");
      }
    })();
  }, [token, setScreen]);

  if (status === "loading") {
    return <div className="screen-center">Подтверждаем email…</div>;
  }

  if (status === "success") {
    return <div className="screen-center">Email подтверждён! Входим…</div>;
  }

  return (
    <div className="auth-screen">
      <div className="auth-logo">Mirocard</div>
      <div className="auth-form">
        <h2 className="auth-title">Ссылка недействительна</h2>
        <p className="auth-text">
          Ссылка устарела или уже была использована. Запросите новое письмо.
        </p>
        <Button onClick={() => setScreen("login")} fullWidth>
          Перейти к входу
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Добавить verifyEmailToken в store**

В `src/core/store.js` добавить:

```js
verifyEmailToken: null,
setVerifyEmailToken: (token) => set({ verifyEmailToken: token }),
```

- [ ] **Step 4: Зарегистрировать экраны в App.jsx**

Добавить импорты после существующих imports:

```jsx
import VerifyEmailSentScreen from "@/features/account/VerifyEmailSentScreen";
import VerifyEmailScreen     from "@/features/account/VerifyEmailScreen";
```

Добавить в объект SCREENS:

```js
verify_email_sent: VerifyEmailSentScreen,
verify_email:      VerifyEmailScreen,
```

- [ ] **Step 5: Добавить URL-детекцию в boot useEffect в App.jsx**

В начале boot `useEffect` (первые строки в `(async () => {` блоке, перед `const _t0 = performance.now()`):

```js
// Detect /verify-email?token= URL (email verification link)
const urlParams = new URLSearchParams(window.location.search);
const verifyToken = urlParams.get("token");
if (window.location.pathname === "/verify-email" && verifyToken) {
  useAppStore.getState().setVerifyEmailToken(verifyToken);
  setScreen("verify_email");
  return;
}
```

- [ ] **Step 6: Запустить dev сервер и проверить форму регистрации вручную**

```bash
npm run dev
```

Открыть `http://localhost:5174`, нажать «Зарегистрироваться», заполнить форму. В dev-режиме (без SMTP) ссылка верификации появится в консоли backend. Скопировать и открыть — должен произойти автологин.

- [ ] **Step 7: Commit**

```bash
git add src/features/account/VerifyEmailSentScreen.jsx src/features/account/VerifyEmailScreen.jsx src/App.jsx src/core/store.js
git commit -m "feat(frontend): email verification screens and URL detection"
```

---

## Task 8: Deploy и smoke-test

**Files:** нет изменений

- [ ] **Step 1: Собрать и задеплоить**

```bash
npm run deploy:prod
```

- [ ] **Step 2: Smoke-test регистрации на production**

```bash
curl -s https://mirocard.kaplieva.help/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"smoketest@example.com","password":"TestPass123","firstName":"Smoke","role":"parent","referralSource":"other","consentPersonalData":true}'
```

Ожидаем: `{"message":"Check your email"}`

- [ ] **Step 3: Smoke-test логина с неподтверждённым аккаунтом**

```bash
curl -s https://mirocard.kaplieva.help/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"smoketest@example.com","password":"TestPass123"}'
```

Ожидаем: `403 {"error":"email_not_verified"}`

- [ ] **Step 4: Verify deploy**

```bash
npm run deploy:verify
```

Ожидаем: оба URL (LAN + public) доступны
