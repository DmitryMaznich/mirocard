# Email Verification & Extended Registration — Design Spec

**Date:** 2026-06-30  
**Status:** Approved for implementation

---

## Overview

Добавить верификацию email при регистрации и расширить набор собираемых данных о пользователе. Новые аккаунты создаются в статусе `'pending'` и не могут войти в систему до подтверждения email. Существующие пользователи (статус `'active'`) не затрагиваются.

---

## 1. База данных

### 1.1 Новые колонки в таблице `accounts`

```sql
ALTER TABLE accounts ADD COLUMN first_name TEXT NOT NULL DEFAULT '';
ALTER TABLE accounts ADD COLUMN last_name  TEXT NOT NULL DEFAULT '';
ALTER TABLE accounts ADD COLUMN role       TEXT NOT NULL DEFAULT 'parent';
ALTER TABLE accounts ADD COLUMN referral_source TEXT NOT NULL DEFAULT 'other';
ALTER TABLE accounts ADD COLUMN consent_personal_data_at TEXT NOT NULL DEFAULT '';
```

Допустимые значения:
- `role`: `'parent'` | `'specialist'`
- `referral_source`: `'friend'` | `'developer'` | `'other'`

`display_name` остаётся — при регистрации вычисляется как `firstName + ' ' + lastName` (или просто `firstName` если `lastName` пустой). Всё существующее использование `display_name` не меняется.

Существующие пользователи получают дефолты (`''`, `'parent'`, `'other'`, `''`) и остаются `'active'` — доступ не блокируется.

### 1.2 Новая таблица `email_verification_tokens`

```sql
CREATE TABLE IF NOT EXISTS email_verification_tokens (
  token_hash  TEXT PRIMARY KEY,
  account_id  TEXT NOT NULL REFERENCES accounts(id),
  expires_at  TEXT NOT NULL,
  created_at  TEXT NOT NULL
);
```

Зеркалит `password_reset_tokens`. При повторной отправке старый токен заменяется через `INSERT OR REPLACE`.

---

## 2. account-repository.mjs

### Изменения в `createAccount`

- Принимает дополнительные поля: `firstName`, `lastName`, `role`, `referralSource`, `consentPersonalDataAt`
- Создаёт аккаунт со `status = 'pending'`
- Вычисляет `display_name = firstName + (' ' + lastName).trim()`

### Новые функции

```js
createEmailVerificationToken(db, { tokenHash, accountId })
// INSERT OR REPLACE, expires_at = now + 24h

consumeEmailVerificationToken(db, tokenHash)
// → accountId | null (null если не найден или истёк)
// Удаляет токен после потребления

activateAccount(db, id)
// UPDATE accounts SET status = 'active' WHERE id = ?

findAccountByEmailAny(db, email)
// SELECT * FROM accounts WHERE email = ? (без фильтра по status)
// Используется только в handleLogin для различения "аккаунт не найден"
// vs "аккаунт найден но не подтверждён"
```

> **Важно:** существующая `findAccountByEmail` фильтрует `status = 'active'` — её нельзя использовать в handleLogin для pending-аккаунтов. В логине используем `findAccountByEmailAny`, затем проверяем статус явно.

---

## 3. mailer.mjs

Новая функция по образцу `sendPasswordResetEmail`:

```js
sendEmailVerificationEmail(email, token)
// Ссылка: APP_BASE_URL + '/verify-email?token=' + token
// Dev-режим (без SMTP): печатает ссылку в консоль
```

Текст письма (ru): «Подтвердите email — нажмите на ссылку (действует 24 часа). Если вы не регистрировались — проигнорируйте.»

---

## 4. server.mjs — API endpoints

### Изменения в существующих

**`POST /auth/register`**
- Принимает: `email`, `password`, `firstName`, `lastName?`, `role`, `referralSource`, `consentPersonalData` (boolean)
- Валидация:
  - email с `@`, уникальность
  - password ≥ 8 символов
  - `firstName` непустой
  - `role` ∈ `['parent', 'specialist']`
  - `referralSource` ∈ `['friend', 'developer', 'other']`
  - `consentPersonalData === true`
- Создаёт аккаунт (`status = 'pending'`), генерирует токен верификации, отправляет письмо
- **Не возвращает auth-токен**
- Ответ: `201 { message: "Check your email" }`

**`POST /auth/login`**
- Если аккаунт найден, но `status = 'pending'` → `403 { error: "email_not_verified" }`
- Остальная логика без изменений

### Новые endpoints

**`GET /auth/verify-email?token=xxx`**
- Потребляет токен через `consumeEmailVerificationToken`
- Если не найден или истёк → `400 { error: "invalid_or_expired_token" }`
- При успехе: `activateAccount`, возвращает `201 { account, settings, token }` (автологин)

**`POST /auth/resend-verification`**
- Принимает: `{ email }`
- Находит аккаунт с `status = 'pending'` по email
- Если не найден или уже активен — всё равно возвращает `200` (не раскрываем факт существования email)
- Инвалидирует старый токен (`INSERT OR REPLACE` создаёт новый), отправляет письмо

---

## 5. Фронтенд

### 5.1 Форма регистрации

Поля в порядке отображения:

| Поле | Элемент | Обязательное |
|------|---------|--------------|
| Email | input[type=email] | да |
| Пароль | input[type=password] | да |
| Имя | input[type=text] | да |
| Фамилия | input[type=text] | нет |
| Я являюсь | radio: «Родителем» / «Специалистом» | да |
| Как вы узнали о нас | radio: «Рекомендация друзей» / «Приглашение разработчика» / «Другое» | да |
| Согласие на обработку персональных данных | checkbox | да |

### 5.2 После успешной регистрации

Вместо автологина — экран «Проверьте почту»:
- Текст: «Мы отправили письмо на {email}. Перейдите по ссылке в письме для завершения регистрации.»
- Кнопка «Отправить повторно» → `POST /auth/resend-verification`
- Кнопка повторной отправки disabled на 60 секунд после нажатия

### 5.3 Экран логина — ошибка `email_not_verified`

При ответе `403 { error: "email_not_verified" }`:
- Сообщение: «Email не подтверждён. Проверьте почту или...»
- Ссылка «Отправить письмо повторно» → `POST /auth/resend-verification`

### 5.4 Новый роут `/verify-email`

- При загрузке: берёт `?token=` из URL, вызывает `GET /auth/verify-email?token=`
- **Успех:** автологин (сохраняем полученный token), редирект на главную
- **Ошибка:** экран «Ссылка недействительна или истекла» + кнопка «Запросить новую ссылку» (→ переход на страницу логина с открытой формой resend)

---

## 6. Безопасность

- Токены верификации: `crypto.randomBytes(32).toString('hex')`, хранится только SHA-256 хеш (аналогично password reset)
- TTL: 24 часа
- `POST /auth/resend-verification` не раскрывает существование аккаунта (всегда `200`)
- Rate limiting на `/auth/resend-verification` — не более 3 запросов в час на email (реализуется через in-memory счётчик, аналогично существующим паттернам)

---

## 7. Что НЕ меняется

- Таблица `password_reset_tokens` и весь flow сброса пароля
- Таблица `auth_tokens` и JWT-механизм
- `account_settings`, `sync_revision` — создаются как прежде при регистрации
- Все остальные endpoints (sync, students, sessions и т.д.)
- Существующие пользователи — остаются `'active'`, доступ не блокируется

---

## 8. Файлы, затрагиваемые реализацией

| Файл | Изменение |
|------|-----------|
| `backend/lib/db.mjs` | Новая таблица + ALTER TABLE для новых колонок |
| `backend/lib/account-repository.mjs` | Расширение `createAccount`, три новые функции |
| `backend/lib/mailer.mjs` | Новая функция `sendEmailVerificationEmail` |
| `backend/server.mjs` | Изменение `handleRegister` и `handleLogin`, два новых handler'а, два новых роута |
| `src/` (frontend) | Форма регистрации, экран "проверьте почту", роут `/verify-email`, обработка ошибки логина |
