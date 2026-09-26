# Вход через Google и суточный лимит писем — настройка

Для владельца. Код уже в приложении; без этих шагов кнопка «Войти через Google» просто не
показывается (безопасное выключение), а лимит писем работает со значениями по умолчанию.

## 1. Google Cloud Console (≈30 минут, бесплатно)

1. Открыть https://console.cloud.google.com/ → вверху выбор проекта → **New project** →
   имя `Mironium` → Create.
2. **APIs & Services → OAuth consent screen** (в новой консоли — «Google Auth Platform →
   Branding / Audience»):
   - User type: **External**.
   - App name: `Mironium`; User support email: ваш адрес.
   - App logo — **лучше пока не загружать**: с логотипом Google проверяет бренд несколько
     дней, без логотипа кнопка работает сразу.
   - App domain / Application home page: `https://mironium.com`
   - Privacy policy: `https://app.mironium.com/api/privacy`
   - Terms of service: `https://app.mironium.com/api/terms`
   - Authorized domains: `mironium.com`
   - Developer contact: ваш адрес.
   - Scopes: ничего не добавлять — нужны только базовые `openid`, `email`, `profile`
     (они «несекретные», долгой проверки Google для них нет).
   - Audience → **Publishing status: In production** (иначе войти смогут только
     добавленные вручную тестовые пользователи).
   - Если консоль попросит подтвердить домен — сделать это в
     https://search.google.com/search-console для `mironium.com` (DNS-запись TXT).
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**, имя `Mironium web`.
   - **Authorized JavaScript origins**: `https://app.mironium.com` и
     `http://localhost:5174` (для локальной проверки).
   - Authorized redirect URIs — **не нужны** для этого способа входа.
   - Create → скопировать **Client ID** (вида `1234…apps.googleusercontent.com`).
     Client secret не нужен — нигде его не сохраняйте.

## 2. Railway

`mirocard-backend` → **Variables** → добавить:

| Переменная | Значение | Секрет? |
|---|---|---|
| `GOOGLE_CLIENT_ID` | Client ID из шага 1.3 | нет (он виден в браузере по определению) |

Railway перезапустит сервис. Проверка: `https://app.mironium.com/api/auth/signup-status`
должен вернуть `"google": { "clientId": "…" }`.

## 3. Суточный лимит писем (бесплатный Resend)

| Переменная | По умолчанию | Что делает |
|---|---|---|
| `EMAIL_DAILY_CAP` | 90 | потолок всех писем за скользящие 24 часа |
| `EMAIL_SIGNUP_CAP` | 80 | после него регистрация **по почте** закрыта до завтра |

Зазор между ними оставлен для уже зарегистрированных («отправить письмо повторно»,
«забыли пароль»). Сверьте точный суточный лимит своего плана в дашборде Resend и при
желании поднимите оба числа (держите `EMAIL_DAILY_CAP` ниже лимита Resend с запасом).
Менять можно в Railway Variables без деплоя.

## 4. Что меняется в вечер запуска

- Вход и регистрация через Google **не тратят** письма (Google сам подтверждает email).
  Когда регистрация по почте закрыта на сегодня, экран регистрации предлагает Google.
- В момент закрытия регистрации по почте в канал ошибок
  (`ERROR_REPORTING_WEBHOOK_URL`) приходит сообщение `email signup paused: daily budget
  reached` — не чаще раза в 12 часов.
- Если кто-то пишет, что письмо не пришло: активировать вручную можно через
  `POST /api/admin/verify-account` (см. `docs/testing/launch-day-runbook.md` в ветке
  `launch-testing`).
