# Фото на шагах инструкций — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Дать родителю/логопеду прикреплять фото к каждому шагу в Конструкторе инструкций, с автоматическим клиентским сжатием в WebP и синхронизацией фото между устройствами через новый backend-эндпоинт.

**Architecture:** Шаг инструкции меняет форму с `string` на `{text: string, photo: string | null}` — для встроенных и пользовательских инструкций одинаково. Клиент сжимает фото в WebP (`createImageBitmap` + `OffscreenCanvas`, по образцу `resizeToBlob` из `plannerPhotos.js`) и грузит на новый `POST /photos` (переиспользует уже существующую `extractAndStorePhoto`/таблицу `photos`, использующуюся сейчас только для фото ученика), получая обратно короткую ссылку `/api/photos/<hash>` — именно эта ссылка, а не сама картинка, сохраняется в шаге и синкается через существующий `kv.upsert`.

**Tech Stack:** React 19, Vitest, Node `http`/`node:test` (backend), `OffscreenCanvas`/`createImageBitmap` (client image compression), SQLite (`better-sqlite3`-совместимый `node:sqlite`).

## Global Constraints

- Формат сжатия — WebP, максимум 640px по длинной стороне, quality 0.72; fallback на JPEG, если WebP-кодирование недоступно.
- Ручного лимита-отказа «файл слишком большой» пользователю не показываем — сжатие делает это ненужным.
- Backend-эндпоинт защищён `requireAuth`, но сама запись в таблицу `photos` не привязана к аккаунту (контент-адресуема по sha256, как уже сделано для фото ученика).
- Новых таблиц/миграций БД не требуется — `photos` уже существует (`backend/lib/db.mjs`).
- Backend не деплоится через `npm run deploy:prod` — после реализации нужен отдельный ручной шаг деплоя backend (см. `DEPLOYMENT.md`), не входит в этот план.
- Дизайн: `docs/superpowers/specs/2026-07-13-instruction-step-photos-design.md`.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/topics/builtinInstructions.js` | Меняется: `extractSteps` возвращает `{text, photo: null}[]` |
| `src/features/instructions/instructionValidation.js` | Меняется: валидирует `step.text` вместо сырой строки |
| `src/features/instructions/instructionPhotoUpload.js` | Новый: клиентское сжатие в WebP + загрузка на `/photos`, возвращает URL |
| `src/features/instructions/InstructionConstructorScreen.jsx` | Меняется: шаги — объекты `{text, photo}`, фото-слот на каждый шаг, блокировка Save во время загрузки |
| `src/features/instructions/InstructionRunnerScreen.jsx` | Меняется: рендерит `step.photo` изображением, если есть |
| `src/features/instructions/instructions.css` | Меняется: стили фото-слота в Конструкторе |
| `backend/server.mjs` | Меняется: `handleUploadPhoto` + роут `POST /photos` |
| `backend/tests/account-repository.test.mjs` | Меняется: regression-тест на `extractAndStorePhoto`/`getPhoto` |

---

### Task 1: Форма шага `{text, photo}` во встроенных инструкциях

**Files:**
- Modify: `src/topics/builtinInstructions.js`
- Modify: `src/topics/builtinInstructions.test.js`

**Interfaces:**
- Produces: `BUILTIN_INSTRUCTIONS[].steps` теперь `Array<{text: string, photo: null}>` вместо `string[]` — потребляется всеми остальными задачами этого плана.

- [ ] **Step 1: Обновить тест под новую форму шага**

В `src/topics/builtinInstructions.test.js` заменить:

```js
    expect(kitchen.steps.length).toBe(11);
```

на:

```js
    expect(kitchen.steps).toHaveLength(11);
    expect(kitchen.steps[0]).toEqual({
      text: 'Унести всю грязную посуду со столов в раковину.',
      photo: null,
    });
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `npx vitest run src/topics/builtinInstructions.test.js`
Expected: FAIL — `kitchen.steps[0]` это строка, а не объект с полем `text`.

- [ ] **Step 3: Обновить `extractSteps`**

В `src/topics/builtinInstructions.js` заменить:

```js
function extractSteps(txt) {
  const steps = [];
  for (const rawLine of txt.split('\n')) {
    const match = rawLine.trim().match(/^\d+\.\s*(.+)$/);
    if (match) steps.push(match[1].trim());
  }
  return steps;
}
```

на:

```js
function extractSteps(txt) {
  const steps = [];
  for (const rawLine of txt.split('\n')) {
    const match = rawLine.trim().match(/^\d+\.\s*(.+)$/);
    if (match) steps.push({ text: match[1].trim(), photo: null });
  }
  return steps;
}
```

- [ ] **Step 4: Запустить тест — убедиться, что проходит**

Run: `npx vitest run src/topics/builtinInstructions.test.js`
Expected: PASS

- [ ] **Step 5: Коммит**

```bash
git add src/topics/builtinInstructions.js src/topics/builtinInstructions.test.js
git commit -m "feat(instructions): steps carry {text, photo} instead of plain strings"
```

---

### Task 2: Валидация под новую форму шага

**Files:**
- Modify: `src/features/instructions/instructionValidation.js`
- Modify: `src/features/instructions/instructionValidation.test.js`

**Interfaces:**
- Consumes: черновик вида `{title: string, steps: Array<{text: string, photo?: string|null}>}`.
- Produces: `validateInstructionDraft(draft) -> {valid: boolean, errors: {title?: string, steps?: string}}` — сигнатура не меняется, меняется только то, как читается текст шага (`step.text` вместо `step`).

- [ ] **Step 1: Переписать тест под объекты-шаги**

Заменить содержимое `src/features/instructions/instructionValidation.test.js` целиком:

```js
import { describe, it, expect } from 'vitest';
import { validateInstructionDraft } from './instructionValidation.js';

describe('validateInstructionDraft', () => {
  it('is valid with a title and at least one non-empty step', () => {
    const result = validateInstructionDraft({
      title: 'Собираем портфель',
      steps: [{ text: 'Найди дневник', photo: null }],
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it('rejects an empty or whitespace-only title', () => {
    expect(validateInstructionDraft({ title: '', steps: [{ text: 'Шаг', photo: null }] }).valid).toBe(false);
    expect(validateInstructionDraft({ title: '   ', steps: [{ text: 'Шаг', photo: null }] }).errors.title).toBeTruthy();
  });

  it('rejects when every step is empty or whitespace-only', () => {
    const result = validateInstructionDraft({
      title: 'Название',
      steps: [{ text: '', photo: null }, { text: '   ', photo: null }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.steps).toBeTruthy();
  });

  it('rejects an empty steps array', () => {
    const result = validateInstructionDraft({ title: 'Название', steps: [] });
    expect(result.valid).toBe(false);
    expect(result.errors.steps).toBeTruthy();
  });

  it('is valid when at least one step has real text even if others are blank', () => {
    const result = validateInstructionDraft({
      title: 'Название',
      steps: [{ text: '', photo: null }, { text: 'Реальный шаг', photo: null }, { text: '  ', photo: null }],
    });
    expect(result.valid).toBe(true);
  });
});
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `npx vitest run src/features/instructions/instructionValidation.test.js`
Expected: FAIL — `s.trim is not a function` (текущий код вызывает `.trim()` прямо на объекте-шаге).

- [ ] **Step 3: Обновить `validateInstructionDraft`**

Заменить в `src/features/instructions/instructionValidation.js`:

```js
  const nonEmptySteps = (draft.steps ?? []).map((s) => s.trim()).filter(Boolean);
```

на:

```js
  const nonEmptySteps = (draft.steps ?? []).map((s) => s.text.trim()).filter(Boolean);
```

- [ ] **Step 4: Запустить тест — убедиться, что проходит**

Run: `npx vitest run src/features/instructions/instructionValidation.test.js`
Expected: PASS

- [ ] **Step 5: Коммит**

```bash
git add src/features/instructions/instructionValidation.js src/features/instructions/instructionValidation.test.js
git commit -m "feat(instructions): validate step.text instead of a raw string"
```

---

### Task 3: Регресс-тест CRUD под новую форму шага

**Files:**
- Modify: `src/features/instructions/instructionsApi.test.js`

**Interfaces:**
- Не меняет `instructionsApi.js` — CRUD-функции уже нейтральны к форме `steps` (просто прокидывают их как есть), эта задача фиксирует новую форму данных в тестах как регресс-барьер.

- [ ] **Step 1: Переписать тест под объекты-шаги**

Заменить содержимое `src/features/instructions/instructionsApi.test.js` целиком:

```js
import { describe, it, expect, beforeEach } from 'vitest';
import { getDb, kv } from '@/core/db';
import {
  getUserInstructions, addInstruction, updateInstruction, deleteInstruction, getAllInstructions,
} from './instructionsApi.js';

beforeEach(async () => {
  const db = await getDb();
  await kv.set(db, 'user_instructions', []);
});

describe('getUserInstructions', () => {
  it('returns an empty array when nothing is saved', async () => {
    expect(await getUserInstructions()).toEqual([]);
  });
});

describe('addInstruction', () => {
  it('creates an instruction with a generated id and builtin:false', async () => {
    const created = await addInstruction({
      title: 'Собираем портфель',
      emoji: '🎒',
      steps: [{ text: 'Найди дневник', photo: null }],
    });
    expect(created.id).toBeTruthy();
    expect(created.builtin).toBe(false);
    expect(created.title).toBe('Собираем портфель');
    expect(created.steps).toEqual([{ text: 'Найди дневник', photo: null }]);

    const all = await getUserInstructions();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe(created.id);
  });
});

describe('updateInstruction', () => {
  it('updates title, emoji, and steps (including photo) by id', async () => {
    const created = await addInstruction({
      title: 'Старое имя',
      emoji: '📦',
      steps: [{ text: 'Шаг 1', photo: null }],
    });
    const updated = await updateInstruction(created.id, {
      title: 'Новое имя',
      emoji: '🧦',
      steps: [
        { text: 'Шаг 1', photo: '/api/photos/abc123' },
        { text: 'Шаг 2', photo: null },
      ],
    });
    expect(updated.title).toBe('Новое имя');
    expect(updated.emoji).toBe('🧦');
    expect(updated.steps).toEqual([
      { text: 'Шаг 1', photo: '/api/photos/abc123' },
      { text: 'Шаг 2', photo: null },
    ]);
  });

  it('leaves other instructions untouched', async () => {
    const a = await addInstruction({ title: 'A', emoji: '🅰️', steps: [{ text: '1', photo: null }] });
    const b = await addInstruction({ title: 'B', emoji: '🅱️', steps: [{ text: '1', photo: null }] });
    await updateInstruction(a.id, { title: 'A2', emoji: '🅰️', steps: [{ text: '1', photo: null }] });
    const all = await getUserInstructions();
    expect(all.find((i) => i.id === b.id).title).toBe('B');
  });
});

describe('deleteInstruction', () => {
  it('removes the instruction by id', async () => {
    const created = await addInstruction({ title: 'Удалить меня', emoji: '🗑️', steps: [{ text: '1', photo: null }] });
    await deleteInstruction(created.id);
    expect(await getUserInstructions()).toEqual([]);
  });
});

describe('getAllInstructions', () => {
  it('merges built-in and user instructions', async () => {
    await addInstruction({ title: 'Своя', emoji: '⭐', steps: [{ text: '1', photo: null }] });
    const all = await getAllInstructions();
    expect(all.some((i) => i.id === 'kitchen_cleaning')).toBe(true);
    expect(all.some((i) => i.title === 'Своя')).toBe(true);
  });
});
```

- [ ] **Step 2: Запустить тест — убедиться, что проходит сразу**

Run: `npx vitest run src/features/instructions/instructionsApi.test.js`
Expected: PASS (CRUD-функции уже форма-агностичны, изменения только в тестовых данных — это регресс-барьер, а не новая логика).

- [ ] **Step 3: Коммит**

```bash
git add src/features/instructions/instructionsApi.test.js
git commit -m "test(instructions): lock instructionsApi CRUD to the {text, photo} step shape"
```

---

### Task 4: Backend — `POST /photos` (загрузка и получение ссылки)

**Files:**
- Modify: `backend/tests/account-repository.test.mjs`
- Modify: `backend/server.mjs`

**Interfaces:**
- Consumes: существующие `extractAndStorePhoto(db, dataUrl) -> string`, `getPhoto(db, hash) -> {content_type, data} | null` (`backend/lib/account-repository.mjs`, уже реализованы, не меняются); `readRawBody(request, maxBytes) -> Promise<Buffer>`, `writeJson(res, status, payload)`, `requireAuth(req) -> account` (`backend/server.mjs`, уже существуют).
- Produces: HTTP `POST /photos` (внешне `/api/photos`, авторизация Bearer-токеном) — тело `{dataUrl: string}`, ответ `200 {url: string}` вида `/api/photos/<hash>`. Потребляется `instructionPhotoUpload.js` (Task 5).

- [ ] **Step 1: Добавить regression-тест на `extractAndStorePhoto`/`getPhoto`**

Эти функции уже существуют и используются для фото ученика, но не имеют собственного теста — эндпоинт из шага 3 будет целиком на них полагаться. Добавить в `backend/tests/account-repository.test.mjs`:

В блок импорта (в начале файла) добавить `extractAndStorePhoto` и `getPhoto`:

```js
import {
  createAccount,
  findAccountByEmail,
  findAccountByEmailAny,
  findAccountById,
  updateAccount,
  deleteAccount,
  activateAccount,
  storeAuthToken,
  findAccountByToken,
  deleteAuthToken,
  createPasswordResetToken,
  consumePasswordResetToken,
  createEmailVerificationToken,
  consumeEmailVerificationToken,
  serializeAccount,
  extractAndStorePhoto,
  getPhoto,
} from "../lib/account-repository.mjs";
```

В конец файла добавить:

```js
test("extractAndStorePhoto stores a data URL and returns a stable /api/photos/<hash> URL", () => {
  const db = makeDb();
  const url = extractAndStorePhoto(db, "data:image/webp;base64,AAAA");
  assert.match(url, /^\/api\/photos\/[0-9a-f]{32}$/);
  const hash = url.split("/").at(-1);
  const stored = getPhoto(db, hash);
  assert.equal(stored.content_type, "image/webp");
  assert.equal(stored.data, "AAAA");
});

test("extractAndStorePhoto dedupes identical content to the same hash", () => {
  const db = makeDb();
  const first = extractAndStorePhoto(db, "data:image/webp;base64,BBBB");
  const second = extractAndStorePhoto(db, "data:image/webp;base64,BBBB");
  assert.equal(first, second);
});

test("getPhoto returns null for an unknown hash", () => {
  const db = makeDb();
  assert.equal(getPhoto(db, "does-not-exist"), null);
});
```

- [ ] **Step 2: Запустить тест — убедиться, что проходит**

Run: `cd backend && npm test`
Expected: PASS (эти функции уже реализованы и рабочие — это тест уже существующего поведения, не новой логики, поэтому сразу зелёный, без красного шага).

- [ ] **Step 3: Добавить `extractAndStorePhoto` в импорты `server.mjs`**

В `backend/server.mjs` заменить:

```js
  getPhoto, migratePhotoData,
  getAccountKvByPrefixes,
} from "./lib/account-repository.mjs";
```

на:

```js
  getPhoto, migratePhotoData, extractAndStorePhoto,
  getAccountKvByPrefixes,
} from "./lib/account-repository.mjs";
```

- [ ] **Step 4: Добавить обработчик загрузки фото**

В `backend/server.mjs`, сразу перед существующим `handleGetPhoto` (найти `// ─── Photo handler`):

```js
// ─── Photo handler ─────────────────────────────────────────────────────────────

async function handleUploadPhoto(req, res) {
  requireAuth(req);
  const raw = await readRawBody(req, 4 * 1024 * 1024);
  const body = JSON.parse(raw.toString("utf8"));
  if (!body?.dataUrl) return writeJson(res, 400, { error: "dataUrl required" });
  const url = extractAndStorePhoto(db, body.dataUrl);
  writeJson(res, 200, { url });
}

async function handleGetPhoto(req, res) {
```

(удалить старую строку `async function handleGetPhoto(req, res) {` из её прежнего места — итог: `handleUploadPhoto` объявлена перед `handleGetPhoto`, тело `handleGetPhoto` не меняется).

- [ ] **Step 5: Зарегистрировать роут**

В `backend/server.mjs` заменить:

```js
    // Photos (content-addressable, no auth required)
    if (method === "GET"    && /^\/photos\/[^/]+$/.test(p))       return await handleGetPhoto(req, res);
```

на:

```js
    // Photos (upload requires auth; read is content-addressable, no auth required)
    if (method === "POST"   && p === "/photos")                   return await handleUploadPhoto(req, res);
    if (method === "GET"    && /^\/photos\/[^/]+$/.test(p))       return await handleGetPhoto(req, res);
```

- [ ] **Step 6: Ручная проверка**

Запустить backend локально (`cd backend && node --env-file=.env server.mjs`, либо использовать уже настроенный dev-процесс) и в отдельном терминале:

```bash
curl -s -X POST http://localhost:3012/api/photos \
  -H "Authorization: Bearer <ваш действующий токен>" \
  -H "Content-Type: application/json" \
  -d '{"dataUrl":"data:image/webp;base64,AAAA"}'
```

Expected: `{"url":"/api/photos/<32-символьный хэш>"}`. Затем:

```bash
curl -s -o /tmp/test-photo.webp -w "%{http_code}\n" http://localhost:3012/api/photos/<хэш из ответа>
```

Expected: `200`.

- [ ] **Step 7: Коммит**

```bash
git add backend/server.mjs backend/tests/account-repository.test.mjs
git commit -m "feat(backend): add POST /photos upload endpoint for instruction step photos"
```

---

### Task 5: Клиентский оптимизатор + загрузка фото

**Files:**
- Create: `src/features/instructions/instructionPhotoUpload.js`

**Interfaces:**
- Consumes: `api.post(path, body)` (`@/core/api`, уже существует).
- Produces: `uploadInstructionPhoto(file: File) -> Promise<string>` — сжимает в WebP, грузит на `POST /photos`, возвращает URL вида `/api/photos/<hash>`; кидает `Error` при неудаче (битый файл или сбой сети/сервера). Потребляется `InstructionConstructorScreen.jsx` (Task 6).

Без юнит-теста: в проекте нет прецедента тестирования canvas/`OffscreenCanvas`-кода (`resizeToBlob` в `plannerPhotos.js` тоже без теста), в vitest+jsdom декодирование изображений через `createImageBitmap` ненадёжно. Проверяется вручную вместе с Task 6/7 в финальной сквозной проверке.

- [ ] **Step 1: Написать файл**

Создать `src/features/instructions/instructionPhotoUpload.js`:

```js
import { api } from "@/core/api";

const MAX_DIMENSION = 640;
const WEBP_QUALITY = 0.72;

async function optimizePhotoToWebp(file) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("Не удалось обработать фото");
  }
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = new OffscreenCanvas(width, height);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, width, height);
  try {
    return await canvas.convertToBlob({ type: "image/webp", quality: WEBP_QUALITY });
  } catch {
    return await canvas.convertToBlob({ type: "image/jpeg", quality: WEBP_QUALITY });
  }
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Compresses a photo to WebP client-side, uploads it, and returns the short /api/photos/<hash> URL to persist on the step. */
export async function uploadInstructionPhoto(file) {
  const optimized = await optimizePhotoToWebp(file);
  const dataUrl = await blobToDataUrl(optimized);
  const { url } = await api.post("/photos", { dataUrl });
  return url;
}
```

- [ ] **Step 2: Проверить сборку**

Run: `npm run build`
Expected: сборка проходит без ошибок (файл пока нигде не импортируется — просто проверяем валидность синтаксиса/модуля).

- [ ] **Step 3: Коммит**

```bash
git add src/features/instructions/instructionPhotoUpload.js
git commit -m "feat(instructions): add client-side WebP photo optimizer + upload helper"
```

---

### Task 6: Фото-слот в Конструкторе

**Files:**
- Modify: `src/features/instructions/InstructionConstructorScreen.jsx`
- Modify: `src/features/instructions/instructions.css`

**Interfaces:**
- Consumes: `uploadInstructionPhoto(file) -> Promise<string>` (Task 5); `validateInstructionDraft({title, steps}) -> {valid, errors}` (Task 2, уже принимает `steps` как `{text, photo}[]`); `addInstruction`/`updateInstruction` (`instructionsApi.js`, форма-агностичны).
- Produces: экран сохраняет инструкции с шагами `{text, photo}[]`, где `photo` — либо `null`, либо URL с backend.

- [ ] **Step 1: Импорты и начальное состояние шагов**

В `src/features/instructions/InstructionConstructorScreen.jsx` заменить:

```js
import {
  getUserInstructions, addInstruction, updateInstruction, deleteInstruction, pullUserInstructionsFromServer,
} from "./instructionsApi";
import { validateInstructionDraft } from "./instructionValidation";
import { BackArrowIcon } from "@/shared/components/ArrowIcons";
import Button from "@/shared/components/Button";
import "./instructions.css";
```

на:

```js
import { useRef } from "react";
import {
  getUserInstructions, addInstruction, updateInstruction, deleteInstruction, pullUserInstructionsFromServer,
} from "./instructionsApi";
import { validateInstructionDraft } from "./instructionValidation";
import { uploadInstructionPhoto } from "./instructionPhotoUpload";
import { BackArrowIcon } from "@/shared/components/ArrowIcons";
import Button from "@/shared/components/Button";
import "./instructions.css";
```

(добавить `useRef` и в существующий `import { useEffect, useState } from "react";` — итоговая первая строка файла: `import { useEffect, useState, useRef } from "react";`).

Заменить:

```js
  const [steps, setSteps] = useState([""]);
```

на:

```js
  const [steps, setSteps] = useState([{ text: "", photo: null }]);
  const [uploadingSteps, setUploadingSteps] = useState(() => new Set());
  const [photoErrors, setPhotoErrors] = useState({});
  const photoInputRefs = useRef([]);
```

- [ ] **Step 2: Загрузка существующей инструкции при редактировании**

Заменить:

```js
        setSteps(existing.steps.length ? existing.steps : [""]);
```

на:

```js
        setSteps(existing.steps.length ? existing.steps : [{ text: "", photo: null }]);
```

- [ ] **Step 3: Обновить хелперы работы со списком шагов**

Заменить:

```js
  function updateStep(index, value) {
    setSteps((s) => s.map((step, i) => (i === index ? value : step)));
  }

  function addStep() {
    setSteps((s) => [...s, ""]);
  }
```

на:

```js
  function updateStepText(index, value) {
    setSteps((s) => s.map((step, i) => (i === index ? { ...step, text: value } : step)));
  }

  function setStepPhoto(index, photo) {
    setSteps((s) => s.map((step, i) => (i === index ? { ...step, photo } : step)));
  }

  function addStep() {
    setSteps((s) => [...s, { text: "", photo: null }]);
  }
```

- [ ] **Step 4: Добавить обработчик выбора файла фото**

Добавить сразу после `moveStep`:

```js
  async function handlePhotoSelect(index, file) {
    if (!file) return;
    setUploadingSteps((s) => new Set(s).add(index));
    setPhotoErrors((e) => ({ ...e, [index]: null }));
    try {
      const url = await uploadInstructionPhoto(file);
      setStepPhoto(index, url);
    } catch {
      setPhotoErrors((e) => ({ ...e, [index]: "Не удалось загрузить фото" }));
    } finally {
      setUploadingSteps((s) => {
        const next = new Set(s);
        next.delete(index);
        return next;
      });
    }
  }
```

- [ ] **Step 5: Обновить `handleSave` под новую форму шагов**

Заменить:

```js
    const cleanSteps = steps.map((s) => s.trim()).filter(Boolean);
```

на:

```js
    const cleanSteps = steps
      .map((s) => ({ text: s.text.trim(), photo: s.photo }))
      .filter((s) => s.text);
```

- [ ] **Step 6: Блокировать «Сохранить» во время загрузки фото**

Заменить:

```js
        <Button variant="primary" onClick={handleSave} disabled={saving}>Сохранить</Button>
```

на:

```js
        <Button variant="primary" onClick={handleSave} disabled={saving || uploadingSteps.size > 0}>Сохранить</Button>
```

- [ ] **Step 7: Переписать разметку шага с фото-слотом**

Заменить блок рендера шагов:

```jsx
            {steps.map((step, i) => (
              <div className="cn-step-row" key={i}>
                <div className="cn-step-arrows">
                  <button type="button" disabled={i === 0} onClick={() => moveStep(i, -1)} aria-label="Сдвинуть вверх">↑</button>
                  <button type="button" disabled={i === steps.length - 1} onClick={() => moveStep(i, 1)} aria-label="Сдвинуть вниз">↓</button>
                </div>
                <div className="cn-step-num">{i + 1}</div>
                <textarea
                  className="cn-step-text"
                  value={step}
                  onChange={(e) => updateStep(i, e.target.value)}
                  placeholder="Что нужно сделать на этом шаге?"
                />
                <button
                  type="button"
                  className="cn-step-del"
                  onClick={() => removeStep(i)}
                  aria-label="Удалить шаг"
                  disabled={steps.length === 1}
                >
                  ✕
                </button>
              </div>
            ))}
```

на:

```jsx
            {steps.map((step, i) => (
              <div className="cn-step-row" key={i}>
                <div className="cn-step-arrows">
                  <button type="button" disabled={i === 0} onClick={() => moveStep(i, -1)} aria-label="Сдвинуть вверх">↑</button>
                  <button type="button" disabled={i === steps.length - 1} onClick={() => moveStep(i, 1)} aria-label="Сдвинуть вниз">↓</button>
                </div>
                <div className="cn-step-num">{i + 1}</div>
                <div className="cn-step-main">
                  <textarea
                    className="cn-step-text"
                    value={step.text}
                    onChange={(e) => updateStepText(i, e.target.value)}
                    placeholder="Что нужно сделать на этом шаге?"
                  />
                  <div className="cn-step-photo">
                    {step.photo ? (
                      <div className="cn-step-photo__preview">
                        <img src={step.photo} alt="" />
                        <button
                          type="button"
                          className="cn-step-photo__remove"
                          onClick={() => setStepPhoto(i, null)}
                          aria-label="Удалить фото"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="cn-step-photo__add"
                        onClick={() => photoInputRefs.current[i]?.click()}
                        disabled={uploadingSteps.has(i)}
                        aria-label="Добавить фото"
                      >
                        {uploadingSteps.has(i) ? "…" : "📷"}
                      </button>
                    )}
                    <input
                      ref={(el) => { photoInputRefs.current[i] = el; }}
                      type="file"
                      accept="image/*"
                      style={{ display: "none" }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        handlePhotoSelect(i, file);
                      }}
                    />
                  </div>
                  {photoErrors[i] && (
                    <div className="cn-error">
                      {photoErrors[i]}{" "}
                      <button
                        type="button"
                        className="cn-step-photo__retry"
                        onClick={() => photoInputRefs.current[i]?.click()}
                      >
                        Повторить
                      </button>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  className="cn-step-del"
                  onClick={() => removeStep(i)}
                  aria-label="Удалить шаг"
                  disabled={steps.length === 1}
                >
                  ✕
                </button>
              </div>
            ))}
```

- [ ] **Step 8: Стили фото-слота**

В `src/features/instructions/instructions.css` заменить правило `.cn-step-text`:

```css
.cn-step-text {
  flex: 1; border-radius: 14px; border: 1.5px solid #e7dccf; background: #fff;
  padding: 11px 12px; font-family: inherit; font-size: 14.5px; font-weight: 600; color: #263131;
  resize: none; min-height: 44px; line-height: 1.35;
}
```

на:

```css
.cn-step-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.cn-step-text {
  width: 100%; box-sizing: border-box; border-radius: 14px; border: 1.5px solid #e7dccf; background: #fff;
  padding: 11px 12px; font-family: inherit; font-size: 14.5px; font-weight: 600; color: #263131;
  resize: none; min-height: 44px; line-height: 1.35;
}

.cn-step-photo { display: flex; align-items: center; }

.cn-step-photo__add {
  width: 40px; height: 40px; border-radius: 12px;
  border: 1.5px dashed rgba(74, 155, 143, 0.45);
  background: rgba(74, 155, 143, 0.06); color: #276b62; font-size: 16px;
  display: flex; align-items: center; justify-content: center; cursor: pointer;
}
.cn-step-photo__add:disabled { opacity: 0.5; cursor: default; }

.cn-step-photo__preview {
  position: relative;
  width: 56px; height: 56px; border-radius: 12px; overflow: hidden;
  border: 1.5px solid #e7dccf;
}
.cn-step-photo__preview img { width: 100%; height: 100%; object-fit: cover; display: block; }

.cn-step-photo__remove {
  position: absolute; top: 2px; right: 2px; width: 18px; height: 18px; border-radius: 50%;
  background: rgba(38, 49, 49, 0.72); color: #fff; border: none; font-size: 10px; line-height: 1;
  display: flex; align-items: center; justify-content: center; cursor: pointer;
}

.cn-step-photo__retry {
  border: none; background: none; color: #e05252; font-weight: 800; font-size: 12px;
  text-decoration: underline; cursor: pointer; padding: 0;
}
```

- [ ] **Step 9: Проверить сборку**

Run: `npm run build`
Expected: сборка проходит без ошибок.

- [ ] **Step 10: Коммит**

```bash
git add src/features/instructions/InstructionConstructorScreen.jsx src/features/instructions/instructions.css
git commit -m "feat(instructions): per-step photo picker in the Constructor"
```

---

### Task 7: Показ фото шага в Runner

**Files:**
- Modify: `src/features/instructions/InstructionRunnerScreen.jsx`

**Interfaces:**
- Consumes: `instruction.steps[i]` теперь `{text, photo}` (Task 1).

- [ ] **Step 1: Читать текущий шаг как объект**

Заменить:

```jsx
      <div key={stepIndex} className="instruction-step">
        <div className="instruction-step-text">{splitSentences(steps[stepIndex])}</div>
      </div>
```

на:

```jsx
      <div key={stepIndex} className="instruction-step">
        <div className="instruction-step-text">{splitSentences(steps[stepIndex].text)}</div>
        {steps[stepIndex].photo && (
          <img
            className="instruction-step-img instruction-step-img--inline"
            src={steps[stepIndex].photo}
            alt=""
          />
        )}
      </div>
```

(классы `.instruction-step-img`/`.instruction-step-img--inline` уже определены в `src/styles.css` и используются рецептами для точно такого же случая — новых стилей не требуется).

- [ ] **Step 2: Проверить сборку**

Run: `npm run build`
Expected: сборка проходит без ошибок.

- [ ] **Step 3: Коммит**

```bash
git add src/features/instructions/InstructionRunnerScreen.jsx
git commit -m "feat(instructions): render step photo in the Runner"
```

---

### Task 8: Полный прогон тестов и сквозная проверка

**Files:** нет (только проверка)

- [ ] **Step 1: Полный прогон фронтенд-тестов раздела**

Run: `npx vitest run src/core/store.test.js src/topics/builtinInstructions.test.js src/features/instructions/instructionValidation.test.js src/features/instructions/instructionsApi.test.js`
Expected: все тесты зелёные.

- [ ] **Step 2: Прогон backend-тестов**

Run: `cd backend && npm test`
Expected: все тесты зелёные (включая новые из Task 4; остальные backend-тесты как были).

- [ ] **Step 3: Сборка**

Run: `npm run build`
Expected: без ошибок.

- [ ] **Step 4: Ручная сквозная проверка**

Требует запущенного локально backend (с новым эндпоинтом из Task 4) и `npm run dev`:

- Открыть Конструктор (за PIN), у шага нажать «📷», выбрать фото — должен появиться превью-квадрат с крестиком, кнопка «Сохранить» на время загрузки неактивна.
- Сохранить инструкцию, открыть её в Runner — на шаге с фото должна показаться картинка под текстом.
- Вернуться в Конструктор, редактировать тот же шаг — крестиком удалить фото, сохранить — в Runner фото пропадает.
- Отключить backend/сеть и попробовать прикрепить фото — должна появиться инлайн-ошибка «Не удалось загрузить фото» с кнопкой «Повторить», остальная форма (текст, другие шаги) при этом остаётся редактируемой и сохраняемой.

Это финальная ручная проверка — если что-то не совпадает с ожиданием, соответствующая задача выше требует доработки перед тем, как считать план выполненным.

---

## Self-Review

**Spec coverage** — каждый раздел `docs/superpowers/specs/2026-07-13-instruction-step-photos-design.md` покрыт:
- Модель данных `{text, photo}` → Task 1 (встроенные), Task 6 (пользовательские).
- Backend `POST /photos`, переиспользование `extractAndStorePhoto`/`photos` → Task 4.
- Клиентская оптимизация в WebP 640px/0.72 → Task 5.
- UI Конструктора (один фото-слот, блокировка Save, ошибка+retry) → Task 6.
- UI Runner (`.instruction-step-img--inline`) → Task 7.
- Тестирование (фронт — да, backend lib-слой — да, HTTP-хендлер и canvas-оптимизатор — вручную, как и оговорено в спеке) → Task 4, 5, 8.
- «Вне рамок» (синтаксис фото в txt, очистка осиротевших фото, лимит количества) — сознательно не реализуются, задач под них нет.

**Placeholder scan** — плейсхолдеров, TODO, «добавить обработку ошибок» без кода не найдено; каждый шаг содержит готовый код или точную команду.

**Type consistency** — форма шага `{text: string, photo: string | null}` одинакова во всех задачах (`builtinInstructions.js`, `instructionValidation.js`, `instructionsApi.test.js`, `InstructionConstructorScreen.jsx`, `InstructionRunnerScreen.jsx`). Имя `uploadInstructionPhoto` и его сигнатура (`file -> Promise<string>`) совпадают в Task 5 (объявление) и Task 6 (использование). Название хендлера `handleUploadPhoto` и путь `/photos` совпадают в объявлении и регистрации роута (Task 4).
