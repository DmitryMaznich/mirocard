# Student Portal — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить режим ученика: логопед генерирует ссылку, ученик открывает то же приложение через эту ссылку и видит упрощённый экран с назначенными темами; логопед управляет заданием прямо из карточки ученика.

**Architecture:** Одиночный бандл (тот же Vite-сборк). Guard clause в начале `App.jsx` — если в `localStorage` есть `student_portal_token`, рендерится `StudentApp` вместо логопедского приложения. Существующие экраны сессий (SessionScreen, ModePickerScreen, ParamsScreen, SessionSummary) не трогаются: `StudentApp` просто заполняет store нужными полями и вызывает `setScreen`. Бэкенд получает отдельную таблицу `student_portals` и новые endpoints, полностью отдельные от существующего API.

**Tech Stack:** Node.js ESM (`node:sqlite` / DatabaseSync), `node --test`, React 19, Zustand, Vite/Vitest.

---

## Карта файлов

| Файл | Действие | Что делает |
|---|---|---|
| `backend/lib/db.mjs` | **Modify** | Добавить таблицу `student_portals` в `initDb()` |
| `backend/lib/student-portal.mjs` | **Create** | CRUD-функции для `student_portals` |
| `backend/tests/student-portal.test.mjs` | **Create** | Тесты для student-portal.mjs |
| `backend/server.mjs` | **Modify** | Импорт, middleware `requireStudentPortal`, 6 новых handlers и маршрутов |
| `src/App.jsx` | **Modify** | 6 строк в начале функции: URL-извлечение токена + guard clause |
| `src/StudentApp.jsx` | **Create** | Mini-router режима ученика |
| `src/features/student/useStudentPortal.js` | **Create** | Hook: загрузка `/student/me`, обработка ошибок |
| `src/features/student/StudentHomeScreen.jsx` | **Create** | Главный экран ученика (фиолетовый градиент) |
| `src/features/student/StudentHomeScreen.css` | **Create** | Стили для StudentHomeScreen |
| `src/features/students/StudentEditScreen.jsx` | **Modify** | Новая секция «Доступ» в конце экрана + кнопки «Назначить» в списке тем |

---

## Task 1: Feature branch

**Files:** (git only)

- [ ] **Step 1: Создать ветку**

```bash
git checkout -b feat/student-portal
```

- [ ] **Step 2: Commit**

```bash
git commit --allow-empty -m "chore: start feat/student-portal branch"
```

---

## Task 2: Добавить таблицу `student_portals` в db.mjs

**Files:**
- Modify: `backend/lib/db.mjs:154` (после последней таблицы, перед закрывающей `);`)

- [ ] **Step 1: Открыть `backend/lib/db.mjs`, найти конец последнего CREATE TABLE** (около строки 154 — блок `account_kv`), добавить перед закрывающим `);` следующий SQL:

```sql
    CREATE TABLE IF NOT EXISTS student_portals (
      id              TEXT PRIMARY KEY,
      account_id      TEXT NOT NULL REFERENCES accounts(id),
      student_id      TEXT NOT NULL,
      token_hash      TEXT UNIQUE NOT NULL,
      label           TEXT,
      active_topic_id TEXT,
      active_mode_id  TEXT,
      created_at      TEXT NOT NULL,
      last_used_at    TEXT,
      revoked_at      TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_portals_account ON student_portals(account_id);
    CREATE INDEX IF NOT EXISTS idx_portals_student ON student_portals(student_id);
    CREATE INDEX IF NOT EXISTS idx_portals_token   ON student_portals(token_hash);
```

  Важно: добавить в то же место, где уже определены все остальные таблицы (внутрь единственного `db.exec(\`...\`)`).

- [ ] **Step 2: Проверить, что существующая БД принимает миграцию** (CREATE TABLE IF NOT EXISTS безопасен)

```bash
node -e "import('./backend/lib/db.mjs').then(m => { m.initDb(':memory:'); console.log('OK'); })"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/lib/db.mjs
git commit -m "feat(db): add student_portals table"
```

---

## Task 3: Создать `backend/lib/student-portal.mjs`

**Files:**
- Create: `backend/lib/student-portal.mjs`
- Test: `backend/tests/student-portal.test.mjs` (в следующем таске)

- [ ] **Step 1: Создать файл `backend/lib/student-portal.mjs`**

```js
import { randomUUID } from "node:crypto";

export function createStudentPortal(db, { accountId, studentId, tokenHash, label }) {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO student_portals (id, account_id, student_id, token_hash, label, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, accountId, studentId, tokenHash, label ?? null, createdAt);
  return id;
}

export function findPortalByTokenHash(db, tokenHash) {
  return db.prepare(
    `SELECT * FROM student_portals WHERE token_hash = ? AND revoked_at IS NULL`
  ).get(tokenHash) ?? null;
}

export function listStudentPortals(db, { accountId, studentId }) {
  return db.prepare(
    `SELECT * FROM student_portals
     WHERE account_id = ? AND student_id = ? AND revoked_at IS NULL
     ORDER BY created_at DESC`
  ).all(accountId, studentId);
}

export function revokeStudentPortal(db, { id, accountId }) {
  db.prepare(
    `UPDATE student_portals SET revoked_at = ?
     WHERE id = ? AND account_id = ?`
  ).run(new Date().toISOString(), id, accountId);
}

export function updatePortalLastUsed(db, tokenHash) {
  db.prepare(
    `UPDATE student_portals SET last_used_at = ? WHERE token_hash = ?`
  ).run(new Date().toISOString(), tokenHash);
}

export function setPortalActiveTask(db, { accountId, studentId, topicId, modeId }) {
  db.prepare(
    `UPDATE student_portals
     SET active_topic_id = ?, active_mode_id = ?
     WHERE account_id = ? AND student_id = ? AND revoked_at IS NULL`
  ).run(topicId ?? null, modeId ?? null, accountId, studentId);
}
```

---

## Task 4: Написать тесты для student-portal.mjs

**Files:**
- Create: `backend/tests/student-portal.test.mjs`

- [ ] **Step 1: Создать файл тестов**

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { initDb } from "../lib/db.mjs";
import {
  createStudentPortal,
  findPortalByTokenHash,
  listStudentPortals,
  revokeStudentPortal,
  updatePortalLastUsed,
  setPortalActiveTask,
} from "../lib/student-portal.mjs";

function makeDb() { return initDb(":memory:"); }
function hashToken(raw) { return createHash("sha256").update(raw).digest("hex"); }

function seedAccount(db) {
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO accounts (id, email, password_hash, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(id, `u${id.slice(0,6)}@x.com`, "hash", now, now);
  return id;
}

function seedStudent(db, accountId) {
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO students (id, account_id, name, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(id, accountId, "Вася", now, now);
  return id;
}

// ── create + find ────────────────────────────────────────────────────────────

test("createStudentPortal + findPortalByTokenHash: найден по токену", () => {
  const db = makeDb();
  const accountId = seedAccount(db);
  const studentId = seedStudent(db, accountId);
  const tokenHash = hashToken(randomUUID());
  createStudentPortal(db, { accountId, studentId, tokenHash, label: "iPad Васи" });
  const portal = findPortalByTokenHash(db, tokenHash);
  assert.ok(portal, "portal должен найтись");
  assert.equal(portal.student_id, studentId);
  assert.equal(portal.label, "iPad Васи");
  assert.equal(portal.revoked_at, null);
  assert.equal(portal.active_topic_id, null);
});

test("findPortalByTokenHash: null для неизвестного токена", () => {
  const db = makeDb();
  assert.equal(findPortalByTokenHash(db, "nonexistent"), null);
});

// ── revoke ──────────────────────────────────────────────────────────────────

test("revokeStudentPortal: findPortalByTokenHash возвращает null после отзыва", () => {
  const db = makeDb();
  const accountId = seedAccount(db);
  const studentId = seedStudent(db, accountId);
  const tokenHash = hashToken(randomUUID());
  const portalId = createStudentPortal(db, { accountId, studentId, tokenHash, label: null });
  revokeStudentPortal(db, { id: portalId, accountId });
  assert.equal(findPortalByTokenHash(db, tokenHash), null);
});

test("revokeStudentPortal: чужой account_id не отзывает", () => {
  const db = makeDb();
  const accountId = seedAccount(db);
  const otherId = seedAccount(db);
  const studentId = seedStudent(db, accountId);
  const tokenHash = hashToken(randomUUID());
  const portalId = createStudentPortal(db, { accountId, studentId, tokenHash, label: null });
  revokeStudentPortal(db, { id: portalId, accountId: otherId });
  assert.ok(findPortalByTokenHash(db, tokenHash), "свой portal должен остаться активным");
});

// ── list ─────────────────────────────────────────────────────────────────────

test("listStudentPortals: только активные порталы ученика", () => {
  const db = makeDb();
  const accountId = seedAccount(db);
  const studentId = seedStudent(db, accountId);
  const h1 = hashToken(randomUUID());
  const h2 = hashToken(randomUUID());
  const id1 = createStudentPortal(db, { accountId, studentId, tokenHash: h1, label: "A" });
  createStudentPortal(db, { accountId, studentId, tokenHash: h2, label: "B" });
  revokeStudentPortal(db, { id: id1, accountId });
  const list = listStudentPortals(db, { accountId, studentId });
  assert.equal(list.length, 1);
  assert.equal(list[0].label, "B");
});

// ── last_used_at ─────────────────────────────────────────────────────────────

test("updatePortalLastUsed: устанавливает last_used_at", () => {
  const db = makeDb();
  const accountId = seedAccount(db);
  const studentId = seedStudent(db, accountId);
  const tokenHash = hashToken(randomUUID());
  createStudentPortal(db, { accountId, studentId, tokenHash, label: null });
  assert.equal(findPortalByTokenHash(db, tokenHash).last_used_at, null);
  updatePortalLastUsed(db, tokenHash);
  assert.ok(findPortalByTokenHash(db, tokenHash).last_used_at, "last_used_at должен быть установлен");
});

// ── active task ───────────────────────────────────────────────────────────────

test("setPortalActiveTask: обновляет все активные порталы ученика", () => {
  const db = makeDb();
  const accountId = seedAccount(db);
  const studentId = seedStudent(db, accountId);
  const tokenHash = hashToken(randomUUID());
  createStudentPortal(db, { accountId, studentId, tokenHash, label: null });
  setPortalActiveTask(db, { accountId, studentId, topicId: "shopping_v1", modeId: "shop" });
  const portal = findPortalByTokenHash(db, tokenHash);
  assert.equal(portal.active_topic_id, "shopping_v1");
  assert.equal(portal.active_mode_id, "shop");
});

test("setPortalActiveTask: снятие задания (null)", () => {
  const db = makeDb();
  const accountId = seedAccount(db);
  const studentId = seedStudent(db, accountId);
  const tokenHash = hashToken(randomUUID());
  createStudentPortal(db, { accountId, studentId, tokenHash, label: null });
  setPortalActiveTask(db, { accountId, studentId, topicId: "shopping_v1", modeId: "shop" });
  setPortalActiveTask(db, { accountId, studentId, topicId: null, modeId: null });
  const portal = findPortalByTokenHash(db, tokenHash);
  assert.equal(portal.active_topic_id, null);
  assert.equal(portal.active_mode_id, null);
});
```

- [ ] **Step 2: Запустить тесты — убедиться, что все FAIL с "not found"**

```bash
cd backend && node --test tests/student-portal.test.mjs
```

Expected: все тесты FAIL с `Cannot find module '../lib/student-portal.mjs'` — значит тесты написаны, реализация ещё не импортируется. Если файл уже создан в Task 3, тесты должны PASS.

- [ ] **Step 3: Запустить снова после создания файла**

```bash
cd backend && node --test tests/student-portal.test.mjs
```

Expected: все 8 тестов PASS.

- [ ] **Step 4: Commit**

```bash
git add backend/lib/student-portal.mjs backend/tests/student-portal.test.mjs
git commit -m "feat(backend): add student-portal DB lib with tests"
```

---

## Task 5: Добавить middleware + student endpoints в server.mjs

**Files:**
- Modify: `backend/server.mjs`

Три блока изменений: (А) импорт, (Б) helpers, (В) handlers + routes.

- [ ] **Step 1: Добавить импорт в начало server.mjs** (после блока импортов из account-repository)

```js
import {
  createStudentPortal,
  findPortalByTokenHash,
  listStudentPortals,
  revokeStudentPortal,
  updatePortalLastUsed,
  setPortalActiveTask,
} from "./lib/student-portal.mjs";
```

- [ ] **Step 2: Добавить helper `requireStudentPortal`** (после функции `requireDeployToken`):

```js
function requireStudentPortal(req) {
  const raw = getBearerToken(req);
  if (!raw) throw { status: 401, message: "Missing portal token" };
  const tokenHash = hashToken(raw);
  const portal = findPortalByTokenHash(db, tokenHash);
  if (!portal) throw { status: 401, message: "Invalid or revoked portal link" };
  updatePortalLastUsed(db, tokenHash);
  return portal;
}
```

- [ ] **Step 3: Написать handlers** (добавить в конец раздела handlers, перед главным `requestListener`):

```js
// ─── Student portal handlers ────────────────────────────────────────────────

async function handleStudentMe(req, res) {
  const portal = requireStudentPortal(req);
  const students = getStudents(db, portal.account_id);
  const student = students.find((s) => s.id === portal.student_id && !s.deleted_at);
  if (!student) throw { status: 404, message: "Student not found" };

  const allLinks = getStudentTopicLinks(db, portal.account_id);
  const studentLinks = allLinks.filter((l) => l.student_id === portal.student_id && !l.deleted_at);

  const assignedTopics = studentLinks.map((l) => ({
    topicId: l.topic_id,
    selectionMode: l.selection_mode,
    selectedConceptIds: safeJson(l.selected_concept_ids, []),
    repsPerConcept: l.reps_per_concept,
  }));

  const activeTask = portal.active_topic_id
    ? { topicId: portal.active_topic_id, modeId: portal.active_mode_id }
    : null;

  return writeJson(res, 200, {
    student: { id: student.id, name: student.name },
    activeTask,
    assignedTopics,
  });
}

async function handleStudentSession(req, res) {
  const portal = requireStudentPortal(req);
  const body = await readJsonBody(req);
  // body: { id, topicId, topicVersion, mode, startedAt, completedAt, correctCount, incorrectCount, percentCorrect, mistakes }
  appendSession(db, {
    id: body.id,
    accountId: portal.account_id,
    studentId: portal.student_id,
    topicId: body.topicId,
    topicVersion: body.topicVersion ?? "unknown",
    mode: body.mode,
    startedAt: body.startedAt,
    completedAt: body.completedAt,
    correctCount: body.correctCount ?? 0,
    incorrectCount: body.incorrectCount ?? 0,
    percentCorrect: body.percentCorrect ?? 0,
    mistakes: JSON.stringify(body.mistakes ?? []),
    createdAt: new Date().toISOString(),
  });
  return writeNoContent(res);
}

// ─── Therapist portal management handlers ────────────────────────────────────

async function handleCreatePortal(req, res, studentId) {
  const account = requireAuth(req);
  const body = await readJsonBody(req);
  const raw = randomUUID();
  const tokenHash = hashToken(raw);
  const label = typeof body.label === "string" ? body.label.trim() || null : null;
  const portalId = createStudentPortal(db, { accountId: account.id, studentId, tokenHash, label });
  const url = `${req.headers.origin ?? ""}/s/${raw}`;
  return writeJson(res, 201, { portalId, url, token: raw });
}

async function handleListPortals(req, res, studentId) {
  const account = requireAuth(req);
  const portals = listStudentPortals(db, { accountId: account.id, studentId });
  return writeJson(res, 200, { portals });
}

async function handleRevokePortal(req, res, studentId, portalId) {
  const account = requireAuth(req);
  revokeStudentPortal(db, { id: portalId, accountId: account.id });
  return writeNoContent(res);
}

async function handleSetActiveTask(req, res, studentId) {
  const account = requireAuth(req);
  const body = await readJsonBody(req);
  setPortalActiveTask(db, {
    accountId: account.id,
    studentId,
    topicId: body.topicId ?? null,
    modeId: body.modeId ?? null,
  });
  return writeNoContent(res);
}
```

- [ ] **Step 4: Добавить маршруты** в `requestListener` — после существующих маршрутов, перед `return notFound(res)`:

```js
// ── Student portal routes (student auth) ─────────────────────────────────────
if (method === "GET" && p === "/student/me") return await handleStudentMe(req, res);
if (method === "POST" && p === "/student/session") return await handleStudentSession(req, res);

// ── Therapist portal management routes (account auth) ────────────────────────
const portalCreate = p.match(/^\/students\/([^/]+)\/portal$/);
if (method === "POST" && portalCreate) return await handleCreatePortal(req, res, portalCreate[1]);

const portalList = p.match(/^\/students\/([^/]+)\/portals$/);
if (method === "GET" && portalList) return await handleListPortals(req, res, portalList[1]);

const portalRevoke = p.match(/^\/students\/([^/]+)\/portal\/([^/]+)$/);
if (method === "DELETE" && portalRevoke) return await handleRevokePortal(req, res, portalRevoke[1], portalRevoke[2]);

const activeTask = p.match(/^\/students\/([^/]+)\/active-task$/);
if (method === "PATCH" && activeTask) return await handleSetActiveTask(req, res, activeTask[1]);
```

- [ ] **Step 5: Ручная проверка — запустить сервер и вызвать несуществующий endpoint**

```bash
# В одном терминале:
node backend/server.mjs
# В другом:
curl -s http://localhost:3012/student/me
```

Expected: `{"error":"Missing portal token"}` со статусом 401.

- [ ] **Step 6: Запустить все backend-тесты**

```bash
cd backend && node --test tests/*.test.mjs
```

Expected: все PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/server.mjs
git commit -m "feat(backend): add student portal endpoints"
```

---

## Task 6: Deploy backend + verify

**Files:** (remote только)

- [ ] **Step 1: Deploy**

```bash
npm run deploy:prod
```

- [ ] **Step 2: Verify endpoints работают на prod**

```bash
curl -s https://mirocard.kaplieva.help/api/student/me
```

Expected: `{"error":"Missing portal token"}` (или эквивалент) — значит endpoint существует.

- [ ] **Step 3: Verify существующие endpoints не сломались**

```bash
curl -s https://mirocard.kaplieva.help/api/account/bootstrap
```

Expected: 401 с "Missing token" (не 404, не 500).

---

## Task 7: Guard clause в App.jsx

**Files:**
- Modify: `src/App.jsx` (начало функции `App`)

- [ ] **Step 1: Прочитать текущее начало `App.jsx`** — найти где начинается `export default function App()`.

- [ ] **Step 2: Добавить 6 строк в самое начало функции `App`** — до любых хуков и логики:

```jsx
// ── Student portal entry ──────────────────────────────────────────────────────
const urlMatch = window.location.pathname.match(/^\/s\/([A-Za-z0-9_-]+)$/);
if (urlMatch) {
  localStorage.setItem("student_portal_token", urlMatch[1]);
  history.replaceState(null, "", "/");
}
const portalToken = localStorage.getItem("student_portal_token");
if (portalToken) return <StudentApp token={portalToken} />;
// ─────────────────────────────────────────────────────────────────────────────
```

  Эти строки должны идти **до** любых `useState`, `useEffect`, `useCallback`.

- [ ] **Step 3: Добавить импорт StudentApp** в начало App.jsx (среди других импортов):

```jsx
import StudentApp from "./StudentApp";
```

- [ ] **Step 4: Убедиться, что обычный flow не сломан** — запустить dev-сервер

```bash
npm run dev
```

  Открыть http://localhost:5173/ — должен отображаться стандартный логопедский экран (без `student_portal_token` в localStorage). Открыть DevTools → Application → LocalStorage, убедиться что `student_portal_token` отсутствует.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx
git commit -m "feat(app): add student portal guard clause in App.jsx"
```

---

## Task 8: Создать `useStudentPortal.js`

**Files:**
- Create: `src/features/student/useStudentPortal.js`

- [ ] **Step 1: Создать директорию и файл**

```js
import { useState, useEffect } from "react";
import { api } from "@/core/api";

export function useStudentPortal(token) {
  const [state, setState] = useState({ status: "loading", data: null, error: null });

  useEffect(() => {
    if (!token) {
      setState({ status: "error", data: null, error: "no_token" });
      return;
    }
    let cancelled = false;
    api.get("/student/me", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((data) => {
        if (!cancelled) setState({ status: "ok", data, error: null });
      })
      .catch((err) => {
        if (!cancelled) setState({ status: "error", data: null, error: err.status === 401 ? "revoked" : "network" });
      });
    return () => { cancelled = true; };
  }, [token]);

  return state;
}
```

  **Важно:** Если `api.get` в проекте возвращает Promise с `response.json()` внутри, убедись, что правильно передаёшь `Authorization`. Проверь `src/core/api.js` на сигнатуру функции: если там `api(method, path, opts)` или другое — адаптируй вызов. Если `api` не принимает `headers` — передай токен через query-параметр или адаптируй `api` с raw `fetch`.

- [ ] **Step 2: Проверь сигнатуру `api`**

  Открыть `src/core/api.js` — убедиться что `api.get` существует или использовать правильную форму вызова.

---

## Task 9: Создать `StudentApp.jsx`

**Files:**
- Create: `src/StudentApp.jsx`

- [ ] **Step 1: Создать файл**

```jsx
import { useState } from "react";
import { useStudentPortal } from "@/features/student/useStudentPortal";
import StudentHomeScreen from "@/features/student/StudentHomeScreen";

function ErrorScreen({ reason }) {
  return (
    <div style={{
      minHeight: "100dvh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
      background: "#f7f8fc",
      textAlign: "center",
    }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🔗</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: "#1a1a2e", marginBottom: 8 }}>
        Ссылка недействительна
      </div>
      <div style={{ fontSize: 15, color: "#6b7280", maxWidth: 280 }}>
        {reason === "revoked"
          ? "Доступ отозван. Попросите логопеда прислать новую ссылку."
          : "Не удалось подключиться. Проверьте интернет и попробуйте снова."}
      </div>
      {reason === "network" && (
        <button
          style={{ marginTop: 24, padding: "12px 24px", borderRadius: 12, border: "none",
            background: "#667eea", color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer" }}
          onClick={() => window.location.reload()}
        >
          Повторить
        </button>
      )}
    </div>
  );
}

function LoadingScreen() {
  return (
    <div style={{
      minHeight: "100dvh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    }}>
      <div style={{ color: "white", fontSize: 18, opacity: 0.8 }}>Загрузка…</div>
    </div>
  );
}

export default function StudentApp({ token }) {
  const { status, data, error } = useStudentPortal(token);
  const [screen, setScreen] = useState("home");

  if (status === "loading") return <LoadingScreen />;
  if (status === "error") return <ErrorScreen reason={error} />;

  const { student, activeTask, assignedTopics } = data;

  return (
    <StudentHomeScreen
      student={student}
      activeTask={activeTask}
      assignedTopics={assignedTopics}
      onStartSession={({ topicId, modeId }) => {
        // Заполняем существующий store и переходим на session screen
        // Импорт здесь для избежания circular dependency
        import("@/core/store").then(({ useAppStore }) => {
          useAppStore.setState({
            activeStudentId: student.id,
            activeTopicId: topicId,
            activeModeId: modeId ?? undefined,
          });
          useAppStore.getState().setScreen(modeId ? "params" : "modes");
        });
      }}
    />
  );
}
```

  **Замечание про `onStartSession`:** динамический `import("@/core/store")` нужен только если есть circular dependency. Если нет — импортируй `useAppStore` статически в начале файла.

- [ ] **Step 2: Commit**

```bash
git add src/StudentApp.jsx src/features/student/useStudentPortal.js
git commit -m "feat(frontend): add StudentApp mini-router and useStudentPortal hook"
```

---

## Task 10: Создать `StudentHomeScreen.jsx`

**Files:**
- Create: `src/features/student/StudentHomeScreen.jsx`
- Create: `src/features/student/StudentHomeScreen.css`

- [ ] **Step 1: Создать CSS-файл `src/features/student/StudentHomeScreen.css`**

```css
.shs-root {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  background: #f7f8fc;
}

/* Header */
.shs-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px 20px 28px;
  color: white;
  flex-shrink: 0;
}
.shs-greeting { font-size: 14px; opacity: 0.8; margin-bottom: 2px; }
.shs-name { font-size: 26px; font-weight: 700; letter-spacing: -0.5px; }

/* Body */
.shs-body {
  flex: 1;
  padding: 20px 16px 32px;
  overflow-y: auto;
}

/* Active task card */
.shs-active-card {
  background: #fff;
  border-radius: 20px;
  padding: 20px;
  margin-bottom: 24px;
  box-shadow: 0 4px 20px rgba(102, 126, 234, 0.15);
  border: 2px solid #667eea;
  position: relative;
  overflow: hidden;
}
.shs-active-card::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 4px;
  background: linear-gradient(90deg, #667eea, #764ba2);
}
.shs-now-badge {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1px;
  color: #667eea;
  text-transform: uppercase;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.shs-pulse {
  width: 7px; height: 7px;
  background: #667eea;
  border-radius: 50%;
  animation: shs-pulse 1.5s ease-in-out infinite;
}
@keyframes shs-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.25; }
}
.shs-task-icon { font-size: 44px; display: block; margin-bottom: 8px; }
.shs-task-name { font-size: 22px; font-weight: 700; color: #1a1a2e; margin-bottom: 16px; line-height: 1.2; }
.shs-start-btn {
  width: 100%;
  padding: 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  border: none;
  border-radius: 14px;
  font-size: 17px;
  font-weight: 700;
  cursor: pointer;
  letter-spacing: 0.3px;
}

/* Empty active task */
.shs-empty-card {
  background: #fff;
  border-radius: 20px;
  padding: 24px 20px;
  margin-bottom: 24px;
  text-align: center;
  color: #9ca3af;
  border: 2px dashed #e5e7eb;
}
.shs-empty-icon { font-size: 32px; margin-bottom: 8px; }
.shs-empty-text { font-size: 15px; }

/* Topic list */
.shs-section-label {
  font-size: 11px;
  font-weight: 700;
  color: #aaa;
  letter-spacing: 1px;
  text-transform: uppercase;
  margin-bottom: 10px;
  padding-left: 4px;
}
.shs-topic-list { display: flex; flex-direction: column; gap: 8px; }
.shs-topic-item {
  background: #fff;
  border-radius: 14px;
  padding: 14px 16px;
  display: flex;
  align-items: center;
  gap: 14px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
  cursor: pointer;
  transition: opacity 0.15s;
  border: none;
  width: 100%;
  text-align: left;
}
.shs-topic-item:active { opacity: 0.8; }
.shs-topic-item--locked { opacity: 0.4; pointer-events: none; }
.shs-topic-emoji {
  font-size: 24px;
  width: 44px; height: 44px;
  background: #f0f2ff;
  border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.shs-topic-info { flex: 1; }
.shs-topic-name { font-size: 15px; font-weight: 600; color: #1a1a2e; margin-bottom: 2px; }
.shs-topic-sub { font-size: 12px; color: #aaa; }
.shs-topic-arrow { color: #ccc; font-size: 18px; }
```

- [ ] **Step 2: Создать `src/features/student/StudentHomeScreen.jsx`**

```jsx
import { useAppStore } from "@/core/store";
import "./StudentHomeScreen.css";

const BUILTIN_TOPIC_META = {
  shopping_v1: { name: "Список покупок", emoji: "🛒", sub: "Поход в магазин" },
  opposites_v1: { name: "Противоположности", emoji: "↔️", sub: "Карточки" },
  // добавлять по мере появления тем
};

function getTopicMeta(topicId) {
  if (BUILTIN_TOPIC_META[topicId]) return BUILTIN_TOPIC_META[topicId];
  // Для неизвестных тем — generic fallback
  return { name: topicId, emoji: "📚", sub: "Задание" };
}

export default function StudentHomeScreen({ student, activeTask, assignedTopics, onStartSession }) {
  const setScreen = useAppStore((s) => s.setScreen);

  const otherTopics = assignedTopics.filter(
    (t) => !activeTask || t.topicId !== activeTask.topicId
  );

  function handleStart(topicId, modeId) {
    onStartSession({ topicId, modeId });
  }

  const activeMeta = activeTask ? getTopicMeta(activeTask.topicId) : null;

  return (
    <div className="shs-root">
      <div className="shs-header">
        <div className="shs-greeting">Привет,</div>
        <div className="shs-name">{student.name} 👋</div>
      </div>

      <div className="shs-body">
        {activeTask ? (
          <div className="shs-active-card">
            <div className="shs-now-badge">
              <span className="shs-pulse" />
              Задание сейчас
            </div>
            <span className="shs-task-icon">{activeMeta.emoji}</span>
            <div className="shs-task-name">{activeMeta.name}</div>
            <button
              className="shs-start-btn"
              onClick={() => handleStart(activeTask.topicId, activeTask.modeId)}
            >
              Начать →
            </button>
          </div>
        ) : (
          <div className="shs-empty-card">
            <div className="shs-empty-icon">⏳</div>
            <div className="shs-empty-text">Логопед ещё не назначил задание</div>
          </div>
        )}

        {otherTopics.length > 0 && (
          <>
            <div className="shs-section-label">Ещё доступно</div>
            <div className="shs-topic-list">
              {otherTopics.map((t) => {
                const meta = getTopicMeta(t.topicId);
                return (
                  <button
                    key={t.topicId}
                    className="shs-topic-item"
                    onClick={() => handleStart(t.topicId, null)}
                  >
                    <div className="shs-topic-emoji">{meta.emoji}</div>
                    <div className="shs-topic-info">
                      <div className="shs-topic-name">{meta.name}</div>
                      <div className="shs-topic-sub">{meta.sub}</div>
                    </div>
                    <div className="shs-topic-arrow">›</div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Проверить в браузере вручную**

  Открыть dev-server (`npm run dev`). В DevTools → Console выполнить:
  ```js
  localStorage.setItem("student_portal_token", "test_fake");
  location.reload();
  ```
  Expected: отображается LoadingScreen (фиолетовый фон), потом ErrorScreen с "Ссылка недействительна".
  
  Убрать токен: `localStorage.removeItem("student_portal_token"); location.reload();`
  Expected: стандартный логопедский экран возвращается.

- [ ] **Step 4: Commit**

```bash
git add src/features/student/
git commit -m "feat(frontend): add StudentHomeScreen with purple gradient"
```

---

## Task 11: Интеграционный тест через dev-server

**Files:** (проверка, нет изменений кода)

- [ ] **Step 1: Создать тестовый портал через API** (нужен валидный JWT логопеда)

  В браузере с открытым логопедским приложением, выполнить в Console:
  ```js
  const token = localStorage.getItem("token");
  const studentId = "PASTE_STUDENT_ID_HERE"; // из DevTools
  fetch("/api/students/" + studentId + "/portal", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
    body: JSON.stringify({ label: "Тест" })
  }).then(r => r.json()).then(console.log);
  ```
  Expected: `{ portalId: "...", url: "http://localhost:5173/s/...", token: "..." }`

- [ ] **Step 2: Открыть URL из ответа в том же браузере (другая вкладка)**

  Expected: фиолетовая шапка «Привет, [имя] 👋», активное задание или пустое состояние.

- [ ] **Step 3: Убедиться, что тап по теме переводит на сессию**

  Если есть назначенные темы — тапнуть. Expected: переход на ModePickerScreen или ParamsScreen (существующие экраны).

---

## Task 12: Секция «Доступ» в StudentEditScreen

**Files:**
- Modify: `src/features/students/StudentEditScreen.jsx`

Добавить новую секцию в конце экрана — перед блоком «Удаление» (строка ~336).

- [ ] **Step 1: Добавить состояние в начало компонента** (после существующих `useState`):

```jsx
const [portals, setPortals] = useState(null);      // null = не загружено
const [portalsLoading, setPortalsLoading] = useState(false);
const [newPortalLabel, setNewPortalLabel] = useState("");
const [newPortalUrl, setNewPortalUrl] = useState(null);
const [confirmRevokeId, setConfirmRevokeId] = useState(null);
```

- [ ] **Step 2: Добавить функции управления порталами** (после существующих функций компонента):

```jsx
async function loadPortals() {
  if (!isEdit || portalsLoading) return;
  setPortalsLoading(true);
  try {
    const data = await api.get(`/students/${initial.id}/portals`);
    setPortals(data.portals);
  } catch {
    setPortals([]);
  } finally {
    setPortalsLoading(false);
  }
}

async function handleCreatePortal() {
  const data = await api.post(`/students/${initial.id}/portal`, { label: newPortalLabel || null });
  setNewPortalUrl(data.url);
  setNewPortalLabel("");
  loadPortals();
}

async function handleRevokePortal(portalId) {
  await api.delete(`/students/${initial.id}/portal/${portalId}`);
  setConfirmRevokeId(null);
  loadPortals();
}
```

- [ ] **Step 3: Добавить JSX секции** — вставить перед `{/* ── Удаление ── */}`:

```jsx
{/* ── Доступ с устройства ученика ── */}
{isEdit && (
  <div className="settings-section">
    <div className="settings-section-title">
      Доступ с устройства ученика
      {portals === null && (
        <button
          type="button"
          className="se-add-row"
          style={{ marginLeft: 12, fontSize: 12 }}
          onClick={loadPortals}
        >
          Показать
        </button>
      )}
    </div>

    {portals !== null && (
      <>
        {portalsLoading && <div style={{ color: "#9ca3af", fontSize: 13, padding: "6px 0" }}>Загрузка…</div>}

        {portals.map((portal) => (
          <div key={portal.id} className="se-list-row">
            <span className="se-list-name">
              {portal.label || "Без названия"}
              {portal.last_used_at && (
                <span style={{ marginLeft: 8, fontSize: 11, color: "#9ca3af" }}>
                  (был {new Date(portal.last_used_at).toLocaleDateString("ru")})
                </span>
              )}
            </span>
            {confirmRevokeId === portal.id ? (
              <>
                <button className="se-list-remove" onClick={() => handleRevokePortal(portal.id)}>✓ Отозвать</button>
                <button className="se-list-remove" onClick={() => setConfirmRevokeId(null)}>✕</button>
              </>
            ) : (
              <button className="se-list-remove" onClick={() => setConfirmRevokeId(portal.id)}>Отозвать</button>
            )}
          </div>
        ))}

        {portals.length === 0 && !portalsLoading && (
          <div style={{ color: "#9ca3af", fontSize: 13, padding: "4px 0" }}>Нет активных ссылок</div>
        )}

        {newPortalUrl ? (
          <div style={{ marginTop: 12, padding: 12, background: "#f0f9ff", borderRadius: 10 }}>
            <div style={{ fontSize: 12, color: "#0369a1", fontWeight: 600, marginBottom: 6 }}>Ссылка создана:</div>
            <div style={{ fontSize: 12, wordBreak: "break-all", color: "#1e40af", marginBottom: 8 }}>{newPortalUrl}</div>
            <button
              type="button"
              className="se-add-row"
              onClick={() => { navigator.clipboard.writeText(newPortalUrl); }}
            >
              Скопировать
            </button>
            <button
              type="button"
              style={{ marginLeft: 8, fontSize: 12, background: "none", border: "none", color: "#9ca3af", cursor: "pointer" }}
              onClick={() => setNewPortalUrl(null)}
            >
              Закрыть
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <input
              className="se-video-input"
              placeholder="Название устройства (необязательно)"
              value={newPortalLabel}
              onChange={(e) => setNewPortalLabel(e.target.value)}
            />
            <button type="button" className="se-video-add-btn" onClick={handleCreatePortal}>
              Создать ссылку
            </button>
          </div>
        )}
      </>
    )}
  </div>
)}
```

- [ ] **Step 4: Проверить в браузере**

  Открыть карточку любого ученика → кнопка «Показать» → список порталов (пустой) → создать ссылку → скопировать → открыть в другой вкладке. Expected: StudentHomeScreen ученика.

- [ ] **Step 5: Commit**

```bash
git add src/features/students/StudentEditScreen.jsx
git commit -m "feat(students): add portal management section in StudentEditScreen"
```

---

## Task 13: Назначить активное задание из StudentEditScreen

**Files:**
- Modify: `src/features/students/StudentEditScreen.jsx`

Добавить кнопки «Назначить» / «Снять» рядом с назначенными темами.

- [ ] **Step 1: Понять где в StudentEditScreen отображаются темы ученика**

  Прочитать `src/features/students/StudentEditScreen.jsx` — найти где рендерятся `studentTopicLinks` или список тем ученика. Это может быть в другом компоненте (например, `StudentTopicsSection`). Определить точное место.

- [ ] **Step 2: Добавить состояние `activeTaskLocal`**

```jsx
const [activeTaskLocal, setActiveTaskLocal] = useState(null);
// { topicId, modeId }
```

- [ ] **Step 3: Добавить функцию**

```jsx
async function handleSetActiveTask(topicId) {
  const isSame = activeTaskLocal?.topicId === topicId;
  const next = isSame ? null : { topicId, modeId: null };
  await api.patch(`/students/${initial.id}/active-task`, next ?? { topicId: null, modeId: null });
  setActiveTaskLocal(next);
}
```

- [ ] **Step 4: Рядом с каждой назначенной темой добавить кнопку**

  (Точное место зависит от структуры компонента — найти в Step 1.)

```jsx
<button
  type="button"
  style={{
    fontSize: 11, padding: "3px 8px", borderRadius: 6, border: "none", cursor: "pointer",
    background: activeTaskLocal?.topicId === link.topic_id ? "#dbeafe" : "#f3f4f6",
    color: activeTaskLocal?.topicId === link.topic_id ? "#1d4ed8" : "#6b7280",
    fontWeight: 600,
  }}
  onClick={() => handleSetActiveTask(link.topic_id)}
>
  {activeTaskLocal?.topicId === link.topic_id ? "✓ Активно" : "Назначить"}
</button>
```

- [ ] **Step 5: Проверить в браузере**

  Назначить активную тему → открыть портальную ссылку ученика → убедиться что карточка «Задание сейчас» показывает правильную тему.

- [ ] **Step 6: Commit**

```bash
git add src/features/students/StudentEditScreen.jsx
git commit -m "feat(students): add active task assignment buttons"
```

---

## Task 14: Final deploy + smoke test

- [ ] **Step 1: Build и deploy**

```bash
npm run deploy:prod
```

- [ ] **Step 2: Verify production**

```bash
npm run deploy:verify
```

- [ ] **Step 3: End-to-end smoke test на production**

  1. Войти в логопедский аккаунт на https://mirocard.kaplieva.help/
  2. Открыть карточку ученика → «Доступ» → создать ссылку
  3. Скопировать и открыть в режиме инкогнито (или на телефоне)
  4. Убедиться: StudentHomeScreen отображается с именем ученика
  5. Назначить тему — убедиться что карточка «Задание сейчас» обновилась
  6. Тапнуть «Начать» — убедиться что открывается сессионный экран
  7. Пройти сессию — убедиться что результат сохранился в истории логопеда

---

## Self-Review

### Spec coverage

| Требование из спека | Задача |
|---|---|
| Таблица `student_portals` | Task 2 |
| DB-функции (create, find, revoke, list, active-task) | Task 3–4 |
| `requireStudentPortal` middleware | Task 5 |
| `GET /student/me` | Task 5 |
| `POST /student/session` | Task 5 |
| `POST /students/:id/portal` | Task 5 |
| `DELETE /students/:id/portal/:pid` | Task 5 |
| `GET /students/:id/portals` | Task 5 |
| `PATCH /students/:id/active-task` | Task 5 |
| Guard clause в App.jsx (URL + localStorage) | Task 7 |
| StudentApp mini-router | Task 9 |
| useStudentPortal hook | Task 8 |
| StudentHomeScreen (градиент, активная карточка, список) | Task 10 |
| Секция «Доступ» в StudentEditScreen | Task 12 |
| Кнопки «Назначить» / «Снять» | Task 13 |
| Существующие экраны не тронуты | Verified: ModePickerScreen, SessionScreen, ParamsScreen, SessionSummary — не изменяются |
| ErrorScreen при 401 | Task 9 (ErrorScreen в StudentApp) |
| LoadingScreen | Task 9 |

### Что НЕ входит в Phase 1 (Phase 2)

- `shopping_live_state`, real-time polling
- `StudentShoppingScreen`
- Live-панель наблюдения для логопеда
- Push-уведомления

### Потенциальные риски

1. **`api.get` сигнатура** — Task 8 требует проверки. Если `api` не принимает custom headers, нужно либо адаптировать `api`, либо использовать `fetch` напрямую с `Bearer <portalToken>`.

2. **`appendSession` signature** — Task 5, handler `handleStudentSession`. Проверить что поля совпадают с ожидаемыми в `account-repository.mjs:appendSession`.

3. **Темы в StudentHomeScreen** — `BUILTIN_TOPIC_META` в Task 10 содержит только `shopping_v1` и `opposites_v1`. По мере добавления новых тем — дополнять этот маппинг. Для неизвестных тем есть generic fallback.

4. **Место кнопок «Назначить»** в Task 13 — точная локация зависит от внутренней структуры StudentEditScreen. Task 13, Step 1 явно требует её найти перед добавлением кода.
