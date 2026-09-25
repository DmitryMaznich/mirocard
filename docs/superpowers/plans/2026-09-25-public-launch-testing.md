# Тестирование перед публичным открытием — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** До Instagram-запуска найти и закрыть то, что сломается у сотен новичков в первый вечер, и оставить в репо повторяемый набор проверок.

**Architecture:** Всё гоняется локально на прод-сборке: `node backend/server.mjs` с `SERVE_STATIC=1` на временной БД, Resend подменён локальной заглушкой (`RESEND_API_URL`). Поверх — Playwright (эмуляция iPhone/WebKit и Android/Chromium) для пользовательских путей, обхода тем и хаос-сценариев; отдельный Node-скрипт без зависимостей для всплеска регистраций по API. Находки копятся в одном отчёте.

**Tech Stack:** Node 22 (`node:test`, `node:http`, `node:sqlite`), `@playwright/test`, Vite-сборка, существующий backend.

**Spec:** `docs/superpowers/specs/2026-09-25-public-launch-testing-design.md`

## Global Constraints

- Прод (`app.mironium.com`) и прод-БД в этом плане **не трогаются**. Ни одна команда не ходит на прод, кроме финальной проверки `/api/version` после деплоя.
- Реальные письма не отправляются: во всех прогонах `RESEND_API_URL` указывает на заглушку.
- Тестовые данные — только во временной папке (`os.tmpdir()`), удаляются после прогона.
- Каждый push в `main` с изменением кода приложения — отдельным коммитом bump версии `package.json` (правило CLAUDE.md), и только с явного «да» владельца на этот деплой.
- Playwright по умолчанию **headed** (владелец хочет видеть прогон); `HEADLESS=1` включает headless.
- Drag-and-drop проверяется **touch-событиями** (CDP `Input.dispatchTouchEvent`), не мышью.
- Коммитить сразу после каждой задачи: в репо периодически бывает внешний `git reset --hard`. Коммитить **только свои файлы**, явным списком путей — в рабочей копии много чужих незакоммиченных правок.
- В `reportError`/`trackEvent` не попадает PII (email, имена, токены) — правило `backend/lib/observability.mjs`.
- Порты прогона фиксированы: приложение `4310`, заглушка почты `4311`.
- Нагрузочный порог: p95 любого пользовательского эндпоинта ≤ 1000 мс локально на ступени 300; ноль 5xx.

## Review Focus

1. **Письмо не ушло (429/5xx от Resend)** — владелец должен получить сигнал в канал ошибок, а в сигнале не должно быть email адресата. → тест в Task 1 (`email-failure.test.mjs`, проверка отсутствия `@` в payload).
2. **Двойной клик «Создать аккаунт» / повторная регистрация того же email** — ровно один аккаунт, второй ответ 409, пользователь видит понятный текст. → Task 3, `auth-negative.spec.mjs`.
3. **Переход по ссылке подтверждения второй раз** (люди кликают дважды, почтовые клиенты префетчат ссылки) — второй переход не должен оставлять человека в тупике. → Task 3, `auth-negative.spec.mjs`.
4. **Всплеск из-за одного IP** (CGNAT) — 11-я регистрация за час с одного IP получает 429; фиксируем, что именно видит пользователь. → Task 4, отдельная ступень `same-ip`.
5. **Новичок нажал «Без аккаунта (локальный режим)»** и позанимался — прогресс не должен тихо пропасть без предупреждения при последующей регистрации. → Task 6, `chaos.spec.mjs` сценарий `local-mode-then-register` (фиксирует факт, не чинит).

---

## Task 0: Действия владельца (не код)

Выполняет владелец; исполнитель плана только напоминает и проверяет результат.

- [ ] **F1.** Resend dashboard → перейти на платный план (Pro). Проверить, что домен `mironium.com` verified. Исполнитель после этого сверяет лимиты на странице плана и записывает их в отчёт (Task 7).
- [ ] **F4.** Railway → сервис `mirocard-backend` → Variables: есть ли `ERROR_REPORTING_WEBHOOK_URL`. Исполнитель смотрит **только имя переменной**, значение не выводит. Если нет — решение с владельцем, куда слать (Telegram-бот из `feedback-bot/` через маленький relay — отдельная задача, вне этого плана). Если есть — после деплоя Task 1 вызвать тестовую ошибку и убедиться, что сообщение дошло.

---

## Task 1: Ошибки отправки писем видны + адрес Resend из env

**Files:**
- Modify: `backend/lib/config.mjs` (рядом с `RESEND_API_KEY`, ~строка 62)
- Modify: `backend/lib/mailer.mjs:1-28`
- Modify: `backend/server.mjs` (строки с `.catch(console.error)` у `send*Email`: ~279, ~342, ~410, ~1074)
- Test: `backend/tests/email-failure.test.mjs`

**Interfaces:**
- Produces: env `RESEND_API_URL` (по умолчанию `https://api.resend.com/emails`); ошибка из `sendEmail` несёт `err.resendStatus` (number); событие `trackEvent("email_send_failed", { kind, status })`; `reportError(err, { scope: "email", kind, status })`, где `kind ∈ {"verification","password_reset","promo_grant"}`.

- [ ] **Step 1: Написать падающий тест**

`backend/tests/email-failure.test.mjs`:

```js
// Resend отвечает 429 → сервер обязан сообщить об этом в канал ошибок
// (ERROR_REPORTING_WEBHOOK_URL), без email адресата в payload.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

function listen(handler) {
  const srv = createServer(handler);
  return new Promise((resolve) => srv.listen(0, "127.0.0.1", () => resolve(srv)));
}
const urlOf = (srv, p = "") => `http://127.0.0.1:${srv.address().port}${p}`;

const resendCalls = [];
const fakeResend = await listen((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c)).on("end", () => {
    resendCalls.push(JSON.parse(body));
    res.writeHead(429, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ message: `rate limited for ${JSON.parse(body).to}` }));
  });
});

const reports = [];
const errorSink = await listen((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c)).on("end", () => {
    reports.push(body);
    res.end("ok");
  });
});

const dataDir = mkdtempSync(path.join(tmpdir(), "mirocard-email-fail-data-"));
const frontendDir = mkdtempSync(path.join(tmpdir(), "mirocard-email-fail-dist-"));
mkdirSync(path.join(frontendDir, "decks"), { recursive: true });
writeFileSync(path.join(frontendDir, "index.html"), "<html></html>");
writeFileSync(path.join(frontendDir, "decks", "catalog.json"), JSON.stringify({ decks: [] }));

process.env.MIROCARD_DATA_DIR = dataDir;
process.env.MIROCARD_DEPLOY_FRONTEND_DIR = frontendDir;
process.env.SERVE_STATIC = "1";
process.env.AUTH_SECRET = "test-auth-secret";
process.env.ACCOUNT_SECRET = "test-account-secret";
process.env.RESEND_API_KEY = "test-resend-key";
process.env.RESEND_API_URL = urlOf(fakeResend, "/emails");
process.env.ERROR_REPORTING_WEBHOOK_URL = urlOf(errorSink, "/report");

const { router } = await import("../server.mjs");
const app = await listen(router);
test.after(() => { app.close(); fakeResend.close(); errorSink.close(); });

async function waitFor(pred, ms = 3000) {
  const until = Date.now() + ms;
  while (Date.now() < until) { if (pred()) return; await new Promise((r) => setTimeout(r, 25)); }
  throw new Error("condition not met in time");
}

test("verification email failure reaches the error webhook without PII", async () => {
  const email = "email-fail@example.test";
  const res = await fetch(urlOf(app, "/api/auth/register"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "correct horse battery", firstName: "T", role: "parent", referralSource: "other", consentPersonalData: true }),
  });
  assert.equal(res.status, 201);
  await waitFor(() => resendCalls.length === 1 && reports.length >= 1);

  assert.equal(resendCalls[0].to, email, "request went to RESEND_API_URL");
  const report = JSON.parse(reports[0]);
  assert.equal(report.context.scope, "email");
  assert.equal(report.context.kind, "verification");
  assert.equal(report.context.status, 429);
  assert.ok(!reports[0].includes("@"), "no email address in the error report");
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `cd backend && node --test tests/email-failure.test.mjs`
Expected: FAIL — запрос уходит на настоящий `api.resend.com` (или таймаут `waitFor`), `resendCalls.length === 0`.

- [ ] **Step 3: Реализация**

`backend/lib/config.mjs`, сразу после строки с `RESEND_API_KEY`:

```js
// Overridable only so test runs can point at a local fake (scripts/test-env/fake-resend.mjs).
export const RESEND_API_URL = readEnv("RESEND_API_URL") || "https://api.resend.com/emails";
```

`backend/lib/mailer.mjs` — импорт и `sendEmail`:

```js
import { RESEND_API_KEY, RESEND_API_URL, SMTP_FROM, APP_BASE_URL, LEGAL_DOCS_VERSION } from "./config.mjs";
```

```js
  const res = await fetch(RESEND_API_URL, {
```

и вместо `throw new Error(...)` в конце `if (!res.ok)`:

```js
    const body = await res.text().catch(() => "");
    const err = new Error(`Resend API error ${res.status}: ${body.slice(0, 200)}`);
    err.resendStatus = res.status;
    throw err;
```

`backend/server.mjs` — рядом с `rateLimited` добавить:

```js
// Email is the only way into a new account (login is blocked until the
// address is verified), so a failed send must be visible, not just logged.
// The Resend error message can echo the recipient, so it is not forwarded.
function reportEmailFailure(kind, err) {
  const status = err?.resendStatus ?? null;
  console.error(err);
  reportError(new Error(`email send failed (${kind}, status ${status ?? "network"})`), { scope: "email", kind, status });
  trackEvent("email_send_failed", { kind, status });
}
```

Заменить четыре call site:

```js
  sendEmailVerificationEmail(account.email, rawToken).catch((err) => reportEmailFailure("verification", err));
```
```js
    sendPasswordResetEmail(account.email, rawToken).catch((err) => reportEmailFailure("password_reset", err));
```
```js
    sendEmailVerificationEmail(account.email, rawToken).catch((err) => reportEmailFailure("verification", err));
```
```js
    sendPromoGrantEmail(account.email, { code: String(body.code).trim().toUpperCase(), endsAt: sub?.currentPeriodEnd }).catch((err) => reportEmailFailure("promo_grant", err));
```

Проверить, что других `send*Email(...).catch(console.error)` не осталось: `grep -rn "Email(.*catch(console.error)" backend --include=*.mjs` — пусто (если найдутся в других файлах, например напоминаниях — заменить тем же способом, с соответствующим `kind`).

- [ ] **Step 4: Прогнать тест и весь backend-набор**

Run: `cd backend && node --test tests/email-failure.test.mjs` → PASS
Run: `cd backend && npm test` → все PASS (было 175 + 1 новый)

- [ ] **Step 5: Коммит**

```bash
git add backend/lib/config.mjs backend/lib/mailer.mjs backend/server.mjs backend/tests/email-failure.test.mjs
git commit -m "fix(backend): report failed email sends to the error channel; RESEND_API_URL override for tests"
```

(Деплой — не здесь; см. Task 7, шаг деплоя, с согласия владельца.)

---

## Task 2: Тестовое окружение — заглушка почты + прод-подобный сервер

**Files:**
- Create: `scripts/test-env/fake-resend.mjs`
- Create: `scripts/test-env/run-prod-like.mjs`
- Create: `tests/harness/test-env.test.mjs`
- Modify: `vite.config.js` (vitest `exclude`: добавить `"tests/**"`)
- Modify: `package.json` (scripts)

**Interfaces:**
- Produces:
  - `createFakeResend({ port, failAfter = Infinity, failStatus = 429 }) → Promise<{ url, messages, close() }>`; HTTP: `POST /emails` (Resend-совместимо), `GET /messages?to=<email>` → JSON-массив `{ to, subject, text, html, at }`, `POST /config` `{ failAfter, failStatus }`, `POST /reset`.
  - `extractLink(message, path) → string | null` — первая ссылка из `text`, содержащая `path` (`"/verify-email"` или `"/reset"`).
  - `run-prod-like.mjs`: процесс, поднимающий заглушку на `4311` и `node backend/server.mjs` на `4310`; `APP_BASE_URL=http://127.0.0.1:4310`; при выходе удаляет временную папку данных. Флаги: `--app-port`, `--mail-port`, `--build` (сначала `npm run build`, если нет `dist/index.html` — всегда).
  - npm: `test:env` (запуск окружения), `test:harness`.

- [ ] **Step 1: Падающий тест окружения**

`tests/harness/test-env.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const APP = "http://127.0.0.1:4320";
const MAIL = "http://127.0.0.1:4321";

async function waitUp(url, ms = 60000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    try { const r = await fetch(url); if (r.ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`${url} did not come up`);
}

const proc = spawn(process.execPath, ["scripts/test-env/run-prod-like.mjs", "--app-port", "4320", "--mail-port", "4321"], { stdio: "inherit" });
test.after(() => proc.kill());

test("prod-like env: SPA served, register → verification mail captured → verify → token", async () => {
  await waitUp(`${APP}/api/healthz`);
  const html = await (await fetch(`${APP}/`)).text();
  assert.match(html, /<div id="root"/);

  const email = "harness@example.test";
  const reg = await fetch(`${APP}/api/auth/register`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "correct horse battery", firstName: "H", role: "parent", referralSource: "other", consentPersonalData: true }),
  });
  assert.equal(reg.status, 201);

  let msgs = [];
  for (let i = 0; i < 30 && msgs.length === 0; i++) {
    msgs = await (await fetch(`${MAIL}/messages?to=${encodeURIComponent(email)}`)).json();
    if (!msgs.length) await new Promise((r) => setTimeout(r, 100));
  }
  assert.equal(msgs.length, 1);
  const link = new URL(msgs[0].text.match(/https?:\/\/\S+\/verify-email\?token=\S+/)[0]);
  assert.equal(link.origin, APP, "link points at the test app, not production");

  const ver = await fetch(`${APP}/api/auth/verify-email?token=${link.searchParams.get("token")}`);
  assert.equal(ver.status, 200);
  assert.ok((await ver.json()).token);
});
```

Проверить, что `index.html` действительно содержит `<div id="root"` (`grep -n 'id="root"' index.html`); если корневой элемент другой — поправить регэксп под него.

- [ ] **Step 2: Убедиться, что падает**

Run: `node --test tests/harness/test-env.test.mjs`
Expected: FAIL — `Cannot find module scripts/test-env/run-prod-like.mjs`.

- [ ] **Step 3: Заглушка почты**

`scripts/test-env/fake-resend.mjs`:

```js
// Local stand-in for https://api.resend.com/emails used by test runs only.
// Stores every message in memory; GET /messages?to= lets tests read the
// verification/reset links. failAfter/failStatus simulate Resend's quota.
import { createServer } from "node:http";

export function extractLink(message, pathPart) {
  const m = String(message?.text || "").match(/https?:\/\/\S+/g) || [];
  return m.find((u) => u.includes(pathPart)) ?? null;
}

export function createFakeResend({ port = 0, failAfter = Infinity, failStatus = 429 } = {}) {
  const messages = [];
  const cfg = { failAfter, failStatus, accepted: 0 };

  const readBody = (req) => new Promise((resolve) => {
    let b = ""; req.on("data", (c) => (b += c)).on("end", () => resolve(b));
  });
  const json = (res, status, obj) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(obj));
  };

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, "http://x");
    if (req.method === "POST" && url.pathname === "/emails") {
      const body = JSON.parse((await readBody(req)) || "{}");
      if (cfg.accepted >= cfg.failAfter) return json(res, cfg.failStatus, { name: "rate_limit_exceeded", message: "fake quota exhausted" });
      cfg.accepted++;
      messages.push({ to: body.to, subject: body.subject, text: body.text, html: body.html, at: new Date().toISOString() });
      return json(res, 200, { id: `fake_${messages.length}` });
    }
    if (req.method === "GET" && url.pathname === "/messages") {
      const to = url.searchParams.get("to");
      return json(res, 200, to ? messages.filter((m) => m.to === to) : messages);
    }
    if (req.method === "POST" && url.pathname === "/config") {
      const body = JSON.parse((await readBody(req)) || "{}");
      if ("failAfter" in body) cfg.failAfter = body.failAfter ?? Infinity;
      if ("failStatus" in body) cfg.failStatus = body.failStatus;
      return json(res, 200, { ok: true });
    }
    if (req.method === "POST" && url.pathname === "/reset") {
      messages.length = 0; cfg.accepted = 0; cfg.failAfter = Infinity;
      return json(res, 200, { ok: true });
    }
    json(res, 404, { error: "not found" });
  });

  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => {
    const url = `http://127.0.0.1:${server.address().port}`;
    resolve({ url, messages, close: () => new Promise((r) => server.close(r)) });
  }));
}
```

- [ ] **Step 4: Прод-подобный сервер**

`scripts/test-env/run-prod-like.mjs`:

```js
// Starts the production build exactly the way Railway runs it
// (node backend/server.mjs, SERVE_STATIC=1) on a throwaway database,
// with email going to the local fake instead of Resend.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";
import { createFakeResend } from "./fake-resend.mjs";

const { values } = parseArgs({ options: {
  "app-port": { type: "string", default: "4310" },
  "mail-port": { type: "string", default: "4311" },
  build: { type: "boolean", default: false },
} });

if (values.build || !existsSync("dist/index.html")) {
  const r = spawnSync("npm", ["run", "build"], { stdio: "inherit", shell: true });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

const mail = await createFakeResend({ port: Number(values["mail-port"]) });
const dataDir = mkdtempSync(path.join(tmpdir(), "mirocard-prodlike-"));
const appUrl = `http://127.0.0.1:${values["app-port"]}`;

const app = spawn(process.execPath, ["backend/server.mjs"], {
  stdio: "inherit",
  env: {
    ...process.env,
    PORT: values["app-port"],
    SERVE_STATIC: "1",
    MIROCARD_DATA_DIR: dataDir,
    APP_BASE_URL: appUrl,
    CORS_ALLOWED_ORIGINS: appUrl,
    RESEND_API_KEY: "test-resend-key",
    RESEND_API_URL: `${mail.url}/emails`,
    AUTH_SECRET: "test-auth-secret",
    ACCOUNT_SECRET: "test-account-secret",
    MIROCARD_ADMIN_TOKEN: "test-admin-token",
    RAILWAY_ENVIRONMENT: "",
    ERROR_REPORTING_WEBHOOK_URL: "",
    ANALYTICS_WEBHOOK_URL: "",
  },
});
console.log(`[test-env] app ${appUrl}  mail ${mail.url}  data ${dataDir}`);

let stopping = false;
async function stop(code = 0) {
  if (stopping) return; stopping = true;
  app.kill();
  await mail.close();
  rmSync(dataDir, { recursive: true, force: true });
  process.exit(code);
}
app.on("exit", (c) => stop(c ?? 0));
process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
```

Замечание для исполнителя: на Windows `proc.kill()` из теста шлёт завершение без SIGTERM-обработчика — временная папка может остаться. Это допустимо (она в `tmpdir`), но в конце Task 7 проверить `ls $TMP | grep mirocard-prodlike` и удалить остатки.

- [ ] **Step 5: vitest не должен подхватывать `tests/`**

`vite.config.js`, массив `test.exclude` — добавить `"tests/**"`:

```js
      "backend/**", "tools/**", "tests/**", ".worktrees/**", ".claude/worktrees/**", ".pytest_cache/**",
```

`package.json` → `scripts`:

```json
    "test:env": "node scripts/test-env/run-prod-like.mjs",
    "test:harness": "node --test tests/harness/*.test.mjs",
```

- [ ] **Step 6: Прогнать**

Run: `npm run test:harness`
Expected: PASS (первый раз дольше — `npm run build`, если `dist/` нет).

- [ ] **Step 7: Коммит**

```bash
git add scripts/test-env/fake-resend.mjs scripts/test-env/run-prod-like.mjs tests/harness/test-env.test.mjs vite.config.js package.json
git commit -m "test: prod-like local environment with fake Resend for launch testing"
```

---

## Task 3: Playwright + Блок 1a (путь новичка в браузере)

**Files:**
- Modify: `package.json` (devDependency `@playwright/test`, scripts)
- Create: `tests/e2e/playwright.config.mjs`
- Create: `tests/e2e/helpers.mjs`
- Create: `tests/e2e/newcomer.spec.mjs`
- Create: `tests/e2e/auth-negative.spec.mjs`
- Create: `docs/testing/launch-readiness-report.md` (заготовка таблицы находок)

**Interfaces:**
- Consumes: Task 2 — окружение на `4310/4311`, `GET /messages?to=`, `POST /config`, `POST /reset`.
- Produces (`tests/e2e/helpers.mjs`):
  - `APP = "http://127.0.0.1:4310"`, `MAIL = "http://127.0.0.1:4311"`
  - `uniqueEmail(tag) → string` (`<tag>-<timestamp>-<rand>@example.test`)
  - `waitForMail(email, { pathPart, timeoutMs = 10000 }) → Promise<string>` — ссылка из последнего письма
  - `registerViaUi(page, { email, password, firstName, role = "parent" })`
  - `createVerifiedAccountViaApi({ email, password }) → Promise<{ token }>`
  - `loginViaUi(page, { email, password })`
  - `collectPageErrors(page) → { errors: string[] }` — подписка на `pageerror`, `console` (type `error`) и ответы `>= 500`

- [ ] **Step 1: Установить Playwright**

```bash
npm install --save-dev @playwright/test
npx playwright install chromium webkit
```

`package.json` → `scripts`:

```json
    "test:e2e": "playwright test -c tests/e2e/playwright.config.mjs",
```

- [ ] **Step 2: Конфиг**

`tests/e2e/playwright.config.mjs`:

```js
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["html", { outputFolder: "../../output/e2e-report", open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:4310",
    headless: process.env.HEADLESS === "1",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: "node scripts/test-env/run-prod-like.mjs",
    cwd: "../..",
    url: "http://127.0.0.1:4310/api/healthz",
    reuseExistingServer: true,
    timeout: 180_000,
  },
  projects: [
    { name: "iphone", use: { ...devices["iPhone 13"] } },
    { name: "android", use: { ...devices["Pixel 7"] } },
  ],
});
```

`output/` уже в корне репо и не коммитится — проверить `git check-ignore output/e2e-report`; если не игнорируется — добавить `output/e2e-report/` в `.gitignore` в этом же коммите.

- [ ] **Step 3: Хелперы**

`tests/e2e/helpers.mjs`:

```js
import { expect } from "@playwright/test";

export const APP = "http://127.0.0.1:4310";
export const MAIL = "http://127.0.0.1:4311";
export const PASSWORD = "correct horse battery";

export function uniqueEmail(tag) {
  return `${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.test`;
}

export async function waitForMail(email, { pathPart = "/verify-email", timeoutMs = 10_000 } = {}) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    const msgs = await (await fetch(`${MAIL}/messages?to=${encodeURIComponent(email)}`)).json();
    const link = msgs.map((m) => (m.text.match(/https?:\/\/\S+/g) || []).find((u) => u.includes(pathPart))).filter(Boolean).at(-1);
    if (link) return link;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`no ${pathPart} mail for ${email}`);
}

export async function registerViaUi(page, { email, password = PASSWORD, firstName = "Тест", role = "parent" }) {
  await page.goto("/");
  // Стартовый экран — логин; ссылка на регистрацию внизу.
  await page.getByRole("button", { name: /регистр|создать аккаунт/i }).first().click();
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Имя *").fill(firstName);
  await page.locator("select").nth(0).selectOption(role);
  await page.locator("select").nth(1).selectOption("other");
  await page.getByPlaceholder("Пароль (минимум 8 символов) *").fill(password);
  await page.locator(".auth-consent input[type=checkbox]").check();
  await page.getByRole("button", { name: "Создать аккаунт" }).click();
}

export async function createVerifiedAccountViaApi({ email, password = PASSWORD }) {
  const reg = await fetch(`${APP}/api/auth/register`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, firstName: "Тест", role: "parent", referralSource: "other", consentPersonalData: true }),
  });
  if (reg.status !== 201) throw new Error(`register ${reg.status}`);
  const link = new URL(await waitForMail(email));
  const ver = await fetch(`${APP}/api/auth/verify-email?token=${link.searchParams.get("token")}`);
  return { token: (await ver.json()).token };
}

export async function loginViaUi(page, { email, password = PASSWORD }) {
  await page.goto("/");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Пароль").fill(password);
  await page.getByRole("button", { name: /^войти$/i }).click();
}

export function collectPageErrors(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text()}`); });
  page.on("response", (r) => { if (r.status() >= 500) errors.push(`HTTP ${r.status()} ${r.url()}`); });
  return { errors };
}

export async function expectNoPageErrors(sink) {
  expect(sink.errors, sink.errors.join("\n")).toEqual([]);
}
```

Селекторы кнопок «регистрация»/«войти» сверить с `src/features/account/LoginScreen.jsx:158-193` (тексты кнопок) при первом запуске; если текст другой — поправить регэксп здесь, в одном месте.

- [ ] **Step 4: Спека пути новичка (сначала падает — нет экранов после входа в селекторах)**

`tests/e2e/newcomer.spec.mjs`:

```js
import { test, expect } from "@playwright/test";
import { uniqueEmail, waitForMail, registerViaUi, loginViaUi, collectPageErrors, expectNoPageErrors, PASSWORD } from "./helpers.mjs";

test("новичок: регистрация → письмо → подтверждение → внутри → занятие → повторный вход", async ({ page }) => {
  const sink = collectPageErrors(page);
  const email = uniqueEmail("newcomer");

  await registerViaUi(page, { email });
  await expect(page.getByText(/проверьте почту|письмо/i).first()).toBeVisible();

  // «Отправить повторно» работает и не ломает экран
  await page.getByRole("button", { name: "Отправить повторно" }).click();
  await expect(page.getByRole("button", { name: /Письмо отправлено|Отправляем/ })).toBeVisible();

  const link = await waitForMail(email);
  await page.goto(new URL(link).pathname + new URL(link).search);

  // После подтверждения человек внутри приложения (главный экран)
  await expect(page.locator(".home-header")).toBeVisible({ timeout: 20_000 });
  await page.screenshot({ path: `output/e2e-report/newcomer-home-${test.info().project.name}.png`, fullPage: true });

  // Первая тема: открыть любую доступную карточку темы и запустить занятие
  await page.locator("[class*=topic]").first().click();
  await page.getByRole("button", { name: /начать|старт|поехали/i }).first().click();
  await expect(page.locator(".session-topbar")).toBeVisible({ timeout: 20_000 });

  // Выход и повторный вход тем же паролем
  await page.context().clearCookies();
  await page.evaluate(() => { localStorage.clear(); indexedDB.databases?.().then((dbs) => dbs.forEach((d) => indexedDB.deleteDatabase(d.name))); });
  await loginViaUi(page, { email, password: PASSWORD });
  await expect(page.locator(".home-header")).toBeVisible({ timeout: 20_000 });

  await expectNoPageErrors(sink);
});
```

Run: `npm run test:e2e -- newcomer.spec.mjs --project=android`
Expected при первом прогоне: скорее всего FAIL на селекторах главного экрана / карточки темы / кнопки старта — **это ожидаемо**: открыть trace (`npx playwright show-trace output/...`), взять реальные классы/тексты и зафиксировать их. Правило для селекторов: предпочитать видимый текст и роль; классы — только существующие стабильные (`.home-header`, `.session-topbar` — описаны в CLAUDE.md как общие). Не добавлять `data-testid` в код приложения в рамках этого плана.

- [ ] **Step 5: Довести спеку до зелёного на обоих проектах**

Run: `npm run test:e2e -- newcomer.spec.mjs`
Expected: PASS на `iphone` и `android`. Если падение — реальный баг, а не селектор: **не чинить в этой задаче**, записать находку в `docs/testing/launch-readiness-report.md` (формат ниже), пометить тест `test.fixme(...)` с номером находки, и сообщить владельцу сразу.

Заготовка `docs/testing/launch-readiness-report.md`:

```markdown
# Готовность к публичному открытию — отчёт

Спека: `docs/superpowers/specs/2026-09-25-public-launch-testing-design.md`

## Находки

| # | Серьёзность | Где | Симптом | Как воспроизвести | Кого бьёт в первый вечер | Исправление | Статус |
|---|---|---|---|---|---|---|---|
| N1 | Важно | Регистрация | В «Как узнали о Mironium?» нет варианта Instagram — весь промо-трафик попадёт в «Другое», эффект кампании не измерить | Открыть регистрацию | Владельца (аналитика) | Добавить `instagram` в варианты (frontend + `handleRegister` allowlist) | открыто |

Серьёзность: **Блокер** — новичок не может попасть внутрь / теряет данные / видит белый экран. **Важно** — заметно мешает, есть обход. **Мелочь** — косметика.

## Замеры нагрузки

(заполняется в Task 4)

## Лимиты Resend после перехода на платный план

(заполняется после Task 0/F1)
```

- [ ] **Step 6: Негативные ветки авторизации**

`tests/e2e/auth-negative.spec.mjs`:

```js
import { test, expect } from "@playwright/test";
import { APP, uniqueEmail, waitForMail, registerViaUi, loginViaUi, createVerifiedAccountViaApi, collectPageErrors, expectNoPageErrors, PASSWORD } from "./helpers.mjs";

test("двойной клик «Создать аккаунт» создаёт ровно один аккаунт и одно письмо", async ({ page }) => {
  const email = uniqueEmail("dblclick");
  await registerViaUi(page, { email }).catch(() => {});
  await page.getByRole("button", { name: /Создать аккаунт|Создаём/ }).click({ clickCount: 2, force: true }).catch(() => {});
  await page.waitForTimeout(1500);
  const msgs = await (await fetch(`http://127.0.0.1:4311/messages?to=${encodeURIComponent(email)}`)).json();
  expect(msgs.length).toBe(1);
});

test("повторная регистрация того же email: понятное сообщение, не белый экран", async ({ page }) => {
  const sink = collectPageErrors(page);
  const email = uniqueEmail("dup");
  await createVerifiedAccountViaApi({ email });
  await registerViaUi(page, { email });
  await expect(page.getByText(/уже зарегистрирован|already registered/i)).toBeVisible();
  sink.errors = sink.errors.filter((e) => !e.includes("409"));
  await expectNoPageErrors(sink);
});

test("логин до подтверждения email: объясняет, что делать", async ({ page }) => {
  const email = uniqueEmail("unverified");
  await registerViaUi(page, { email });
  await loginViaUi(page, { email });
  await expect(page.getByText(/подтверд/i).first()).toBeVisible();
});

test("ссылка подтверждения, открытая второй раз, не оставляет в тупике", async ({ page }) => {
  const email = uniqueEmail("twice");
  await registerViaUi(page, { email });
  const link = new URL(await waitForMail(email));
  // Первый переход «съедает» токен (как префетч почтового клиента)
  await fetch(`${APP}/api/auth/verify-email?token=${link.searchParams.get("token")}`);
  await page.goto(link.pathname + link.search);
  // Ожидание: либо человек уже внутри, либо видит понятный путь «войти»
  await expect(page.getByText(/войти|вход|недействительн|истек/i).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: /войти/i }).first()).toBeVisible();
});

test("неверный пароль: сообщение об ошибке, не зависание", async ({ page }) => {
  const email = uniqueEmail("wrongpw");
  await createVerifiedAccountViaApi({ email });
  await loginViaUi(page, { email, password: "definitely wrong" });
  await expect(page.getByText(/невер|incorrect|invalid/i).first()).toBeVisible();
});

test("забыл пароль → письмо → новый пароль → вход", async ({ page }) => {
  const email = uniqueEmail("forgot");
  await createVerifiedAccountViaApi({ email });
  await page.goto("/");
  await page.getByRole("button", { name: /забыли пароль|забыл/i }).click();
  await page.getByPlaceholder("Email").fill(email);
  await page.getByRole("button", { name: /отправ|восстанов|сброс/i }).first().click();
  const link = new URL(await waitForMail(email, { pathPart: "/reset" }));
  await page.goto(link.pathname + link.search);
  await page.locator("input[type=password]").first().fill("brand new password 1");
  await page.locator("input[type=password]").nth(1).fill("brand new password 1").catch(() => {});
  await page.getByRole("button", { name: /сохран|сменить|установ/i }).first().click();
  await loginViaUi(page, { email, password: "brand new password 1" });
  await expect(page.locator(".home-header")).toBeVisible({ timeout: 20_000 });
});
```

Run: `npm run test:e2e -- auth-negative.spec.mjs`
Expected: PASS или зафиксированные находки (порядок как в Step 5). Особое внимание: тест «второй раз» — ответ сервера на повторный токен `400 invalid_or_expired_token`; проверить глазами, что `VerifyEmailScreen` показывает человеку выход, а не пустой экран.

- [ ] **Step 7: Коммит**

```bash
git add package.json package-lock.json tests/e2e/playwright.config.mjs tests/e2e/helpers.mjs tests/e2e/newcomer.spec.mjs tests/e2e/auth-negative.spec.mjs docs/testing/launch-readiness-report.md
git commit -m "test(e2e): newcomer signup journey and auth edge cases on iPhone/Android emulation"
```

Сразу после коммита — короткое сообщение владельцу с находками блока 1a (не ждать конца плана).

---

## Task 4: Блок 1b — всплеск регистраций + замеры scrypt и бэкапа

**Files:**
- Create: `scripts/load/signup-burst.mjs`
- Create: `scripts/load/microbench.mjs`
- Modify: `package.json` (scripts `test:load`, `test:microbench`)
- Modify: `docs/testing/launch-readiness-report.md` (раздел «Замеры нагрузки»)

**Interfaces:**
- Consumes: Task 2 окружение (`npm run test:env` в отдельном терминале), `POST /config` у заглушки.
- Produces: `node scripts/load/signup-burst.mjs --stages 50,150,300 --window-sec 60 [--same-ip] [--mail-fail-after N]` → печатает JSON-сводку `{ stage, users, ok, errors: {status: count}, latency: {endpoint: {p50,p95,max}}, bgLatency: {p50,p95,max}, mailsCaptured }` и exit code 1 при нарушении порогов (5xx > 0, p95 > 1000 мс, ошибка у фонового пользователя).

- [ ] **Step 1: Скрипт всплеска**

`scripts/load/signup-burst.mjs`:

```js
// Signup-burst load test against the local prod-like env (npm run test:env).
// Each virtual newcomer: register → verify (link from the fake mailbox) →
// bootstrap → catalog → claim + download one deck → sync a student →
// append a session. Meanwhile "already active" users hit bootstrap every
// second: their latency is what shows event-loop stalls (scryptSync, backup).
import { parseArgs } from "node:util";
import { randomUUID } from "node:crypto";

const { values } = parseArgs({ options: {
  app: { type: "string", default: "http://127.0.0.1:4310" },
  mail: { type: "string", default: "http://127.0.0.1:4311" },
  stages: { type: "string", default: "50,150,300" },
  "window-sec": { type: "string", default: "60" },
  "same-ip": { type: "boolean", default: false },
  "mail-fail-after": { type: "string" },
  "bg-users": { type: "string", default: "5" },
} });
const APP = values.app, MAIL = values.mail;
const P95_LIMIT_MS = 1000;

const samples = {};           // endpoint -> [ms]
const errors = {};            // "endpoint status" -> count
const bgSamples = [];
let bgErrors = 0;

function pct(arr, p) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  return Math.round(s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]);
}

async function call(name, method, path, { token, body, ip } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (ip) headers["X-Forwarded-For"] = ip;
  const t0 = performance.now();
  let res;
  try {
    res = await fetch(`${APP}/api${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch (e) {
    errors[`${name} network`] = (errors[`${name} network`] || 0) + 1;
    return null;
  }
  const ms = performance.now() - t0;
  (samples[name] ||= []).push(ms);
  if (!res.ok) errors[`${name} ${res.status}`] = (errors[`${name} ${res.status}`] || 0) + 1;
  return res;
}

async function mailLink(email) {
  for (let i = 0; i < 50; i++) {
    const msgs = await (await fetch(`${MAIL}/messages?to=${encodeURIComponent(email)}`)).json();
    const m = msgs.at(-1)?.text.match(/verify-email\?token=([\w-]+)/);
    if (m) return m[1];
    await new Promise((r) => setTimeout(r, 200));
  }
  return null;
}

let deckId = null;

async function newcomer(i, stage) {
  const email = `load-${stage}-${i}-${Date.now()}@example.test`;
  const ip = values["same-ip"] ? "10.0.0.1" : `10.${stage % 250}.${Math.floor(i / 250)}.${i % 250}`;
  const reg = await call("register", "POST", "/auth/register", { ip, body: { email, password: "correct horse battery", firstName: "Load", role: i % 3 ? "parent" : "specialist", referralSource: "other", consentPersonalData: true } });
  if (reg?.status !== 201) return;
  const vtoken = await mailLink(email);
  if (!vtoken) { errors["mail missing"] = (errors["mail missing"] || 0) + 1; return; }
  const ver = await call("verify-email", "GET", `/auth/verify-email?token=${vtoken}`, { ip });
  if (!ver?.ok) return;
  const { token } = await ver.json();
  await call("bootstrap", "GET", "/account/bootstrap", { token, ip });
  const cat = await call("decks/catalog", "GET", "/decks/catalog", { token, ip });
  if (cat?.ok && !deckId) deckId = (await cat.json()).decks?.[0]?.id ?? null;
  if (deckId) {
    await call("decks/claim", "POST", `/decks/${deckId}/claim`, { token, ip, body: {} });
    const dl = await call("decks/download", "GET", `/decks/${deckId}/download`, { token, ip });
    if (dl?.ok) await dl.arrayBuffer();
  }
  const studentId = randomUUID();
  await call("sync", "POST", "/sync", { token, ip, body: { operations: [{ type: "student.upsert", data: { id: studentId, name: "Ребёнок", comment: "" } }] } });
  await call("sessions", "POST", "/sessions", { token, ip, body: { id: randomUUID(), studentId, topicId: deckId ?? "unknown", startedAt: new Date().toISOString(), result: {} } });
}

async function backgroundUser(stopSignal, idx) {
  const email = `bg-${idx}-${Date.now()}@example.test`;
  await call("register", "POST", "/auth/register", { ip: `10.250.0.${idx}`, body: { email, password: "correct horse battery", firstName: "Bg", role: "parent", referralSource: "other", consentPersonalData: true } });
  const vtoken = await mailLink(email);
  const { token } = await (await fetch(`${APP}/api/auth/verify-email?token=${vtoken}`)).json();
  while (!stopSignal.stop) {
    const t0 = performance.now();
    const r = await fetch(`${APP}/api/account/bootstrap`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null);
    bgSamples.push(performance.now() - t0);
    if (!r?.ok) bgErrors++;
    await new Promise((res) => setTimeout(res, 1000));
  }
}

await fetch(`${MAIL}/reset`, { method: "POST" });
if (values["mail-fail-after"]) {
  await fetch(`${MAIL}/config`, { method: "POST", body: JSON.stringify({ failAfter: Number(values["mail-fail-after"]) }) });
}

const stopSignal = { stop: false };
const bg = Array.from({ length: Number(values["bg-users"]) }, (_, k) => backgroundUser(stopSignal, k + 1));
await new Promise((r) => setTimeout(r, 2000));

const summary = [];
let failed = false;
for (const users of values.stages.split(",").map(Number)) {
  for (const k of Object.keys(samples)) delete samples[k];
  for (const k of Object.keys(errors)) delete errors[k];
  bgSamples.length = 0; bgErrors = 0;
  const windowMs = Number(values["window-sec"]) * 1000;
  const jobs = Array.from({ length: users }, (_, i) =>
    new Promise((r) => setTimeout(r, Math.random() * windowMs)).then(() => newcomer(i, users)));
  await Promise.all(jobs);
  const mails = (await (await fetch(`${MAIL}/messages`)).json()).length;
  const latency = Object.fromEntries(Object.entries(samples).map(([k, v]) => [k, { n: v.length, p50: pct(v, 50), p95: pct(v, 95), max: pct(v, 100) }]));
  const row = { stage: users, errors: { ...errors }, latency, bgLatency: { p50: pct(bgSamples, 50), p95: pct(bgSamples, 95), max: pct(bgSamples, 100) }, bgErrors, mailsCaptured: mails };
  summary.push(row);
  console.log(JSON.stringify(row, null, 2));
  const has5xx = Object.keys(errors).some((k) => / 5\d\d$| network$/.test(k));
  const slow = Object.values(latency).some((l) => l.p95 > P95_LIMIT_MS) || (row.bgLatency.p95 ?? 0) > P95_LIMIT_MS;
  if (has5xx || slow || bgErrors > 0) failed = true;
}
stopSignal.stop = true;
await Promise.all(bg);
console.log(failed ? "RESULT: FAIL (thresholds exceeded — see above)" : "RESULT: PASS");
process.exit(failed ? 1 : 0);
```

Перед запуском проверить тело `POST /sessions` против `handleAppendSession` (`backend/server.mjs:~586`) и `appendSession` в репозитории: если нужны другие обязательные поля — поправить объект в скрипте, чтобы запрос был реалистичным (201, не 400).

- [ ] **Step 2: Микробенчмарк scrypt и бэкапа**

`scripts/load/microbench.mjs`:

```js
// Measures the two synchronous operations that block the whole server:
// password hashing (every register/login) and the hourly SQLite backup.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createPasswordHash } from "../../backend/lib/security.mjs";
import { backupSqlite } from "../backup-sqlite.mjs";
import { initDb } from "../../backend/lib/db.mjs";
import { createAccount } from "../../backend/lib/account-repository.mjs";

const t = (fn) => { const t0 = performance.now(); fn(); return performance.now() - t0; };

const hashes = Array.from({ length: 20 }, () => t(() => createPasswordHash("correct horse battery")));
hashes.sort((a, b) => a - b);
console.log(`scryptSync per call: p50 ${hashes[10].toFixed(1)} ms, max ${hashes[19].toFixed(1)} ms`);
console.log(`→ 300 signups in 60 s = ${(300 * hashes[10] / 1000).toFixed(1)} s of fully blocked event loop`);

const dir = mkdtempSync(path.join(tmpdir(), "mirocard-bench-"));
const dbPath = path.join(dir, "mirocard.db");
const db = initDb(dbPath);
for (const n of [1000, 5000]) {
  const have = db.prepare("SELECT COUNT(*) c FROM accounts").get().c;
  for (let i = have; i < n; i++) createAccount(db, { email: `b${i}-${randomUUID()}@x.test`, passwordHash: "scrypt$x$y", firstName: "B", lastName: "", role: "parent", referralSource: "other", consentPersonalDataAt: new Date().toISOString() });
  const ms = t(() => backupSqlite({ dbPath, outPath: path.join(dir, `b-${n}.db`) }));
  console.log(`backup with ${n} accounts: ${ms.toFixed(0)} ms blocked`);
}
db.close?.();
rmSync(dir, { recursive: true, force: true });
```

Проверить сигнатуры до запуска: `grep -n "export function initDb\|export function backupSqlite\|export function createAccount" backend/lib/db.mjs scripts/backup-sqlite.mjs backend/lib/account-repository.mjs` — если `initDb` принимает не путь, а другое, адаптировать вызов. Цифры 1000/5000 аккаунтов без сессий занижают реальный размер БД — это нижняя оценка; записать это в отчёт.

`package.json` → `scripts`:

```json
    "test:load": "node scripts/load/signup-burst.mjs",
    "test:microbench": "node scripts/load/microbench.mjs",
```

- [ ] **Step 3: Прогоны**

Терминал 1: `npm run test:env`
Терминал 2, по очереди:

```bash
npm run test:microbench
npm run test:load
npm run test:load -- --stages 15 --same-ip
npm run test:load -- --stages 150 --mail-fail-after 100
```

Expected:
- обычный прогон: `RESULT: PASS` или конкретные нарушения порогов;
- `--same-ip`: ровно 10 регистраций ok, остальные `register 429` — **ожидаемое поведение**, фиксируем в отчёте как находку R5 (серьёзность «Важно», если владелец ждёт регистраций из одного центра);
- обычный прогон сам по себе демонстрирует R6: скрипт обходит лимит «10/час на IP» подменой `X-Forwarded-For`. Записать в отчёт как «Мелочь» (для сценария запуска не критично) с пометкой, что на Railway нужно проверить, какой элемент заголовка ставит прокси;
- `--mail-fail-after 100`: `mail missing` ≈ 50 — демонстрация R1 (что было бы на бесплатном Resend), в логе сервера видны `email send failed (verification, status 429)`.

- [ ] **Step 4: Решение по R3/R4 на основе цифр**

Правило: если p95 фоновых пользователей > 1000 мс или scrypt × 300 > 30 с — находка «Блокер/Важно» с предложением перевести `createPasswordHash`/`verifyPasswordHash` на асинхронный `crypto.scrypt` (промис; параметры и формат хеша те же — существующие пароли продолжают работать). Если бэкап на 5000 аккаунтов > 500 мс — находка «Важно». **Исправления — отдельными задачами после согласования с владельцем**, не внутри Task 4.

Записать сводные JSON и выводы в раздел «Замеры нагрузки» отчёта. Результаты локальные: пометить, что Railway-контейнер может быть медленнее (см. метрики CPU Railway в runbook).

- [ ] **Step 5: Коммит**

```bash
git add scripts/load/signup-burst.mjs scripts/load/microbench.mjs package.json docs/testing/launch-readiness-report.md
git commit -m "test(load): signup-burst load script and scrypt/backup microbenchmark with results"
```

Сообщить владельцу цифры и находки блока 1b.

---

## Task 5: Блок 2 — обход всех тем и режимов

**Files:**
- Create: `tests/e2e/topic-crawl.spec.mjs`
- Modify: `docs/testing/launch-readiness-report.md`

**Interfaces:**
- Consumes: `createVerifiedAccountViaApi`, `loginViaUi`, `collectPageErrors` из `tests/e2e/helpers.mjs`; `public/decks/catalog.json` (`decks[].id`, `decks[].title.ru`).
- Produces: по одному Playwright-тесту на колоду (`crawl: <id>`), скриншоты `output/e2e-report/crawl/<project>/<id>-<mode>.png`.

- [ ] **Step 1: Разведка UI выбора темы и режима (один раз, вручную через Playwright)**

Цель — узнать реальные селекторы трёх мест: карточка темы на главном/каталоге, переключатель режима на `ParamsScreen`, кнопка старта занятия. Выполнить:

```bash
npm run test:env
npx playwright codegen --device="Pixel 7" http://127.0.0.1:4310
```

В codegen: зарегистрироваться (ссылку взять `curl "http://127.0.0.1:4311/messages"`), открыть 2–3 разные темы, переключить режим, начать занятие, выйти. Записать найденные локаторы в комментарий в начале `topic-crawl.spec.mjs`. Параллельно прочитать `src/features/session/ParamsScreen.jsx` — как перечисляются режимы (из данных темы, не хардкод) — чтобы обход брал режимы из DOM, а не из списка в тесте.

- [ ] **Step 2: Спека обхода**

`tests/e2e/topic-crawl.spec.mjs` (локаторы `TOPIC_CARD`, `MODE_OPTION`, `START_BUTTON`, `EXIT_BUTTON` заменить на найденные в Step 1 — это единственное место, где они определены):

```js
// Opens every catalog deck × every mode visible on its params screen,
// takes a few "blind" steps (click first enabled choice / type "1"),
// and fails on console errors, 5xx, white screen or a stuck UI.
// Does NOT judge pedagogical correctness — that is the device checklist's job.
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createVerifiedAccountViaApi, loginViaUi, collectPageErrors, uniqueEmail } from "./helpers.mjs";

const catalog = JSON.parse(readFileSync(new URL("../../public/decks/catalog.json", import.meta.url), "utf8"));
const STEPS_PER_MODE = 5;

// Filled in from Step 1 reconnaissance:
const TOPIC_CARD = (title) => `text=${title}`;
const MODE_OPTION = "[role=radio], [role=tab], .params-mode button";
const START_BUTTON = /начать|старт|поехали/i;
const EXIT_BUTTON = /выйти|закрыть|назад|×/i;

async function blindStep(page) {
  const before = await page.evaluate(() => document.body.innerHTML.length + ":" + document.body.innerText.slice(0, 200));
  const clickable = page.locator("main button:enabled, [role=button]:not([aria-disabled=true]), .session-root button:enabled").filter({ hasNotText: EXIT_BUTTON });
  const input = page.locator("input[type=text]:visible, input[type=number]:visible, input:not([type]):visible").first();
  if (await input.count()) await input.fill("1");
  if (await clickable.count()) await clickable.first().click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(800);
  const after = await page.evaluate(() => document.body.innerHTML.length + ":" + document.body.innerText.slice(0, 200));
  return before !== after;
}

let email;
test.beforeAll(async () => {
  email = uniqueEmail("crawl");
  await createVerifiedAccountViaApi({ email });
});

for (const deck of catalog.decks) {
  test(`crawl: ${deck.id}`, async ({ page }, info) => {
    const sink = collectPageErrors(page);
    await loginViaUi(page, { email });
    await expect(page.locator(".home-header")).toBeVisible({ timeout: 20_000 });

    await page.locator(TOPIC_CARD(deck.title.ru)).first().click();
    const modes = page.locator(MODE_OPTION);
    const modeCount = Math.max(1, await modes.count());

    for (let m = 0; m < modeCount; m++) {
      if (await modes.count()) await modes.nth(m).click();
      await page.getByRole("button", { name: START_BUTTON }).first().click();

      // White screen / error boundary
      await expect(page.locator("body")).not.toHaveText(/^\s*$/, { timeout: 15_000 });
      await expect(page.getByText(/что-то пошло не так|something went wrong/i)).toHaveCount(0);

      let stuck = 0;
      for (let s = 0; s < STEPS_PER_MODE; s++) stuck = (await blindStep(page)) ? 0 : stuck + 1;
      await page.screenshot({ path: `output/e2e-report/crawl/${info.project.name}/${deck.id}-${m}.png` });
      expect.soft(stuck, `UI did not change for ${stuck} steps in ${deck.id} mode ${m}`).toBeLessThan(STEPS_PER_MODE);

      await page.getByRole("button", { name: EXIT_BUTTON }).first().click().catch(() => page.goBack());
      await page.locator(TOPIC_CARD(deck.title.ru)).first().click().catch(() => {});
    }
    expect(sink.errors, sink.errors.join("\n")).toEqual([]);
  });
}
```

Замечание: «UI не изменился за 5 слепых шагов» — только **сигнал** для ручного просмотра скриншота (`expect.soft`), не автоматический баг: некоторые режимы ждут конкретного жеста (перетаскивание, рисование). Такие случаи разбирать глазами по скриншоту, и если режим требует touch-жеста — отметить для Task 6 / чеклиста устройств, а не подгонять обход.

- [ ] **Step 3: Прогон**

Run: `npm run test:e2e -- topic-crawl.spec.mjs --project=android` (затем `--project=iphone`)
Expected: список `crawl: <id>` — PASS или падения с trace. Каждое падение по ошибке консоли/5xx/белому экрану/незагрузившемуся ZIP → строка в отчёте (серьёзность «Блокер», если тема не открывается вовсе).

- [ ] **Step 4: Коммит**

```bash
git add tests/e2e/topic-crawl.spec.mjs docs/testing/launch-readiness-report.md
git commit -m "test(e2e): crawl every catalog deck and mode for crashes and dead UI"
```

Сообщить владельцу находки блока 2.

---

## Task 6: Блок 3 — сохранность прогресса (хаос)

**Files:**
- Create: `tests/e2e/chaos.spec.mjs`
- Modify: `docs/testing/launch-readiness-report.md`

**Interfaces:**
- Consumes: хелперы Task 3, локаторы `TOPIC_CARD`/`START_BUTTON` — **скопировать** константы из `topic-crawl.spec.mjs` (не импортировать спеку из спеки).
- Produces: тесты `chaos: <scenario>`.

Как измеряется «прогресс сохранён»: через API того же аккаунта — `GET /api/sessions` (история занятий) и `GET /api/account/bootstrap` до и после сценария. Сценарий проходит, если после восстановления число сессий = ожидаемому (не меньше — потеря, не больше — дубль) и приложение показывает главный экран или продолжение занятия.

- [ ] **Step 1: Спека**

`tests/e2e/chaos.spec.mjs`:

```js
import { test, expect } from "@playwright/test";
import { APP, uniqueEmail, createVerifiedAccountViaApi, loginViaUi, registerViaUi, waitForMail, collectPageErrors } from "./helpers.mjs";

const TOPIC_TITLE = "Чтение: Стихи"; // любая стабильная тема из каталога; заменить на ту, что прошла Task 5 без замечаний
const START_BUTTON = /начать|старт|поехали/i;

async function sessionsCount(token) {
  const r = await fetch(`${APP}/api/sessions`, { headers: { Authorization: `Bearer ${token}` } });
  const j = await r.json();
  return (Array.isArray(j) ? j : j.sessions ?? []).length;
}

async function doOneSession(page) {
  await page.locator(`text=${TOPIC_TITLE}`).first().click();
  await page.getByRole("button", { name: START_BUTTON }).first().click();
  for (let i = 0; i < 6; i++) {
    await page.locator("main button:enabled").first().click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(500);
  }
}

async function freshUser(page) {
  const email = uniqueEmail("chaos");
  const { token } = await createVerifiedAccountViaApi({ email });
  await loginViaUi(page, { email });
  await expect(page.locator(".home-header")).toBeVisible({ timeout: 20_000 });
  return { email, token };
}

test("chaos: перезагрузка посреди занятия", async ({ page }) => {
  const { token } = await freshUser(page);
  const before = await sessionsCount(token);
  await doOneSession(page);
  await page.reload();
  await expect(page.locator(".home-header, .session-topbar").first()).toBeVisible({ timeout: 20_000 });
  const after = await sessionsCount(token);
  expect(after - before).toBeLessThanOrEqual(1);
});

test("chaos: офлайн посреди занятия, затем сеть возвращается", async ({ page, context }) => {
  const { token } = await freshUser(page);
  await page.locator(`text=${TOPIC_TITLE}`).first().click();
  await page.getByRole("button", { name: START_BUTTON }).first().click();
  await context.setOffline(true);
  for (let i = 0; i < 6; i++) { await page.locator("main button:enabled").first().click({ timeout: 5000 }).catch(() => {}); await page.waitForTimeout(400); }
  await expect(page.locator("body")).not.toHaveText(/^\s*$/);
  await context.setOffline(false);
  await page.waitForTimeout(5000);
  await page.reload();
  await expect(page.locator(".home-header, .session-topbar").first()).toBeVisible({ timeout: 20_000 });
  expect(await sessionsCount(token)).toBeGreaterThanOrEqual(0);
});

test("chaos: два устройства одного аккаунта занимаются параллельно", async ({ browser }) => {
  const email = uniqueEmail("twodev");
  const { token } = await createVerifiedAccountViaApi({ email });
  const a = await (await browser.newContext()).newPage();
  const b = await (await browser.newContext()).newPage();
  const sinkA = collectPageErrors(a), sinkB = collectPageErrors(b);
  await loginViaUi(a, { email }); await loginViaUi(b, { email });
  await Promise.all([doOneSession(a), doOneSession(b)]);
  await a.reload(); await b.reload();
  await expect(a.locator(".home-header, .session-topbar").first()).toBeVisible({ timeout: 20_000 });
  await expect(b.locator(".home-header, .session-topbar").first()).toBeVisible({ timeout: 20_000 });
  expect([...sinkA.errors, ...sinkB.errors]).toEqual([]);
  expect(await sessionsCount(token)).toBeLessThanOrEqual(2);
});

test("chaos: очищенное локальное хранилище при живом аккаунте", async ({ page }) => {
  const { email, token } = await freshUser(page);
  await doOneSession(page);
  await page.goto("/");
  const before = await sessionsCount(token);
  await page.evaluate(async () => {
    localStorage.clear();
    for (const d of (await indexedDB.databases?.()) ?? []) indexedDB.deleteDatabase(d.name);
  });
  await page.reload();
  await loginViaUi(page, { email }).catch(() => {});
  await expect(page.locator(".home-header")).toBeVisible({ timeout: 20_000 });
  expect(await sessionsCount(token)).toBe(before);
});

test("chaos: истёкший/невалидный токен посреди работы → понятный путь к входу", async ({ page }) => {
  await freshUser(page);
  await page.evaluate(async () => {
    // Портим сохранённый токен во всех хранилищах, где он может лежать.
    for (const k of Object.keys(localStorage)) if (/token|auth/i.test(k)) localStorage.setItem(k, "invalid");
  });
  await page.reload();
  await expect(page.getByPlaceholder("Email").or(page.locator(".home-header")).first()).toBeVisible({ timeout: 20_000 });
});

test("chaos: локальный режим, потом регистрация — фиксируем судьбу прогресса", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Без аккаунта (локальный режим)" }).click();
  await expect(page.locator(".home-header")).toBeVisible({ timeout: 20_000 });
  await doOneSession(page).catch(() => {});
  const email = uniqueEmail("local2reg");
  await registerViaUi(page, { email });
  const link = new URL(await waitForMail(email));
  await page.goto(link.pathname + link.search);
  await expect(page.locator(".home-header")).toBeVisible({ timeout: 20_000 });
  await page.screenshot({ path: `output/e2e-report/local-then-register-${test.info().project.name}.png`, fullPage: true });
  // Не assert'им перенос: фиксируем фактическое поведение в отчёте (Review Focus #5).
});
```

Сценарий «обновление версии с закэшированными старыми ZIP» — отдельным шагом ниже, т.к. требует двух сборок.

Токен может храниться не в `localStorage`, а в IndexedDB (`persistBootstrap` в `LoginScreen.jsx`). Перед прогоном прочитать, где лежит токен (`grep -rn "persistBootstrap" src/core src/features | head`), и в тесте «истёкший токен» портить его именно там.

- [ ] **Step 2: Прогон**

Run: `npm run test:e2e -- chaos.spec.mjs`
Expected: PASS или находки. Потеря сессии (after < before + ожидаемое) или дубль (> ожидаемого) — «Блокер».

- [ ] **Step 3: Сценарий «обновление версии со старыми колодами в кэше» (ручной, через Playwright)**

1. `npm run test:env`, войти под аккаунтом в Playwright-браузере (`npx playwright codegen --device="Pixel 7" http://127.0.0.1:4310` с `--save-storage=output/e2e-report/state.json`), открыть 3 темы (колоды скачаются в кэш).
2. Остановить окружение. В `public/decks/catalog.json` у одной из открытых колод временно поднять `version` (без коммита!), `npm run build`, снова `npm run test:env`.
3. Открыть приложение с сохранённым состоянием (`npx playwright open --load-storage=output/e2e-report/state.json http://127.0.0.1:4310`), открыть ту же тему.
4. Ожидание: тема открывается (новая версия скачана или корректный fallback на бандл), без ошибок в консоли.
5. **Вернуть `catalog.json`**: `git checkout -- public/decks/catalog.json`, `npm run build`. Проверить `git status --short public/decks/catalog.json` — пусто.

Записать результат в отчёт.

- [ ] **Step 4: Коммит**

```bash
git add tests/e2e/chaos.spec.mjs docs/testing/launch-readiness-report.md
git commit -m "test(e2e): progress-safety chaos scenarios (reload, offline, two devices, storage wipe, token, local mode)"
```

Сообщить владельцу находки блока 3.

---

## Task 7: Блок 4 + день X + сводный отчёт

**Files:**
- Create: `docs/testing/device-checklist.md`
- Create: `docs/testing/launch-day-runbook.md`
- Modify: `docs/testing/launch-readiness-report.md`

- [ ] **Step 1: Чеклист живых устройств**

`docs/testing/device-checklist.md` — не длиннее ~15 минут прохождения, пункты с ожидаемым результатом:

```markdown
# Проверка на своём телефоне (≈15 минут)

Для тестеров. Отвечайте в группе: номер пункта + ✔ / ✘ + скриншот, если ✘. Укажите модель телефона и браузер.

1. Откройте https://app.mironium.com в Safari (iPhone) или Chrome (Android). Нажмите «Создать аккаунт» и зарегистрируйтесь новым email. → Клавиатура не закрывает поле пароля и кнопку.
2. Откройте письмо **в почтовом приложении телефона** и нажмите ссылку. → Попадаете внутрь приложения (не на пустую страницу, не просит войти заново больше одного раза).
3. iPhone: «Поделиться» → «На экран Домой», откройте с иконки. → Верхние кнопки не под «чёлкой», нижние — не под полоской «домой».
4. Откройте 3 любые темы, в каждой пройдите по одному занятию. → Звук/озвучка слышны; перетаскивание пальцем работает; ничего не зависает.
5. Во время занятия сверните приложение на 1 минуту и вернитесь. → Занятие на месте.
6. Включите авиарежим посреди занятия, пройдите пару шагов, выключите. → Ничего не сломалось, прогресс не пропал.
7. Выйдите из аккаунта и войдите снова. → Всё, что вы прошли, на месте.
8. Любое место, где было непонятно, что делать дальше — опишите одной фразой.
```

- [ ] **Step 2: Runbook «первый вечер»**

`docs/testing/launch-day-runbook.md`:

```markdown
# Первый вечер после поста — что смотреть

## За день до поста
- [ ] Resend на платном плане, домен verified (Task 0/F1).
- [ ] Канал ошибок доставляет сообщения (Task 0/F4): тестовая ошибка дошла.
- [ ] `https://app.mironium.com/api/version` = последняя версия; `/api/healthz` = ok.
- [ ] Последний прогон `npm run test:e2e` и `npm run test:load` — зелёные (или известные находки приняты осознанно).
- [ ] Свежий бэкап БД есть в `/data/backups/` (Railway) — время последнего.

## Во время (каждые 30–60 минут первые 3 часа)
| Смотреть | Где | Беда, если |
|---|---|---|
| Ошибки | канал ERROR_REPORTING | любые `email send failed` — письма не уходят |
| Письма | Resend dashboard → Emails | отправлено заметно меньше, чем регистраций |
| CPU / память | Railway → mirocard-backend → Metrics | CPU у потолка дольше минуты, память растёт без остановки |
| Ответы | Railway → HTTP error rate / response time | 5xx > 0, p95 > 1–2 с |
| Живость | `https://app.mironium.com/api/healthz` | не `ok` |

## Если…
- **Письма не уходят** → Resend dashboard (лимит? домен?). Пока чинится: админ-ручка `POST /api/admin/verify-account` активирует аккаунт вручную тем, кто написал.
- **Сервер тормозит под регистрациями** → Railway Metrics; кратковременно можно поднять ресурсы сервиса в Railway; дальше — асинхронный scrypt (см. отчёт, R3).
- **Сломалась тема** → откат по `docs/commercial-launch-runbook.md` §11.
```

Перед записью проверить, что `POST /admin/verify-account` существует и что он делает (`grep -n "handleAdminVerifyAccount" -A20 backend/server.mjs`) — если поведение другое, поправить текст.

- [ ] **Step 3: Сводный отчёт**

В `docs/testing/launch-readiness-report.md` дописать сверху раздел «Итог»: число находок по серьёзности; список блокеров с планом исправления; вердикт «можно открывать / можно после исправления N1..Nk / нельзя»; что **не** проверено (оплата, реальный Railway под нагрузкой, педагогическая правильность заданий).

- [ ] **Step 4: Коммит**

```bash
git add docs/testing/device-checklist.md docs/testing/launch-day-runbook.md docs/testing/launch-readiness-report.md
git commit -m "docs(testing): device checklist, launch-day runbook, launch readiness report"
```

- [ ] **Step 5: Деплой Task 1 (только с явного «да» владельца)**

Спросить владельца. После «да»:

```bash
git status --short
npm run build
npm version patch --no-git-tag-version
git add package.json package-lock.json
git commit -m "chore: release v$(node -p "require('./package.json').version")"
git push origin main
```

Затем `curl -s https://app.mironium.com/api/version` = новая версия и `curl -sI https://app.mironium.com/` = 200. После — Task 0/F4: вызвать тестовую ошибку и убедиться, что она дошла до канала. Если `git push` отклонён (удалённый `main` ушёл вперёд) — `git pull --no-rebase origin main`, повторить сборку, снова push.

- [ ] **Step 6: Чеклист устройств — в группу тестеров (только с «да» владельца на точный текст)**

Показать владельцу текст `docs/testing/device-checklist.md`; отправку в Telegram-группу делает владелец или исполнитель после явного подтверждения текста (правило: исходящие сообщения только после «да» на точный текст).
