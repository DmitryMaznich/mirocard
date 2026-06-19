# Student Portal — Design Spec

**Date:** 2026-06-14 (updated 2026-06-19)
**Status:** Approved

## Overview

Mirocard — приложение для логопеда. Логопед работает с ним как сейчас: ученики, темы, аналитика. Новая возможность: логопед создаёт портальную ссылку для ученика. Ученик открывает **то же самое приложение** по этой ссылке — в «режиме ученика». Режим ученика: упрощённая навигация (новый StudentHomeScreen), только назначенные темы, сессии работают через существующие рендереры без изменений.

---

## Ключевые архитектурные решения

| Решение | Выбор | Обоснование |
|---|---|---|
| Вход ученика | Ссылка через мессенджер | Без регистрации, просто для ученика |
| Бандл | **Один**, тот же что у логопеда | Все рендереры тем переиспользуются |
| Разветвление | Guard clause в `App.jsx` | Минимальное изменение существующего кода |
| UI ученика | **Новый StudentHomeScreen** | Оптимизирован: крупные кнопки, простой фокус |
| Сессии | Существующие экраны без изменений | StudentApp заполняет store, дальше работает существующий флоу |
| Real-time | Только для списка покупок (polling 2–3 сек) | Другие темы не требуют |

---

## Scope

### В рамках этого спека

**Фаза 1 — Базис:**
- Таблица `student_portals`, генерация/отзыв токенов
- Секция «Доступ» в карточке ученика у логопеда
- Guard clause в `App.jsx` + `StudentApp.jsx`
- `StudentHomeScreen` (новый дизайн: активное задание + список тем)
- Назначение активного задания логопедом (`PATCH /students/:id/active-task`)
- Студент проходит сессии любых тем через существующие экраны

**Фаза 2 — Real-time список покупок:**
- Таблица `shopping_live_state`
- `StudentShoppingScreen` с polling
- Live-панель наблюдения для логопеда
- Редактирование списка логопедом во время сессии

### Вне скоупа

- Push-уведомления ученику
- Чат между логопедом и учеником
- Real-time для тем кроме shopping

---

## Архитектура

### Единственное изменение существующего кода — `App.jsx`

```jsx
export default function App() {
  // НОВОЕ: guard clause в самом начале, до любой другой логики
  const portalToken = localStorage.getItem('student_portal_token');
  if (portalToken) return <StudentApp token={portalToken} />;

  // ... весь существующий код логопеда не трогается
}
```

Все текущие пользователи (логопеды) не имеют `student_portal_token` в localStorage → guard никогда не срабатывает → приложение работает как прежде.

### Обработка URL `/s/<token>`

`App.jsx` при старте дополнительно проверяет `window.location.pathname`:

```jsx
// Тоже в самом начале App(), до guard clause
const match = window.location.pathname.match(/^\/s\/([A-Za-z0-9_-]+)$/);
if (match) {
  localStorage.setItem('student_portal_token', match[1]);
  history.replaceState(null, '', '/');
}
```

Это позволяет ученику просто тапнуть ссылку — токен сохраняется, URL чистится, guard clause подхватывает токен и рендерит StudentApp.

### Новые таблицы в БД

**`student_portals`**

```sql
CREATE TABLE IF NOT EXISTS student_portals (
  id              TEXT PRIMARY KEY,
  account_id      TEXT NOT NULL REFERENCES accounts(id),
  student_id      TEXT NOT NULL,
  token_hash      TEXT UNIQUE NOT NULL,
  label           TEXT,                   -- "iPad Васи"
  active_topic_id TEXT,                   -- текущее назначенное задание
  active_mode_id  TEXT,
  created_at      TEXT NOT NULL,
  last_used_at    TEXT,
  revoked_at      TEXT                    -- NULL = активен
);
CREATE INDEX IF NOT EXISTS idx_portals_account ON student_portals(account_id);
CREATE INDEX IF NOT EXISTS idx_portals_student ON student_portals(student_id);
```

**`shopping_live_state`** (Фаза 2)

```sql
CREATE TABLE IF NOT EXISTS shopping_live_state (
  id               TEXT PRIMARY KEY,
  student_id       TEXT NOT NULL,
  account_id       TEXT NOT NULL,
  items_json       TEXT NOT NULL DEFAULT '[]',
  checked_ids_json TEXT NOT NULL DEFAULT '[]',
  started_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  finished_at      TEXT
);
CREATE INDEX IF NOT EXISTS idx_shopping_live ON shopping_live_state(student_id, finished_at);
```

### Два типа аутентификации

| | Логопед | Ученик |
|---|---|---|
| Тип токена | Bearer JWT (существующий) | Bearer portal-token (новый) |
| Хранение | localStorage (ключ `token`) | localStorage (ключ `student_portal_token`) |
| Endpoints | `/account/*`, `/sync`, `/sessions` | `/student/*` |
| Вход | email + пароль | тап по ссылке из мессенджера |
| При 401 | → экран логина | → «Ссылка недействительна» |

---

## Новые файлы (не изменяют существующие)

```
src/
  StudentApp.jsx           — корень режима ученика
  features/
    student/
      StudentHomeScreen.jsx — главный экран ученика
      StudentShoppingScreen.jsx — (Фаза 2) shopping с real-time
      useStudentPortal.js   — хук: загрузка /student/me, polling
backend/
  lib/
    student-portal.mjs     — DB-функции для student_portals
    shopping-live.mjs      — (Фаза 2) DB-функции для shopping_live_state
```

---

## API

### Новые endpoints для ученика (`/student/*`)

Middleware `requireStudentPortal`: проверяет Bearer-токен через таблицу `student_portals`, обновляет `last_used_at`, возвращает 401 если `revoked_at IS NOT NULL`.

| Метод | Путь | Описание |
|---|---|---|
| `GET` | `/student/me` | Имя ученика + `activeTask` (topicId + modeId) + список `assignedTopics` с topic.json и params из `student_topic_links` |
| `POST` | `/student/session` | Сохранить завершённую сессию (аналог существующего `/sync` с `session.append`) |
| `GET` | `/student/shopping` | (Фаза 2) Текущее состояние списка покупок |
| `PATCH` | `/student/shopping` | (Фаза 2) Обновить `checked_ids` |

**Ответ `GET /student/me`:**
```json
{
  "student": { "id": "...", "name": "Вася", "photo": null },
  "activeTask": { "topicId": "shopping_v1", "modeId": "shop" },
  "assignedTopics": [
    {
      "topicId": "shopping_v1",
      "topicJson": { ... },
      "params": { "items": [...] },
      "locked": false
    }
  ]
}
```

### Новые endpoints для логопеда (существующий JWT)

| Метод | Путь | Описание |
|---|---|---|
| `POST` | `/students/:id/portal` | Создать портал → `{ url, portalId }` |
| `DELETE` | `/students/:id/portal/:pid` | Отозвать доступ |
| `GET` | `/students/:id/portals` | Список активных порталов |
| `PATCH` | `/students/:id/active-task` | Установить `{ topicId, modeId \| null }` |
| `POST` | `/students/:id/shopping/start` | (Фаза 2) Начать live-сессию покупок |
| `GET` | `/students/:id/shopping` | (Фаза 2) Состояние для наблюдения (polling 2 сек) |
| `PUT` | `/students/:id/shopping/items` | (Фаза 2) Логопед редактирует список |
| `POST` | `/students/:id/shopping/finish` | (Фаза 2) Завершить сессию |

---

## Интерфейс ученика

### `StudentApp.jsx`

Корень режима ученика. Не использует `useAppStore` и существующий SCREENS-роутер напрямую.

**Собственный mini-router:**
```
'home'     → StudentHomeScreen
'session'  → (делегирует в существующий SessionScreen через store)
'shopping' → (Фаза 2) StudentShoppingScreen
'summary'  → существующий SessionSummary
'error'    → экран «Ссылка недействительна»
```

**Boot-последовательность:**
1. Вызов `GET /student/me` с portal-token
2. 401 → показать экран ошибки
3. OK → показать StudentHomeScreen с данными

### `StudentHomeScreen.jsx`

Дизайн: фиолетовый градиент, крупные элементы, оптимизирован для планшета/телефона.

- **Шапка:** `Привет, [имя] 👋`
- **Карточка активного задания** (если `activeTask` задан): пульсирующий индикатор «ЗАДАНИЕ СЕЙЧАС», иконка темы, кнопка «Начать →»
- **Список «Ещё доступно»**: остальные `assignedTopics` (не активная); `locked: true` → серые с замком
- **Если `activeTask` не задан**: серая карточка «Логопед ещё не назначил задание» + список доступных тем

**Тап по теме → переход в сессию:**

Для **shopping** (Фаза 2): переключиться на `'shopping'`.

Для **всех остальных тем**:
```js
// StudentApp заполняет store и делегирует существующему флоу
useAppStore.setState({
  activeStudentId: student.id,
  activeTopicId: topicId,
  activeModeId: modeId,
  // params берутся из assignedTopics[n].params
});
setScreen('session'); // существующий SessionScreen
```

SessionScreen, SessionSummary — работают без единого изменения.

### `StudentShoppingScreen.jsx` (Фаза 2)

- `GET /student/shopping` каждые 3 секунды
- Тап по товару → `PATCH /student/shopping` немедленно
- Новый товар (добавленный логопедом) → оранжевый badge «новое», исчезает после тапа
- Прогресс: «N из M куплено» в шапке
- Кнопка «Всё куплено! ✓» → `POST /student/session` для сохранения

---

## Интерфейс логопеда

### Карточка ученика (`StudentEditScreen`) — новая секция

Секция «Доступ с устройства ученика» добавляется в конец существующего экрана:

- Список активных порталов: `label` + «последний вход N дней назад»
- Кнопка «+ Создать ссылку» → modal: поле метки (опционально) → кнопка «Скопировать ссылку»
- «Отозвать» рядом с каждым порталом (с подтверждением)

### Карточка ученика — секция тем: новая колонка «Активное задание»

Рядом с каждой назначенной темой:
- Кнопка «Назначить сейчас» / «Снять» (только одна тема активна)
- Для shopping если активна: «👁 Следить» (Фаза 2)

### Live-панель (Фаза 2)

- Открывается по кнопке «👁 Следить»
- Список товаров с галочками, обновляется каждые 2 сек
- Поле «+ Добавить товар»
- Кнопка «Завершить поход»

---

## Синхронизация списка покупок (Фаза 2)

```
Логопед:                                  Ученик:
POST /students/:id/shopping/start
                                          GET /student/me → activeTask = shopping
                                          Тап «Начать» → StudentShoppingScreen
                                          GET /student/shopping (polling 3s)
PUT /students/:id/shopping/items  ──────► (ученик видит через 3 сек)
GET /students/:id/shopping (2s)   ◄────── PATCH /student/shopping (тап по товару)
POST /students/:id/shopping/finish
                                          POST /student/session (сохранение)
```

- `shopping_live_state` — единственный источник правды во время сессии
- Конфликты (одновременный PATCH + PUT): last-write-wins по `updated_at`
- По завершении: запись добавляется в `sessions` (тип `shopping`)

---

## Обработка ошибок

| Ситуация | Поведение |
|---|---|
| Portal-token отозван или не найден | StudentApp показывает «Ссылка недействительна. Попросите логопеда прислать новую» |
| Нет сети во время shopping | Тапы сохраняются в очередь, отправляются при восстановлении; UI показывает «Нет соединения» |
| `/student/me` временно недоступен | Показать cached данные (если были) + spinner |
| Логопед ещё не назначил тему | StudentHomeScreen: серая карточка-заглушка |

---

## Что не изменяется

- Все существующие таблицы и endpoints — не трогаются
- `App.jsx` — одна guard clause + 4 строки для URL-токена в самом начале
- `SessionScreen`, `ModePickerScreen`, `ParamsScreen`, `SessionSummary`, все рендереры тем — не трогаются
- `StudentEditScreen` — добавляется одна новая секция в конец
- Существующая аутентификация логопеда — не трогается
