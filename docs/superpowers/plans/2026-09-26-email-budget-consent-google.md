# Бюджет писем, согласие на новости, вход через Google — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** До поста в Instagram: не упереться молча в лимит бесплатного Resend, собирать согласие на новости с первого дня и дать вход через Google, который не тратит письма.

**Architecture:** Бюджет — таблица успешных отправок + проверка в `mailer.mjs` и перед созданием аккаунта. Согласие — флаг на `accounts` + журнал событий + три точки сбора (регистрация, настройки, разовая карточка). Google — GIS в redirect-режиме → `POST /api/auth/google/callback` проверяет ID-токен по JWKS Google без npm-зависимостей → одноразовый код → SPA меняет код на наш токен (или на экран «Ещё один шаг» для нового человека).

**Tech Stack:** Node 22 (`node:sqlite`, `node:crypto`, `node:test`), React 19 + zustand, vitest/jsdom.

**Spec:** `docs/superpowers/specs/2026-09-26-email-budget-consent-google-design.md`

## Global Constraints

- Работа в отдельном worktree от `origin/main`, ветка `feat/email-budget-consent-google`; первым коммитом — cherry-pick `092d9feb` (Task 1 плана тестирования). Worktree `.worktrees/launch-testing` **не трогать** — там работает другая сессия.
- Пороги по умолчанию: `EMAIL_DAILY_CAP=90`, `EMAIL_SIGNUP_CAP=80`, окно — скользящие 24 часа.
- Коды ошибок API: `signup_paused_email_budget` (регистрация), `email_budget_exhausted` (повторное письмо / сброс пароля) — оба HTTP 503.
- `MARKETING_CONSENT_VERSION = "2026-09-26"` — одинаковая строка во фронте и бэке.
- Галочка новостей **по умолчанию не отмечена**; согласие на обработку данных — отдельно и обязательно при любом способе регистрации.
- Аккаунт через Google создаётся **только** после согласия на обработку данных.
- Без новых npm-зависимостей.
- В `reportError`/`trackEvent` — без email и токенов.
- Деплой (`git push origin main`) — только после явного «да» владельца, с bump версии отдельным коммитом (правило CLAUDE.md).
- Коммитить только свои файлы явным списком.

## Review Focus

1. **Письмо не ушло из-за сбоя Resend (не бюджета)** — такая отправка не должна съедать бюджет, а регистрация не должна оставлять аккаунт в `pending` без единого письма, если бюджет исчерпан. → Task 1 (`record` только после успешного ответа), Task 2 (проверка до `createAccount`).
2. **Google-токен выпущен для чужого приложения** (`aud` ≠ наш clientId) или с `email_verified=false` — вход запрещён. → Task 6.
3. **Одноразовый код Google перехвачен/переиспользован** (история браузера, повторный запрос) — второй обмен возвращает 400, код живёт 5 минут. → Task 6.
4. **Человек, который регистрировался паролем и не подтвердил почту, входит через Google** — аккаунт активируется и привязывается, не создаётся дубль. → Task 6.
5. **Уже зарегистрированный пользователь видит карточку «Присылать новости?» после каждого входа** — должен видеть ровно один раз, любой ответ (включая ✕) её гасит, в т.ч. на другом устройстве. → Task 5.

---

## Task 0: Worktree

- [ ] **Step 1:**

```bash
cd C:/Users/dmazn/Projects/Mirocard2
git fetch origin
git worktree add -b feat/email-budget-consent-google .worktrees/email-budget-google origin/main
cd .worktrees/email-budget-google
git cherry-pick 092d9feb
npm ci && npm ci --prefix backend
cd backend && node --test tests/*.test.mjs 2>&1 | tail -5
```

Expected: cherry-pick без конфликтов; backend suite — все PASS, кроме известного `git-sha` EPERM на Windows (пред-существующий, см. ledger launch-testing).

---

## Task 1: Модуль бюджета писем + учёт в mailer

**Files:**
- Create: `backend/lib/email-budget.mjs`
- Modify: `backend/lib/db.mjs` (таблица `email_send_log`)
- Modify: `backend/lib/config.mjs` (`EMAIL_DAILY_CAP`, `EMAIL_SIGNUP_CAP`)
- Modify: `backend/lib/mailer.mjs` (`setEmailBudget`, `kind` у каждого письма)
- Test: `backend/tests/email-budget.test.mjs`

**Interfaces:**
- Produces:
  - `createEmailBudget(db, { dailyCap, signupCap, now = () => Date.now() }) → { used(): number, canSend(): boolean, canStartSignup(): boolean, record(kind: string): void }`
  - `class EmailBudgetExceeded extends Error { code = "email_budget_exhausted" }`
  - `setEmailBudget(budget | null)` в `mailer.mjs`; каждое письмо вызывает `sendEmail({ ..., kind })` с `kind ∈ {"verification","password_reset","promo_grant","entitlement_reminder","purchase_confirmation"}`.

- [ ] **Step 1: Падающий тест**

`backend/tests/email-budget.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { initDb } from "../lib/db.mjs";
import { createEmailBudget } from "../lib/email-budget.mjs";

function setup(opts = {}) {
  const db = initDb(":memory:");
  let t = Date.parse("2026-09-26T10:00:00Z");
  const clock = { now: () => t, advance: (ms) => { t += ms; } };
  const budget = createEmailBudget(db, { dailyCap: 5, signupCap: 3, now: clock.now, ...opts });
  return { db, budget, clock };
}

test("signup closes at signupCap, sending continues until dailyCap", () => {
  const { budget } = setup();
  for (let i = 0; i < 3; i++) { assert.equal(budget.canStartSignup(), true); budget.record("verification"); }
  assert.equal(budget.canStartSignup(), false);
  assert.equal(budget.canSend(), true);
  budget.record("password_reset"); budget.record("verification");
  assert.equal(budget.used(), 5);
  assert.equal(budget.canSend(), false);
});

test("window is a rolling 24 hours", () => {
  const { budget, clock } = setup();
  for (let i = 0; i < 5; i++) budget.record("verification");
  assert.equal(budget.canSend(), false);
  clock.advance(23 * 3600e3);
  assert.equal(budget.canSend(), false);
  clock.advance(3600e3 + 1);
  assert.equal(budget.used(), 0);
  assert.equal(budget.canSend(), true);
});

test("rows older than 7 days are pruned on record", () => {
  const { db, budget, clock } = setup();
  budget.record("verification");
  clock.advance(8 * 86400e3);
  budget.record("verification");
  assert.equal(db.prepare("SELECT COUNT(*) c FROM email_send_log").get().c, 1);
});
```

Проверить сигнатуру `initDb` (`grep -n "export function initDb" backend/lib/db.mjs`): если принимает не путь — подставить вариант из существующих тестов (`grep -rn "initDb(" backend/tests | head -3`).

- [ ] **Step 2:** `cd backend && node --test tests/email-budget.test.mjs` → FAIL (`Cannot find module ../lib/email-budget.mjs`).

- [ ] **Step 3: Реализация**

`backend/lib/db.mjs` — в блок `CREATE TABLE IF NOT EXISTS` миграций добавить:

```js
    CREATE TABLE IF NOT EXISTS email_send_log (
      id      INTEGER PRIMARY KEY AUTOINCREMENT,
      kind    TEXT NOT NULL,
      sent_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_email_send_log_sent_at ON email_send_log(sent_at);
```

(Разместить рядом с другими `CREATE TABLE IF NOT EXISTS` в том же `db.exec`, где создаются служебные таблицы, — сверить с существующим стилем файла.)

`backend/lib/email-budget.mjs`:

```js
// Resend's free plan has a hard daily quota. Counting our own successful
// sends lets the app pause email signups ("come back tomorrow") instead of
// silently creating accounts whose verification email never arrives.
// Rolling 24h window: we don't know exactly when Resend resets its counter.
const DAY_MS = 24 * 60 * 60 * 1000;
const RETAIN_MS = 7 * DAY_MS;

export class EmailBudgetExceeded extends Error {
  constructor() {
    super("daily email budget exhausted");
    this.code = "email_budget_exhausted";
  }
}

export function createEmailBudget(db, { dailyCap, signupCap, now = () => Date.now() }) {
  const countSince = db.prepare("SELECT COUNT(*) AS c FROM email_send_log WHERE sent_at > ?");
  const insert = db.prepare("INSERT INTO email_send_log (kind, sent_at) VALUES (?, ?)");
  const prune = db.prepare("DELETE FROM email_send_log WHERE sent_at < ?");

  const used = () => countSince.get(now() - DAY_MS).c;
  return {
    used,
    canSend: () => used() < dailyCap,
    canStartSignup: () => used() < signupCap,
    record(kind) {
      const t = now();
      insert.run(String(kind), t);
      prune.run(t - RETAIN_MS);
    },
  };
}
```

`backend/lib/config.mjs` рядом с `RESEND_API_URL`:

```js
// Resend free plan quota guard (see backend/lib/email-budget.mjs). Signup cap
// is lower so already-registered people can still get resend/reset emails.
export const EMAIL_DAILY_CAP  = Number(readEnv("EMAIL_DAILY_CAP") || 90);
export const EMAIL_SIGNUP_CAP = Number(readEnv("EMAIL_SIGNUP_CAP") || 80);
```

`backend/lib/mailer.mjs`:

```js
import { EmailBudgetExceeded } from "./email-budget.mjs";

let budget = null;
export function setEmailBudget(b) { budget = b; }

async function sendEmail({ to, subject, text, html, kind }) {
  if (!RESEND_API_KEY) {
    console.log("[mailer] (dev) email:", subject, "→", to);
    return;
  }
  if (budget && !budget.canSend()) throw new EmailBudgetExceeded();
  // ... существующий fetch(RESEND_API_URL, ...) и обработка !res.ok без изменений ...
  budget?.record(kind);
}
```

(`record` — последней строкой, после успешного `res.ok`: неудачная отправка бюджет не тратит.)

Во всех `send*Email` добавить `kind` в вызов `sendEmail({...})`: `sendPasswordResetEmail` → `"password_reset"`, `sendEmailVerificationEmail` → `"verification"`, `sendPromoGrantEmail` → `"promo_grant"`, `sendEntitlementReminderEmail` → `"entitlement_reminder"`, `sendPurchaseConfirmationEmail` → `"purchase_confirmation"`.

- [ ] **Step 4: Тест mailer + бюджет** — дописать в `email-budget.test.mjs`:

```js
test("mailer records only successful sends and refuses when exhausted", async () => {
  const { createServer } = await import("node:http");
  let calls = 0; let status = 200;
  const srv = createServer((req, res) => { calls++; req.resume(); req.on("end", () => { res.writeHead(status); res.end("{}"); }); });
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  process.env.RESEND_API_KEY = "k";
  process.env.RESEND_API_URL = `http://127.0.0.1:${srv.address().port}/emails`;
  const mailer = await import(`../lib/mailer.mjs?t=${Date.now()}`);
  const { budget } = setup({ dailyCap: 2, signupCap: 1 });
  mailer.setEmailBudget(budget);

  status = 500;
  await assert.rejects(mailer.sendEmailVerificationEmail("a@example.test", "t"));
  assert.equal(budget.used(), 0, "failed send does not consume budget");

  status = 200;
  await mailer.sendEmailVerificationEmail("a@example.test", "t");
  await mailer.sendPasswordResetEmail("a@example.test", "t");
  assert.equal(budget.used(), 2);
  await assert.rejects(mailer.sendPasswordResetEmail("a@example.test", "t"), (e) => e.code === "email_budget_exhausted");
  assert.equal(calls, 3, "exhausted budget does not call Resend");
  srv.close();
});
```

Замечание: `config.mjs` читает env при импорте; `?t=` импортирует **mailer** заново, но `config.mjs` кэширован. Если к моменту теста `config.mjs` уже импортирован без `RESEND_API_KEY` — вынести этот тест в отдельный файл `backend/tests/email-budget-mailer.test.mjs`, где env выставляется **до** первого импорта (как в `email-failure.test.mjs`).

- [ ] **Step 5:** `cd backend && node --test tests/email-budget*.test.mjs tests/email-failure.test.mjs` → PASS.

- [ ] **Step 6: Коммит**

```bash
git add backend/lib/email-budget.mjs backend/lib/db.mjs backend/lib/config.mjs backend/lib/mailer.mjs backend/tests/email-budget*.test.mjs
git commit -m "feat(backend): daily email budget guarding the free Resend quota"
```

---

## Task 2: Пауза регистраций, статус, 503 на повторные письма, сигнал владельцу

**Files:**
- Modify: `backend/server.mjs` (создание бюджета, `handleRegister`, `handleResendVerification`, `handleForgotPassword`, новый `handleSignupStatus`, роут)
- Modify: `backend/lib/config.mjs` (`GOOGLE_CLIENT_ID` — пока только чтение, нужен статусу)
- Test: `backend/tests/email-budget-http.test.mjs`

**Interfaces:**
- Consumes: Task 1 `createEmailBudget`, `setEmailBudget`, `EMAIL_DAILY_CAP`, `EMAIL_SIGNUP_CAP`.
- Produces: `GET /api/auth/signup-status → { emailSignupOpen: boolean, google: { clientId: string } | null }`; `POST /api/auth/register → 503 { error: "signup_paused_email_budget" }`; `POST /api/auth/resend-verification`, `POST /api/auth/forgot-password → 503 { error: "email_budget_exhausted" }`; экспорт `emailBudget` из `server.mjs` (для тестов).

- [ ] **Step 1: Падающий тест** (`backend/tests/email-budget-http.test.mjs`; шапка — как в `email-failure.test.mjs`: фейковый Resend, `MIROCARD_DATA_DIR`, `EMAIL_DAILY_CAP=3`, `EMAIL_SIGNUP_CAP=2`, `GOOGLE_CLIENT_ID=test-client.apps.googleusercontent.com`, затем `const { router, emailBudget } = await import("../server.mjs")`):

```js
const reg = (email, ip) => fetch(urlOf(app, "/api/auth/register"), {
  method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-For": ip },
  body: JSON.stringify({ email, password: "correct horse battery", firstName: "T", role: "parent", referralSource: "other", consentPersonalData: true }),
});
const settle = () => new Promise((r) => setTimeout(r, 150));

test("signup-status reports open email signup and the Google client id", async () => {
  const s = await (await fetch(urlOf(app, "/api/auth/signup-status"))).json();
  assert.deepEqual(s, { emailSignupOpen: true, google: { clientId: "test-client.apps.googleusercontent.com" } });
});

test("email signup pauses at the signup cap without creating an account", async () => {
  assert.equal((await reg("b1@example.test", "10.0.0.1")).status, 201); await settle();
  assert.equal((await reg("b2@example.test", "10.0.0.2")).status, 201); await settle();
  const r = await reg("b3@example.test", "10.0.0.3");
  assert.equal(r.status, 503);
  assert.equal((await r.json()).error, "signup_paused_email_budget");
  assert.equal(findAccountByEmailAny(db, "b3@example.test"), undefined);
  const s = await (await fetch(urlOf(app, "/api/auth/signup-status"))).json();
  assert.equal(s.emailSignupOpen, false);
});

test("resend and forgot-password still work in the reserve, then answer 503", async () => {
  const resend = () => fetch(urlOf(app, "/api/auth/resend-verification"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "b1@example.test" }) });
  assert.equal((await resend()).status, 200); await settle();   // 3rd email: reserve
  const r = await fetch(urlOf(app, "/api/auth/forgot-password"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "b2@example.test" }) });
  assert.equal(r.status, 503);
  assert.equal((await r.json()).error, "email_budget_exhausted");
});
```

(`db`, `findAccountByEmailAny` — импортировать так же, как в `billing-http.test.mjs`. Если `findAccountByEmailAny` для отсутствующего возвращает `null` — `assert.equal(..., null)`; сверить.)

- [ ] **Step 2:** `node --test tests/email-budget-http.test.mjs` → FAIL (404 на `signup-status`).

- [ ] **Step 3: Реализация в `server.mjs`**

Импорты: `import { createEmailBudget } from "./lib/email-budget.mjs";`, `setEmailBudget` из `./lib/mailer.mjs`, `EMAIL_DAILY_CAP, EMAIL_SIGNUP_CAP, GOOGLE_CLIENT_ID` из config. `config.mjs`:

```js
// Public OAuth client id (not a secret). Empty → the Google button is hidden.
export const GOOGLE_CLIENT_ID = readEnv("GOOGLE_CLIENT_ID");
```

После инициализации `db`:

```js
export const emailBudget = createEmailBudget(db, { dailyCap: EMAIL_DAILY_CAP, signupCap: EMAIL_SIGNUP_CAP });
setEmailBudget(emailBudget);

let lastBudgetAlertAt = 0;
function signupPaused() {
  if (emailBudget.canStartSignup()) return false;
  if (Date.now() - lastBudgetAlertAt > 12 * 60 * 60 * 1000) {
    lastBudgetAlertAt = Date.now();
    reportError(new Error("email signup paused: daily budget reached"), { scope: "email_budget", used: emailBudget.used() });
  }
  return true;
}
```

`handleRegister` — сразу после проверки rate limit и **до** любых обращений к БД:

```js
  if (signupPaused()) return writeJson(res, 503, { error: "signup_paused_email_budget" });
```

`handleForgotPassword` и `handleResendVerification` — после rate-limit, до поиска аккаунта (глобальная проверка, не раскрывает существование аккаунта):

```js
  if (!emailBudget.canSend()) return writeJson(res, 503, { error: "email_budget_exhausted" });
```

`reportEmailFailure` (из cherry-pick'нутого Task 1): для `err?.code === "email_budget_exhausted"` — не `reportError` (это ожидаемое состояние, сигнал уже дал `signupPaused`), только `trackEvent("email_send_failed", { kind, status: "budget" })`.

Новый обработчик и роут (рядом с `/auth/resend-verification`):

```js
async function handleSignupStatus(req, res) {
  writeJson(res, 200, {
    emailSignupOpen: emailBudget.canStartSignup(),
    google: GOOGLE_CLIENT_ID ? { clientId: GOOGLE_CLIENT_ID } : null,
  });
}
```
```js
    if (method === "GET"    && p === "/auth/signup-status")        return await handleSignupStatus(req, res);
```

- [ ] **Step 4:** `node --test tests/email-budget-http.test.mjs` → PASS; `npm test` в `backend` → всё PASS (кроме известного `git-sha`).

- [ ] **Step 5: Коммит**

```bash
git add backend/server.mjs backend/lib/config.mjs backend/tests/email-budget-http.test.mjs
git commit -m "feat(backend): pause email signups at the daily email budget; signup-status endpoint"
```

---

## Task 3: Фронт — экран регистрации при закрытой почте, сообщения 503

**Files:**
- Create: `src/features/account/signupStatus.js`
- Modify: `src/features/account/RegisterScreen.jsx`
- Modify: `src/features/account/VerifyEmailSentScreen.jsx`, `src/features/account/ForgotPasswordScreen.jsx` (текст для 503)
- Test: `src/features/account/RegisterScreen.test.jsx`

**Interfaces:**
- Produces: `fetchSignupStatus() → Promise<{ emailSignupOpen: boolean, google: { clientId } | null }>` (при сетевой ошибке → `{ emailSignupOpen: true, google: null }` — не блокируем регистрацию из-за сбоя статуса); константы текстов `SIGNUP_PAUSED_TEXT`, `SIGNUP_PAUSED_WITH_GOOGLE_TEXT`, `EMAIL_BUDGET_EXHAUSTED_TEXT`.
- Слот для кнопки Google (Task 7): `RegisterScreen` рендерит `<GoogleSignInButton clientId=... />`, если `status.google` — в этой задаче компонент ещё не существует, поэтому слот добавляется в Task 7; здесь только текст «Войдите через Google» при `google != null`.

- [ ] **Step 1: Падающий тест** `src/features/account/RegisterScreen.test.jsx` (стиль — как `VerifyEmailSentScreen.test.jsx`):

```jsx
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, afterEach, vi } from "vitest";
import * as apiModule from "@/core/api";
import RegisterScreen from "./RegisterScreen.jsx";

describe("RegisterScreen", () => {
  let container, root;
  afterEach(() => { act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); });

  async function mount() {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => { root.render(<RegisterScreen />); });
    await act(async () => {});
  }

  it("shows the form when email signup is open", async () => {
    vi.spyOn(apiModule.api, "get").mockResolvedValue({ emailSignupOpen: true, google: null });
    await mount();
    expect(container.querySelector("input[type=email]")).not.toBeNull();
  });

  it("hides the form and says come back tomorrow when the budget is spent", async () => {
    vi.spyOn(apiModule.api, "get").mockResolvedValue({ emailSignupOpen: false, google: null });
    await mount();
    expect(container.querySelector("input[type=email]")).toBeNull();
    expect(container.textContent).toMatch(/приходите/);
  });

  it("points to Google when the budget is spent but Google is available", async () => {
    vi.spyOn(apiModule.api, "get").mockResolvedValue({ emailSignupOpen: false, google: { clientId: "x" } });
    await mount();
    expect(container.textContent).toMatch(/через Google/);
  });

  it("keeps the form if the status request fails", async () => {
    vi.spyOn(apiModule.api, "get").mockRejectedValue(new Error("offline"));
    await mount();
    expect(container.querySelector("input[type=email]")).not.toBeNull();
  });
});
```

- [ ] **Step 2:** `npx vitest run src/features/account/RegisterScreen.test.jsx` → FAIL (форма есть всегда / нет текста).

- [ ] **Step 3: Реализация**

`src/features/account/signupStatus.js`:

```js
import { api } from "@/core/api";

export const SIGNUP_PAUSED_TEXT =
  "На сегодня регистрация по почте закончилась — мы маленький проект и отправляем ограниченное число писем в день. Регистрация откроется снова завтра — приходите, пожалуйста!";
export const SIGNUP_PAUSED_WITH_GOOGLE_TEXT =
  "На сегодня регистрация по почте закончилась — мы маленький проект и отправляем ограниченное число писем в день. Войдите через Google прямо сейчас или приходите завтра.";
export const EMAIL_BUDGET_EXHAUSTED_TEXT =
  "Сегодня мы уже отправили все письма, какие могли. Попробуйте, пожалуйста, завтра.";

export async function fetchSignupStatus() {
  try {
    return await api.get("/auth/signup-status");
  } catch {
    return { emailSignupOpen: true, google: null };
  }
}
```

`RegisterScreen.jsx`: `const [status, setStatus] = useState(null);` + `useEffect(() => { let alive = true; fetchSignupStatus().then((s) => alive && setStatus(s)); return () => { alive = false; }; }, []);`. Если `status && !status.emailSignupOpen` — вместо `<form>` блок:

```jsx
<div className="auth-form">
  <p className="auth-notice">{status.google ? SIGNUP_PAUSED_WITH_GOOGLE_TEXT : SIGNUP_PAUSED_TEXT}</p>
</div>
```

В `handleSubmit` catch: `if (err.status === 503 && err.message === "signup_paused_email_budget") { setStatus((s) => ({ ...(s ?? {}), emailSignupOpen: false })); return; }`.

`.auth-notice` — в CSS рядом с `.form-error` (тот же файл, где объявлены `.auth-*` классы: `grep -rn "\.form-error" src/*.css src/**/*.css | head -2`): спокойный информационный блок (не красный), шрифт/отступы как у `.form-error`.

`VerifyEmailSentScreen.jsx` и `ForgotPasswordScreen.jsx`: в обработке ошибки запроса — `if (err.status === 503) setError(EMAIL_BUDGET_EXHAUSTED_TEXT)` (прочитать, как каждый экран сейчас показывает ошибки, и встроить в существующий механизм; `ForgotPasswordScreen` сейчас, вероятно, игнорирует ошибки — тогда добавить `error`-state по образцу `RegisterScreen`).

- [ ] **Step 4:** `npx vitest run src/features/account/` → PASS.

- [ ] **Step 5: Коммит**

```bash
git add src/features/account/signupStatus.js src/features/account/RegisterScreen.jsx src/features/account/RegisterScreen.test.jsx src/features/account/VerifyEmailSentScreen.jsx src/features/account/ForgotPasswordScreen.jsx <css-файл>
git commit -m "feat(auth): come-back-tomorrow state when the daily email budget is spent"
```

---

## Task 4: Согласие на новости — backend

**Files:**
- Modify: `backend/lib/db.mjs` (колонки + журнал)
- Create: `backend/lib/marketing-consent.mjs`
- Modify: `backend/lib/account-repository.mjs` (`serializeAccount`)
- Modify: `backend/server.mjs` (`handleRegister` принимает `marketingOptIn`; `PATCH /account/marketing`)
- Test: `backend/tests/marketing-consent.test.mjs`

**Interfaces:**
- Produces:
  - `MARKETING_CONSENT_VERSION = "2026-09-26"`
  - `setMarketingConsent(db, accountId, { optIn: boolean, source: "register"|"google_signup"|"settings"|"prompt" })` — меняет флаг, пишет событие (`grant`/`withdraw`), проставляет `marketing_prompt_answered_at`.
  - `serializeAccount` → доп. поля `marketingOptIn: boolean`, `marketingPromptAnswered: boolean`.
  - `PATCH /api/account/marketing { optIn, source }` → `200 { account }`; `source` вне allowlist → 400.

- [ ] **Step 1: Падающий тест** `backend/tests/marketing-consent.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { initDb } from "../lib/db.mjs";
import { createAccount, findAccountById, serializeAccount } from "../lib/account-repository.mjs";
import { setMarketingConsent, MARKETING_CONSENT_VERSION } from "../lib/marketing-consent.mjs";

function acc(db) {
  return createAccount(db, { email: `m${Math.random()}@example.test`, passwordHash: "x", firstName: "M", consentPersonalDataAt: new Date().toISOString() });
}

test("new accounts are not opted in and have not answered the prompt", () => {
  const db = initDb(":memory:");
  const s = serializeAccount(acc(db));
  assert.equal(s.marketingOptIn, false);
  assert.equal(s.marketingPromptAnswered, false);
});

test("grant and withdraw are journaled with version and source", () => {
  const db = initDb(":memory:");
  const a = acc(db);
  setMarketingConsent(db, a.id, { optIn: true, source: "register" });
  setMarketingConsent(db, a.id, { optIn: false, source: "settings" });
  const events = db.prepare("SELECT action, text_version, source FROM marketing_consent_events WHERE account_id = ? ORDER BY id").all(a.id);
  assert.deepEqual(events.map((e) => ({ ...e })), [
    { action: "grant", text_version: MARKETING_CONSENT_VERSION, source: "register" },
    { action: "withdraw", text_version: MARKETING_CONSENT_VERSION, source: "settings" },
  ]);
  const s = serializeAccount(findAccountById(db, a.id));
  assert.equal(s.marketingOptIn, false);
  assert.equal(s.marketingPromptAnswered, true);
});

test("declining the prompt marks it answered without a grant event", () => {
  const db = initDb(":memory:");
  const a = acc(db);
  setMarketingConsent(db, a.id, { optIn: false, source: "prompt" });
  assert.equal(serializeAccount(findAccountById(db, a.id)).marketingPromptAnswered, true);
  assert.equal(db.prepare("SELECT COUNT(*) c FROM marketing_consent_events WHERE action='grant'").get().c, 0);
});
```

Плюс HTTP-часть в `backend/tests/marketing-consent-http.test.mjs` (шапка как в `billing-http.test.mjs`, `registerAndLogin`):

```js
test("register with marketingOptIn journals a grant", async () => {
  // зарегистрировать с marketingOptIn: true → в marketing_consent_events одна запись grant/register
});
test("PATCH /account/marketing toggles and rejects unknown source", async () => {
  const token = await registerAndLogin("mk@example.test");
  const patch = (body) => fetch(`${base}/api/account/marketing`, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
  const ok = await patch({ optIn: true, source: "settings" });
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).account.marketingOptIn, true);
  assert.equal((await patch({ optIn: true, source: "evil" })).status, 400);
});
```

(Первый тест дописать полностью по образцу `registerAndLogin`: `fetch register` с `marketingOptIn: true`, затем `db.prepare(...).all()` по `account_id` из `findAccountByEmailAny`.)

- [ ] **Step 2:** оба теста → FAIL.

- [ ] **Step 3: Реализация**

`db.mjs` (миграции в стиле существующих `ALTER TABLE accounts` с проверкой `accountColumns.includes(...)`):

```js
  if (!accountColumns.includes("marketing_opt_in")) {
    db.exec("ALTER TABLE accounts ADD COLUMN marketing_opt_in INTEGER NOT NULL DEFAULT 0");
  }
  if (!accountColumns.includes("marketing_prompt_answered_at")) {
    db.exec("ALTER TABLE accounts ADD COLUMN marketing_prompt_answered_at TEXT");
  }
```
```js
    CREATE TABLE IF NOT EXISTS marketing_consent_events (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id   TEXT NOT NULL REFERENCES accounts(id),
      action       TEXT NOT NULL CHECK (action IN ('grant','withdraw')),
      text_version TEXT NOT NULL,
      source       TEXT NOT NULL,
      created_at   TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_marketing_consent_events_account ON marketing_consent_events(account_id);
```

`backend/lib/marketing-consent.mjs`:

```js
// Consent to "what's new" emails: separate from personal-data consent,
// opt-in only, provable (who, when, which wording, where it was given).
// The wording itself lives in the frontend; bump this together with it.
export const MARKETING_CONSENT_VERSION = "2026-09-26";
export const MARKETING_CONSENT_SOURCES = ["register", "google_signup", "settings", "prompt"];

export function setMarketingConsent(db, accountId, { optIn, source }) {
  if (!MARKETING_CONSENT_SOURCES.includes(source)) throw { status: 400, message: "Invalid source" };
  const ts = new Date().toISOString();
  const current = db.prepare("SELECT marketing_opt_in FROM accounts WHERE id = ?").get(accountId);
  if (!current) throw { status: 404, message: "Account not found" };
  const want = optIn ? 1 : 0;
  if (current.marketing_opt_in !== want) {
    db.prepare("INSERT INTO marketing_consent_events (account_id, action, text_version, source, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(accountId, want ? "grant" : "withdraw", MARKETING_CONSENT_VERSION, source, ts);
  }
  db.prepare("UPDATE accounts SET marketing_opt_in = ?, marketing_prompt_answered_at = COALESCE(marketing_prompt_answered_at, ?), updated_at = ? WHERE id = ?")
    .run(want, ts, ts, accountId);
}
```

`serializeAccount` — добавить:

```js
    marketingOptIn: !!row.marketing_opt_in,
    marketingPromptAnswered: !!row.marketing_prompt_answered_at,
```

`server.mjs` `handleRegister`: после `grantTrialSubscription(...)`:

```js
  setMarketingConsent(db, account.id, { optIn: body?.marketingOptIn === true, source: "register" });
```

(Всегда вызывается: новый аккаунт отвечает на вопрос при регистрации — карточку ему не показываем.)

Новый обработчик + роут:

```js
async function handlePatchMarketing(req, res) {
  const account = requireAuth(req);
  const body = await readJsonBody(req);
  setMarketingConsent(db, account.id, { optIn: body?.optIn === true, source: String(body?.source || "") });
  writeJson(res, 200, { account: serializeAccount(findAccountById(db, account.id)) });
}
```
```js
    if (method === "PATCH"  && p === "/account/marketing")        return await handlePatchMarketing(req, res);
```

(Проверить, что `requireAuth` возвращает объект с `id`; `throw { status: 400 }` уже обрабатывается роутером как 400.)

- [ ] **Step 4:** `node --test tests/marketing-consent*.test.mjs` → PASS; `npm test` в backend → PASS.

- [ ] **Step 5: Коммит**

```bash
git add backend/lib/db.mjs backend/lib/marketing-consent.mjs backend/lib/account-repository.mjs backend/server.mjs backend/tests/marketing-consent*.test.mjs
git commit -m "feat(backend): opt-in marketing consent with an auditable event journal"
```

---

## Task 5: Согласие на новости — фронт (галочка, настройки, разовая карточка)

**Files:**
- Create: `src/features/account/marketingConsent.js`
- Create: `src/features/home/MarketingPromptCard.jsx`
- Modify: `src/features/account/RegisterScreen.jsx`
- Modify: `src/features/settings/AccountScreen.jsx`
- Modify: `src/features/home/HomeScreen.jsx` (место карточки)
- Test: `src/features/home/MarketingPromptCard.test.jsx`, дополнить `RegisterScreen.test.jsx`

**Interfaces:**
- Consumes: Task 4 API (`PATCH /account/marketing`, поля `marketingOptIn`, `marketingPromptAnswered`).
- Produces: `MARKETING_CONSENT_TEXT`, `MARKETING_CONSENT_VERSION = "2026-09-26"`, `saveMarketingConsent(optIn, source) → Promise<account>` (обновляет `account` в store и в IndexedDB через `kv.set(db, "account", account)`).

- [ ] **Step 1: Падающие тесты**

`RegisterScreen.test.jsx` — добавить:

```jsx
  it("marketing checkbox is unchecked by default and its value is sent", async () => {
    vi.spyOn(apiModule.api, "get").mockResolvedValue({ emailSignupOpen: true, google: null });
    const post = vi.spyOn(apiModule.api, "post").mockResolvedValue({});
    await mount();
    const box = container.querySelector("input[name=marketingOptIn]");
    expect(box.checked).toBe(false);
    // заполнить форму: email, имя, два select, пароль, согласие на данные — через нативные setter'ы
    // (как в существующих тестах форм проекта: grep -rn "nativeInputValueSetter\|fireEvent" src | head)
    // … отправить → expect(post.mock.calls[0][1].marketingOptIn).toBe(false)
  });
```

(Дописать заполнение формы по образцу существующего теста формы в проекте; если такого нет — через `Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, v)` + `input.dispatchEvent(new Event("input", { bubbles: true }))`, для select — `HTMLSelectElement.prototype` и событие `change`.)

`src/features/home/MarketingPromptCard.test.jsx`:

```jsx
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { useAppStore } from "@/core/store";
import * as apiModule from "@/core/api";
import MarketingPromptCard from "./MarketingPromptCard.jsx";

describe("MarketingPromptCard", () => {
  let container, root;
  const base = { id: "a1", email: "x@example.test", marketingOptIn: false };
  afterEach(() => { act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); });
  function mount() {
    container = document.createElement("div"); document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(<MarketingPromptCard />));
  }

  it("renders for an account that has not answered", () => {
    useAppStore.setState({ account: { ...base, marketingPromptAnswered: false } });
    mount();
    expect(container.textContent).toMatch(/новых темах/);
  });

  it("renders nothing once answered", () => {
    useAppStore.setState({ account: { ...base, marketingPromptAnswered: true } });
    mount();
    expect(container.textContent).toBe("");
  });

  it("renders nothing in local mode (no account id)", () => {
    useAppStore.setState({ account: { email: "local", displayName: "Локальный режим" } });
    mount();
    expect(container.textContent).toBe("");
  });

  it("'Да' sends optIn true with source prompt and hides the card", async () => {
    useAppStore.setState({ account: { ...base, marketingPromptAnswered: false } });
    const patch = vi.spyOn(apiModule.api, "patch").mockResolvedValue({ account: { ...base, marketingOptIn: true, marketingPromptAnswered: true } });
    mount();
    await act(async () => { container.querySelector("button[data-answer=yes]").click(); });
    expect(patch).toHaveBeenCalledWith("/account/marketing", { optIn: true, source: "prompt" });
    expect(container.textContent).toBe("");
  });

  it("closing with ✕ counts as 'no'", async () => {
    useAppStore.setState({ account: { ...base, marketingPromptAnswered: false } });
    const patch = vi.spyOn(apiModule.api, "patch").mockResolvedValue({ account: { ...base, marketingPromptAnswered: true } });
    mount();
    await act(async () => { container.querySelector("button[aria-label=Закрыть]").click(); });
    expect(patch).toHaveBeenCalledWith("/account/marketing", { optIn: false, source: "prompt" });
  });
});
```

Проверить, что в store поле называется `account` (`grep -n "account:" src/core/store.js | head`); если иначе — поправить в тестах и компоненте.

- [ ] **Step 2:** `npx vitest run src/features/home/MarketingPromptCard.test.jsx src/features/account/RegisterScreen.test.jsx` → FAIL.

- [ ] **Step 3: Реализация**

`src/features/account/marketingConsent.js`:

```js
import { api } from "@/core/api";
import { getDb, kv } from "@/core/db";
import { useAppStore } from "@/core/store";

// Keep in sync with backend/lib/marketing-consent.mjs MARKETING_CONSENT_VERSION.
export const MARKETING_CONSENT_VERSION = "2026-09-26";
export const MARKETING_CONSENT_TEXT =
  "Присылайте мне письма о новых темах и обновлениях Mironium — не чаще пары раз в месяц. Отписаться можно в любой момент.";

export async function saveMarketingConsent(optIn, source) {
  const { account } = await api.patch("/account/marketing", { optIn, source });
  useAppStore.setState({ account });
  try { await kv.set(await getDb(), "account", account); } catch { /* offline cache only */ }
  return account;
}
```

(Сверить импорт `kv`/`getDb`: `LoginScreen.jsx` импортирует их — повторить тот же путь.)

`RegisterScreen.jsx`: state `marketingOptIn` (false); вторая `<label className="auth-consent">` под согласием на данные с `<input type="checkbox" name="marketingOptIn" ...>` и `<span>{MARKETING_CONSENT_TEXT}</span>`; в `api.post("/auth/register", {..., marketingOptIn })`.

`src/features/home/MarketingPromptCard.jsx`:

```jsx
import { useState } from "react";
import { useAppStore } from "@/core/store";
import { saveMarketingConsent } from "@/features/account/marketingConsent";

export default function MarketingPromptCard() {
  const account = useAppStore((s) => s.account);
  const [busy, setBusy] = useState(false);
  if (!account?.id || account.marketingPromptAnswered !== false) return null;

  async function answer(optIn) {
    setBusy(true);
    try { await saveMarketingConsent(optIn, "prompt"); } catch { setBusy(false); }
  }

  return (
    <div className="marketing-prompt" role="region" aria-label="Письма о новых темах">
      <button className="marketing-prompt__close" aria-label="Закрыть" disabled={busy} onClick={() => answer(false)}>✕</button>
      <p className="marketing-prompt__text">Присылать вам письма о новых темах? Не чаще пары раз в месяц.</p>
      <div className="marketing-prompt__actions">
        <button className="btn-primary" data-answer="yes" disabled={busy} onClick={() => answer(true)}>Да, присылать</button>
        <button className="btn-secondary" data-answer="no" disabled={busy} onClick={() => answer(false)}>Нет, спасибо</button>
      </div>
    </div>
  );
}
```

`marketingPromptAnswered !== false` — намеренно: старый кэш аккаунта без поля (`undefined`) карточку не показывает до следующего bootstrap — не спрашиваем по неполным данным.

Стили `.marketing-prompt*` — в CSS главной (`grep -n "\.home-section {" src -r | head -1` — тот же файл), в духе существующих карточек; перед написанием стилей загрузить скилл `designing-mirocard-screens`. Элемент в потоке (не fixed) — safe-area не нужна.

`HomeScreen.jsx`: `<MarketingPromptCard />` первым элементом внутри `<div className="home-tab-content">` (строка ~978), чтобы карточка была над содержимым вкладки.

`AccountScreen.jsx`: новая `settings-section` «Письма» между «Подписка» и «Безопасность»:

```jsx
<div className="settings-section">
  <div className="settings-section-title">Письма</div>
  <label className="settings-row">
    <span className="settings-row__label">Письма о новых темах</span>
    <input type="checkbox" checked={!!account?.marketingOptIn} disabled={savingMarketing}
      onChange={async (e) => { setSavingMarketing(true); try { await saveMarketingConsent(e.target.checked, "settings"); } finally { setSavingMarketing(false); } }} />
  </label>
</div>
```

(Если в проекте есть компонент-переключатель — `grep -rln "role=\"switch\"\|Toggle" src/shared | head` — использовать его вместо голого checkbox.)

- [ ] **Step 4:** `npx vitest run src/features/home src/features/account src/features/settings` → PASS.

- [ ] **Step 5: Коммит**

```bash
git add src/features/account/marketingConsent.js src/features/home/MarketingPromptCard.jsx src/features/home/MarketingPromptCard.test.jsx src/features/account/RegisterScreen.jsx src/features/account/RegisterScreen.test.jsx src/features/settings/AccountScreen.jsx src/features/home/HomeScreen.jsx <css-файлы>
git commit -m "feat(consent): opt-in news checkbox, settings toggle and one-time prompt for existing users"
```

---

## Task 6: Вход через Google — backend

**Files:**
- Create: `backend/lib/google-auth.mjs` (проверка ID-токена)
- Create: `backend/lib/one-time-codes.mjs`
- Modify: `backend/lib/db.mjs` (`account_identities`, `one_time_codes`)
- Modify: `backend/lib/config.mjs` (`GOOGLE_JWKS_URL`)
- Modify: `backend/lib/http.mjs` (`readFormBody`, `parseCookies`)
- Modify: `backend/server.mjs` (3 обработчика + роуты)
- Test: `backend/tests/google-auth.test.mjs`, `backend/tests/google-auth-http.test.mjs`

**Interfaces:**
- Consumes: Task 4 `setMarketingConsent`; существующие `createAccount`, `activateAccount`, `grantTrialSubscription`, `makeToken`, `getAccountSettings`, `serializeAccount`.
- Produces:
  - `verifyGoogleIdToken(idToken, { clientId, jwksUrl, now }) → Promise<{ sub, email, emailVerified, givenName, familyName }>`; бросает `Error` с `code ∈ {"malformed","bad_signature","bad_issuer","bad_audience","expired","email_unverified","unknown_key"}`.
  - `createOneTimeCode(db, { kind: "google_login"|"google_signup"|"google_signup_confirm", payload, ttlMs = 300000 }) → rawCode`; `consumeOneTimeCode(db, rawCode, kind | null) → { kind, payload } | null`.
  - `POST /api/auth/google/callback` (form) → `303 Location: /?google_code=<code>`; при ошибке → `303 /?google_error=<code>`.
  - `POST /api/auth/google/exchange { code }` → `200 { account, settings, token }` | `200 { needsProfile: true, signupCode, email, firstName, lastName }` | `400 { error: "invalid_or_expired_code" }`.
  - `POST /api/auth/google/complete-signup { signupCode, role, referralSource, consentPersonalData, marketingOptIn }` → `201 { account, settings, token }`.

- [ ] **Step 1: Падающий unit-тест проверки токена** `backend/tests/google-auth.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { generateKeyPairSync, sign as cryptoSign } from "node:crypto";
import { verifyGoogleIdToken } from "../lib/google-auth.mjs";

const CLIENT = "test-client.apps.googleusercontent.com";
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: "jwk" }), kid: "k1", alg: "RS256", use: "sig" };
const jwks = await new Promise((resolve) => {
  const s = createServer((req, res) => { res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "max-age=60" }); res.end(JSON.stringify({ keys: [jwk] })); });
  s.listen(0, "127.0.0.1", () => resolve(s));
});
const jwksUrl = `http://127.0.0.1:${jwks.address().port}/certs`;
test.after(() => jwks.close());

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
export function makeToken(claims, { kid = "k1", key = privateKey } = {}) {
  const head = b64({ alg: "RS256", kid, typ: "JWT" });
  const body = b64({ iss: "https://accounts.google.com", aud: CLIENT, sub: "g-123", email: "g@example.test", email_verified: true, given_name: "Галя", family_name: "Г", iat: 1_800_000_000, exp: 1_800_003_600, ...claims });
  const sig = cryptoSign("RSA-SHA256", Buffer.from(`${head}.${body}`), key).toString("base64url");
  return `${head}.${body}.${sig}`;
}
const opts = { clientId: CLIENT, jwksUrl, now: () => 1_800_000_100_000 };

test("valid token", async () => {
  const r = await verifyGoogleIdToken(makeToken({}), opts);
  assert.deepEqual(r, { sub: "g-123", email: "g@example.test", emailVerified: true, givenName: "Галя", familyName: "Г" });
});
test("rejects wrong audience", async () => {
  await assert.rejects(verifyGoogleIdToken(makeToken({ aud: "other" }), opts), { code: "bad_audience" });
});
test("rejects expired", async () => {
  await assert.rejects(verifyGoogleIdToken(makeToken({ exp: 1_800_000_000 }), opts), { code: "expired" });
});
test("rejects unverified email", async () => {
  await assert.rejects(verifyGoogleIdToken(makeToken({ email_verified: false }), opts), { code: "email_unverified" });
});
test("rejects bad issuer", async () => {
  await assert.rejects(verifyGoogleIdToken(makeToken({ iss: "https://evil.example" }), opts), { code: "bad_issuer" });
});
test("rejects signature by another key", async () => {
  const other = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey;
  await assert.rejects(verifyGoogleIdToken(makeToken({}, { key: other }), opts), { code: "bad_signature" });
});
test("rejects unknown kid", async () => {
  await assert.rejects(verifyGoogleIdToken(makeToken({}, { kid: "nope" }), opts), { code: "unknown_key" });
});
test("rejects malformed", async () => {
  await assert.rejects(verifyGoogleIdToken("a.b", opts), { code: "malformed" });
});
```

- [ ] **Step 2:** `node --test tests/google-auth.test.mjs` → FAIL (нет модуля).

- [ ] **Step 3: `backend/lib/google-auth.mjs`**

```js
// Verifies a Google Identity Services ID token (RS256 JWT) without external
// dependencies. Checks: signature against Google's published keys, issuer,
// audience (our client id), expiry, and that Google verified the email.
import { createPublicKey, verify as cryptoVerify } from "node:crypto";

const ISSUERS = new Set(["accounts.google.com", "https://accounts.google.com"]);
const cache = new Map(); // jwksUrl -> { keys: Map<kid, KeyObject>, expiresAt }

function fail(code) { const e = new Error(`google id token: ${code}`); e.code = code; return e; }

async function getKey(jwksUrl, kid, now) {
  let entry = cache.get(jwksUrl);
  if (!entry || entry.expiresAt <= now || !entry.keys.has(kid)) {
    const res = await fetch(jwksUrl);
    if (!res.ok) throw fail("unknown_key");
    const { keys = [] } = await res.json();
    const maxAge = Number((res.headers.get("cache-control") || "").match(/max-age=(\d+)/)?.[1] || 3600);
    entry = { keys: new Map(keys.map((k) => [k.kid, createPublicKey({ key: k, format: "jwk" })])), expiresAt: now + maxAge * 1000 };
    cache.set(jwksUrl, entry);
  }
  const key = entry.keys.get(kid);
  if (!key) throw fail("unknown_key");
  return key;
}

export async function verifyGoogleIdToken(idToken, { clientId, jwksUrl, now = () => Date.now() }) {
  const parts = String(idToken || "").split(".");
  if (parts.length !== 3) throw fail("malformed");
  let header, claims;
  try {
    header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch { throw fail("malformed"); }
  if (header.alg !== "RS256" || !header.kid) throw fail("malformed");

  const key = await getKey(jwksUrl, header.kid, now());
  const ok = cryptoVerify("RSA-SHA256", Buffer.from(`${parts[0]}.${parts[1]}`), key, Buffer.from(parts[2], "base64url"));
  if (!ok) throw fail("bad_signature");
  if (!ISSUERS.has(claims.iss)) throw fail("bad_issuer");
  if (claims.aud !== clientId) throw fail("bad_audience");
  if (!(Number(claims.exp) * 1000 > now())) throw fail("expired");
  if (claims.email_verified !== true && claims.email_verified !== "true") throw fail("email_unverified");

  return {
    sub: String(claims.sub),
    email: String(claims.email).trim().toLowerCase(),
    emailVerified: true,
    givenName: String(claims.given_name || ""),
    familyName: String(claims.family_name || ""),
  };
}
```

`config.mjs`:

```js
// Overridable only for tests (local JWKS with test keys).
export const GOOGLE_JWKS_URL = readEnv("GOOGLE_JWKS_URL") || "https://www.googleapis.com/oauth2/v3/certs";
```

- [ ] **Step 4:** `node --test tests/google-auth.test.mjs` → PASS (8/8).

- [ ] **Step 5: Одноразовые коды + таблицы**

`db.mjs`:

```js
    CREATE TABLE IF NOT EXISTS account_identities (
      provider   TEXT NOT NULL,
      subject    TEXT NOT NULL,
      account_id TEXT NOT NULL REFERENCES accounts(id),
      email      TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (provider, subject)
    );
    CREATE TABLE IF NOT EXISTS one_time_codes (
      code_hash  TEXT PRIMARY KEY,
      kind       TEXT NOT NULL,
      payload    TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      used_at    INTEGER
    );
```

`backend/lib/one-time-codes.mjs`:

```js
// Short-lived single-use codes that carry a Google sign-in from the callback
// (a top-level form POST) to the SPA without putting a session token in the URL.
import { randomBytes, createHash } from "node:crypto";

const hash = (raw) => createHash("sha256").update(raw).digest("hex");

export function createOneTimeCode(db, { kind, payload, ttlMs = 5 * 60 * 1000, now = Date.now() }) {
  const raw = randomBytes(24).toString("base64url");
  db.prepare("DELETE FROM one_time_codes WHERE expires_at < ?").run(now);
  db.prepare("INSERT INTO one_time_codes (code_hash, kind, payload, expires_at) VALUES (?, ?, ?, ?)")
    .run(hash(raw), kind, JSON.stringify(payload), now + ttlMs);
  return raw;
}

// kind === null accepts any kind (the exchange endpoint takes both login and signup codes).
export function consumeOneTimeCode(db, raw, kind, now = Date.now()) {
  const row = db.prepare("SELECT * FROM one_time_codes WHERE code_hash = ?").get(hash(String(raw || "")));
  if (!row || (kind !== null && row.kind !== kind) || row.used_at || row.expires_at < now) return null;
  const upd = db.prepare("UPDATE one_time_codes SET used_at = ? WHERE code_hash = ? AND used_at IS NULL").run(now, row.code_hash);
  if (upd.changes !== 1) return null;
  return { kind: row.kind, payload: JSON.parse(row.payload) };
}
```

Виды кодов: `google_login` (callback → вход), `google_signup` (callback → новый человек), `google_signup_confirm` (выдаётся `exchange` для `complete-signup`).

- [ ] **Step 6: `http.mjs` — form body и cookies**

```js
export async function readFormBody(request) {
  let raw = "";
  for await (const chunk of request) { raw += chunk; if (raw.length > 64 * 1024) throw { status: 413, message: "Body too large" }; }
  return Object.fromEntries(new URLSearchParams(raw));
}

export function parseCookies(request) {
  return Object.fromEntries(String(request.headers.cookie || "").split(";").map((c) => c.trim().split("=")).filter(([k]) => k).map(([k, ...v]) => [k, decodeURIComponent(v.join("="))]));
}
```

- [ ] **Step 7: HTTP-тест** `backend/tests/google-auth-http.test.mjs` — шапка как в `billing-http.test.mjs` + локальный JWKS (как в Step 1; `makeToken` вынести в `backend/tests/helpers/google-token.mjs` и импортировать в оба теста) + `process.env.GOOGLE_CLIENT_ID = CLIENT; process.env.GOOGLE_JWKS_URL = jwksUrl;` **до** импорта server. Время: токены с `exp` в будущем относительно реального `Date.now()` (`iat: now, exp: now + 3600`).

```js
async function callback(token, { csrf = "c1", cookieCsrf = "c1" } = {}) {
  const r = await fetch(`${base}/api/auth/google/callback`, {
    method: "POST", redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: `g_csrf_token=${cookieCsrf}` },
    body: new URLSearchParams({ credential: token, g_csrf_token: csrf }).toString(),
  });
  return { status: r.status, location: r.headers.get("location") };
}
const codeOf = (loc) => new URL(loc, base).searchParams.get("google_code");
const exchange = (code) => fetch(`${base}/api/auth/google/exchange`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });

test("CSRF mismatch is rejected", async () => {
  const r = await callback(tok({ sub: "s-csrf" }), { csrf: "a", cookieCsrf: "b" });
  assert.equal(r.status, 303);
  assert.match(r.location, /google_error=csrf/);
});

test("new person: needsProfile, no account until complete-signup with consent", async () => {
  const r = await callback(tok({ sub: "s-new", email: "new@example.test" }));
  const ex = await (await exchange(codeOf(r.location))).json();
  assert.equal(ex.needsProfile, true);
  assert.equal(findAccountByEmailAny(db, "new@example.test") ?? null, null);

  const noConsent = await fetch(`${base}/api/auth/google/complete-signup`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ signupCode: ex.signupCode, role: "parent", referralSource: "other", consentPersonalData: false }) });
  assert.equal(noConsent.status, 400);

  // Re-login to get a fresh signup code (the first one may be consumed by the failed attempt — see ruling below)
  const r2 = await callback(tok({ sub: "s-new", email: "new@example.test" }));
  const ex2 = await (await exchange(codeOf(r2.location))).json();
  const done = await fetch(`${base}/api/auth/google/complete-signup`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ signupCode: ex2.signupCode, role: "parent", referralSource: "other", consentPersonalData: true, marketingOptIn: true }) });
  assert.equal(done.status, 201);
  const body = await done.json();
  assert.ok(body.token);
  assert.equal(body.account.marketingOptIn, true);
  assert.equal(findAccountByEmailAny(db, "new@example.test").status, "active");
});

test("second login by the same Google subject goes straight in", async () => {
  const r = await callback(tok({ sub: "s-new", email: "new@example.test" }));
  const ex = await (await exchange(codeOf(r.location))).json();
  assert.ok(ex.token);
  assert.equal(ex.account.email, "new@example.test");
});

test("code is single-use", async () => {
  const r = await callback(tok({ sub: "s-new", email: "new@example.test" }));
  const code = codeOf(r.location);
  assert.equal((await exchange(code)).status, 200);
  assert.equal((await exchange(code)).status, 400);
});

test("existing pending password account is linked and activated, not duplicated", async () => {
  await fetch(`${base}/api/auth/register`, { method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-For": "10.9.9.9" }, body: JSON.stringify({ email: "pend@example.test", password: "correct horse battery", firstName: "P", role: "parent", referralSource: "other", consentPersonalData: true }) });
  const before = findAccountByEmailAny(db, "pend@example.test");
  assert.equal(before.status, "pending");
  const r = await callback(tok({ sub: "s-pend", email: "pend@example.test" }));
  const ex = await (await exchange(codeOf(r.location))).json();
  assert.equal(ex.account.id, before.id);
  assert.equal(findAccountByEmailAny(db, "pend@example.test").status, "active");
});

test("invalid token redirects with an error, no code", async () => {
  const r = await callback(tok({ aud: "someone-else" }));
  assert.match(r.location, /google_error=bad_audience/);
});
```

Ruling, зафиксированный в плане: неудачный `complete-signup` (нет согласия, 400) **не** расходует `signupCode` — проверка тела идёт до `consume`. Тогда в тесте второй `callback` не обязателен, но оставлен как проверка, что повторный вход до завершения регистрации тоже работает.

- [ ] **Step 8:** → FAIL (404).

- [ ] **Step 9: Обработчики в `server.mjs`**

```js
const GOOGLE_ERROR_CODES = new Set(["malformed", "bad_signature", "bad_issuer", "bad_audience", "expired", "email_unverified", "unknown_key"]);
const googleRedirect = (res, params) => { res.writeHead(303, { Location: `/?${new URLSearchParams(params)}` }); res.end(); };

function findAccountByGoogleSubject(sub) {
  const row = db.prepare("SELECT account_id FROM account_identities WHERE provider = 'google' AND subject = ?").get(sub);
  return row ? findAccountByEmailAny(db, findAccountById(db, row.account_id)?.email ?? "") : null;
}
function linkGoogle(accountId, { sub, email }) {
  db.prepare("INSERT OR IGNORE INTO account_identities (provider, subject, account_id, email, created_at) VALUES ('google', ?, ?, ?, ?)")
    .run(sub, accountId, email, new Date().toISOString());
}
function loginPayload(account) {
  return { account: serializeAccount(account), settings: getAccountSettings(db, account.id), token: makeToken(account.id) };
}

async function handleGoogleCallback(req, res) {
  if (!GOOGLE_CLIENT_ID) return googleRedirect(res, { google_error: "disabled" });
  const form = await readFormBody(req);
  const cookieCsrf = parseCookies(req).g_csrf_token;
  if (!form.g_csrf_token || form.g_csrf_token !== cookieCsrf) return googleRedirect(res, { google_error: "csrf" });

  let id;
  try {
    id = await verifyGoogleIdToken(form.credential, { clientId: GOOGLE_CLIENT_ID, jwksUrl: GOOGLE_JWKS_URL });
  } catch (e) {
    return googleRedirect(res, { google_error: GOOGLE_ERROR_CODES.has(e.code) ? e.code : "failed" });
  }

  let account = findAccountByGoogleSubject(id.sub);
  if (!account) {
    const byEmail = findAccountByEmailAny(db, id.email);
    if (byEmail && byEmail.status !== "deleted") {
      if (byEmail.status === "pending") activateAccount(db, byEmail.id);
      linkGoogle(byEmail.id, id);
      account = findAccountById(db, byEmail.id);
    }
  }
  if (account) {
    const code = createOneTimeCode(db, { kind: "google_login", payload: { accountId: account.id } });
    trackEvent("login_completed", { method: "google" });
    return googleRedirect(res, { google_code: code });
  }
  const code = createOneTimeCode(db, { kind: "google_signup", payload: id, ttlMs: 30 * 60 * 1000 });
  return googleRedirect(res, { google_code: code });
}

async function handleGoogleExchange(req, res) {
  const body = await readJsonBody(req);
  const hit = consumeOneTimeCode(db, body?.code, null);
  if (!hit) return writeJson(res, 400, { error: "invalid_or_expired_code" });
  if (hit.kind === "google_login") {
    const account = findAccountById(db, hit.payload.accountId);
    if (!account) return writeJson(res, 400, { error: "invalid_or_expired_code" });
    return writeJson(res, 200, loginPayload(account));
  }
  // google_signup: hand out a fresh signup code (the exchanged one is spent)
  const signupCode = createOneTimeCode(db, { kind: "google_signup_confirm", payload: hit.payload, ttlMs: 30 * 60 * 1000 });
  writeJson(res, 200, { needsProfile: true, signupCode, email: hit.payload.email, firstName: hit.payload.givenName, lastName: hit.payload.familyName });
}

async function handleGoogleCompleteSignup(req, res) {
  const body = await readJsonBody(req);
  const role = String(body?.role || "");
  const referralSource = String(body?.referralSource || "");
  if (!["parent", "specialist"].includes(role)) return writeJson(res, 400, { error: "Invalid role" });
  if (!["friend", "developer", "other"].includes(referralSource)) return writeJson(res, 400, { error: "Invalid referral source" });
  if (body?.consentPersonalData !== true) return writeJson(res, 400, { error: "Consent to personal data processing is required" });

  const hit = consumeOneTimeCode(db, body?.signupCode, "google_signup_confirm");
  if (!hit) return writeJson(res, 400, { error: "invalid_or_expired_code" });
  const id = hit.payload;

  let account = findAccountByEmailAny(db, id.email);
  if (!account) {
    account = createAccount(db, {
      email: id.email, passwordHash: "", firstName: id.givenName || id.email.split("@")[0], lastName: id.familyName,
      role, referralSource, consentPersonalDataAt: new Date().toISOString(),
    });
    activateAccount(db, account.id);
    grantTrialSubscription(db, account.id);
    setMarketingConsent(db, account.id, { optIn: body?.marketingOptIn === true, source: "google_signup" });
    trackEvent("registration_completed", { role, referralSource, method: "google" });
  }
  linkGoogle(account.id, id);
  writeJson(res, 201, loginPayload(findAccountById(db, account.id)));
}
```

Роуты рядом с auth:

```js
    if (method === "POST"   && p === "/auth/google/callback")        return await handleGoogleCallback(req, res);
    if (method === "POST"   && p === "/auth/google/exchange")        return await handleGoogleExchange(req, res);
    if (method === "POST"   && p === "/auth/google/complete-signup") return await handleGoogleCompleteSignup(req, res);
```

Поправить тест из Step 7 под ruling «exchange выдаёт новый `google_signup_confirm`-код»: `ex.signupCode` уже именно он — тест корректен как есть. Проверить `findAccountById` возвращает только `active`? (`grep -n "export function findAccountById" -A5 backend/lib/account-repository.mjs`) — если фильтрует по статусу, в `loginPayload` после `activateAccount` это нормально; упростить `findAccountByGoogleSubject` до прямого `SELECT` по `accounts` с `status != 'deleted'`.

Также добавить в `handleRegister` в trackEvent `method: "email"`.

- [ ] **Step 10:** `node --test tests/google-auth*.test.mjs` → PASS; весь backend suite → PASS.

- [ ] **Step 11: Коммит**

```bash
git add backend/lib/google-auth.mjs backend/lib/one-time-codes.mjs backend/lib/db.mjs backend/lib/config.mjs backend/lib/http.mjs backend/server.mjs backend/tests/google-auth*.test.mjs backend/tests/helpers/google-token.mjs
git commit -m "feat(backend): Google sign-in (ID token verification, account linking, consent-gated signup)"
```

---

## Task 7: Вход через Google — фронт

**Files:**
- Create: `src/features/account/completeLogin.js` (вынос из `LoginScreen.jsx`)
- Create: `src/features/account/GoogleSignInButton.jsx`
- Create: `src/features/account/GoogleCompleteProfileScreen.jsx`
- Create: `src/features/account/googleSignIn.js` (обмен кода)
- Modify: `src/features/account/LoginScreen.jsx`, `RegisterScreen.jsx`, `src/App.jsx`, `src/core/store.js`
- Test: `src/features/account/completeLogin.test.js`, `src/features/account/GoogleCompleteProfileScreen.test.jsx`

**Interfaces:**
- Consumes: Task 6 API; Task 3 `fetchSignupStatus`; Task 5 `MARKETING_CONSENT_TEXT`.
- Produces:
  - `completeLogin({ account, token }) → Promise<void>` — ровно та логика, что сейчас в `LoginScreen.handleSubmit` после получения токена (merge при том же аккаунте / очистка при другом, bootstrap, `persistBootstrap`, `kv.set(db, "accountId", ...)`, `applyBootstrapToStore`, `setScreen("home")`).
  - store: `googleSignup: { signupCode, email, firstName, lastName } | null`, `setGoogleSignup(v)`; экран `"google_complete_profile"`.

- [ ] **Step 1: Рефакторинг без изменения поведения — тест-«страховка»**

`src/features/account/completeLogin.test.js`: мок `api.get` (`/account/bootstrap` → `{ students: [{id:"s1"}], ownedTopics: [], studentTopicLinks: [], conceptProgress: [], settings: {} }`, `/sessions?limit=200` → `[]`), `fake-indexeddb` (уже в devDependencies; как подключают другие тесты — `grep -rn "fake-indexeddb" src | head -2`). Проверить: после `completeLogin({ account: { id: "a1", email: "x" }, token: "t" })` → `useAppStore.getState().screen === "home"`, `students` из bootstrap в store, `kv.get(db, "accountId") === "a1"`. Второй тест: в IDB `accountId = "other"` и чужие `students` → после входа чужих студентов нет.

- [ ] **Step 2:** FAIL (нет модуля) → перенести код из `LoginScreen.jsx` (от `setApiToken(token)` до `setScreen("home")`) в `completeLogin.js` без изменений логики; `LoginScreen` вызывает `await completeLogin({ account, token })`. `VerifyEmailScreen` **не трогать** (свой путь, вне рамок).

- [ ] **Step 3:** `npx vitest run src/features/account` → PASS (включая существующие тесты входа, если есть).

- [ ] **Step 4: Кнопка Google**

`src/features/account/GoogleSignInButton.jsx`:

```jsx
import { useEffect, useRef, useState } from "react";

const GIS_SRC = "https://accounts.google.com/gsi/client";

function loadGis() {
  if (window.google?.accounts?.id) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = GIS_SRC; s.async = true; s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}

// Redirect mode only: popups are unreliable in the iOS home-screen PWA.
export default function GoogleSignInButton({ clientId, text = "signin_with" }) {
  const ref = useRef(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    loadGis().then(() => {
      if (!alive || !ref.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        ux_mode: "redirect",
        login_uri: `${window.location.origin}/api/auth/google/callback`,
      });
      window.google.accounts.id.renderButton(ref.current, { type: "standard", theme: "outline", size: "large", text, shape: "pill", width: 320, locale: "ru" });
    }).catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, [clientId, text]);
  if (failed) return null;
  return <div className="google-signin" ref={ref} />;
}
```

`LoginScreen.jsx` и `RegisterScreen.jsx`: получить статус (`fetchSignupStatus`) и при `status.google` показать `<GoogleSignInButton clientId={status.google.clientId} text="signin_with" | "signup_with" />` над формой с разделителем «или». В `RegisterScreen` при закрытой почте кнопка показывается вместе с текстом `SIGNUP_PAUSED_WITH_GOOGLE_TEXT`.

- [ ] **Step 5: Приём кода в `App.jsx`**

В начале того же `useEffect`, где обрабатываются `/verify-email` и `/reset`:

```js
    const googleCode = urlParams.get("google_code");
    const googleError = urlParams.get("google_error");
    if (googleCode || googleError) {
      window.history.replaceState({}, "", "/");
      if (googleError) {
        useAppStore.setState({ authNotice: "Не получилось войти через Google. Попробуйте ещё раз или войдите по почте." });
        setScreen("login");
        return;
      }
      handleGoogleCode(googleCode).catch(() => {
        useAppStore.setState({ authNotice: "Ссылка входа через Google устарела. Нажмите «Войти через Google» ещё раз." });
        setScreen("login");
      });
      return;
    }
```

`src/features/account/googleSignIn.js`:

```js
import { api } from "@/core/api";
import { useAppStore } from "@/core/store";
import { completeLogin } from "./completeLogin";

export async function handleGoogleCode(code) {
  const r = await api.post("/auth/google/exchange", { code });
  if (r.needsProfile) {
    useAppStore.setState({ googleSignup: { signupCode: r.signupCode, email: r.email, firstName: r.firstName, lastName: r.lastName } });
    useAppStore.getState().setScreen("google_complete_profile");
    return;
  }
  await completeLogin({ account: r.account, token: r.token });
}
```

`store.js`: `googleSignup: null`, `authNotice: null` (+ `LoginScreen` показывает `authNotice` в `.auth-notice` и очищает при размонтировании). `App.jsx` SCREENS: `google_complete_profile: GoogleCompleteProfileScreen`.

- [ ] **Step 6: Экран «Ещё один шаг» — падающий тест** `GoogleCompleteProfileScreen.test.jsx`:

- рендер при `googleSignup = { signupCode: "c", email: "g@example.test", firstName: "Галя" }` показывает email и «Ещё один шаг»;
- галочка новостей не отмечена; без согласия на данные кнопка «Продолжить» не шлёт запрос и показывает ошибку;
- с согласием → `api.post("/auth/google/complete-signup", { signupCode: "c", role: "parent", referralSource: "other", consentPersonalData: true, marketingOptIn: false })`, затем вызван `completeLogin` (замокать модуль `./completeLogin`);
- ответ 400 `invalid_or_expired_code` → текст «Время на завершение регистрации истекло. Нажмите «Войти через Google» ещё раз.» и кнопка «К входу».
- без `googleSignup` в store → сразу `setScreen("login")`.

- [ ] **Step 7: Реализация экрана** — разметка по образцу `RegisterScreen` (`auth-screen`, `auth-form`, те же два `select` с теми же опциями, `auth-consent` для согласия на данные с модалкой политики, вторая `auth-consent` с `MARKETING_CONSENT_TEXT`), заголовок «Ещё один шаг», строка «Вы входите как {email}». Перед вёрсткой — скилл `designing-mirocard-screens`.

- [ ] **Step 8:** `npx vitest run src/features/account src/App` → PASS; `npm run build` → успешно; `npm run lint -- src/features/account` → без новых ошибок.

- [ ] **Step 9: Коммит**

```bash
git add src/features/account/completeLogin.js src/features/account/completeLogin.test.js src/features/account/GoogleSignInButton.jsx src/features/account/googleSignIn.js src/features/account/GoogleCompleteProfileScreen.jsx src/features/account/GoogleCompleteProfileScreen.test.jsx src/features/account/LoginScreen.jsx src/features/account/RegisterScreen.jsx src/App.jsx src/core/store.js <css>
git commit -m "feat(auth): Google sign-in button, code exchange and one-more-step profile screen"
```

---

## Task 8: Документы, живая проверка, подготовка деплоя

**Files:**
- Create: `docs/google-sign-in-setup.md`
- Create: `docs/drafts/privacy-google-and-news.md` (черновик правок политики — **не** публикуется без «да»)
- Modify: `docs/testing/launch-day-runbook.md` **не трогать здесь** (он в ветке `launch-testing`) — вместо этого добавить раздел в `docs/google-sign-in-setup.md` «Что изменилось для вечера запуска».

- [ ] **Step 1: `docs/google-sign-in-setup.md`** — пошагово для владельца: Google Cloud Console → новый проект «Mironium» → APIs & Services → OAuth consent screen (External; App name Mironium; support email; logo — необязательно, с ним Google проверяет бренд несколько дней; App domain: `https://mironium.com`; privacy/terms URL — реальные адреса legal-страниц: `grep -rn "privacy" landing/*.html | head -3`; Authorized domains: `mironium.com`; scopes: только `openid`, `email`, `profile`) → Publishing status: In production → Credentials → Create OAuth client ID → Web application → Authorized JavaScript origins: `https://app.mironium.com`, `http://localhost:5174` → скопировать Client ID → Railway `mirocard-backend` → Variables → `GOOGLE_CLIENT_ID`. Плюс Search Console — подтверждение домена, если консоль потребует. Плюс переменные `EMAIL_DAILY_CAP` / `EMAIL_SIGNUP_CAP` и как их менять.

- [ ] **Step 2: Черновик правок политики** — что добавить: (1) вход через Google — получаем имя, email, идентификатор Google; не получаем пароль и контакты; (2) письма о новостях — основание: согласие; отзыв в настройках или ссылкой в письме; частота. Для обеих языковых версий (ru/sl) — пометить, какие файлы менять (`grep -rln "Политика конфиденциальности" landing backend/legal | head`).

- [ ] **Step 3: Живая проверка UI без Google** — `npm run dev` + backend локально (как в `.claude/launch.json`, если есть; иначе `node backend/server.mjs` с `SERVE_STATIC` и временным `MIROCARD_DATA_DIR`) с `EMAIL_SIGNUP_CAP=0`: экран регистрации показывает «приходите завтра»; с `EMAIL_SIGNUP_CAP=80` — форма с галочкой новостей (не отмечена). Войти — карточка на главной у старого аккаунта (выставить `marketing_prompt_answered_at = NULL` в локальной БД), ответ «Нет» — карточка исчезает и не возвращается после перезагрузки. Скриншоты — владельцу.

- [ ] **Step 4: Живая проверка Google** — только после того, как владелец даст `GOOGLE_CLIENT_ID`: локально на `http://localhost:5174` с этим ID — новый человек → «Ещё один шаг» → внутри; повторный вход → сразу внутри. Если ID ещё нет — записать в ledger как «ожидает владельца», не блокирует остальное.

- [ ] **Step 5: Полные прогоны**

```bash
cd backend && npm test
cd .. && npx vitest run
npm run build
```

Expected: всё PASS (кроме известного `git-sha` на Windows), сборка успешна.

- [ ] **Step 6: Коммит документов**

```bash
git add docs/google-sign-in-setup.md docs/drafts/privacy-google-and-news.md
git commit -m "docs: Google sign-in setup guide and privacy policy draft"
```

- [ ] **Step 7: Деплой — только с «да» владельца.** Показать владельцу: что меняется для пользователей, что нужно выставить в Railway до/после (`GOOGLE_CLIENT_ID` можно и после — без него кнопка просто скрыта), правки политики. После «да»: merge ветки в `main` (с учётом того, что `092d9feb` придёт и из `launch-testing` — cherry-pick даёт тот же diff, git примет без конфликта или конфликт тривиален), bump версии отдельным коммитом, `git push origin main`, проверить `/api/version` и `/`.
