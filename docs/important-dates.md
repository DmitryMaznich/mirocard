# Важные даты (important dates) — for the "Сегодня" screen

A child's birthdays (their own and close people's), holidays and one-off
events ("Идём в новую школу"). Agreed with the speech therapist on
2026-10-07: a **separate profile section**, not a field of "Мои люди" —
many important days aren't tied to a person.

## What step 1 shipped

- **Data**: `student.importantDates` (array of cards) + `importantDatesUpdatedAt`.
  Server column `students.important_dates`, sync op
  `student.important_dates.upsert`, merged **per card by id** (newest
  `deletedAt/updatedAt/createdAt` wins, tombstones kept) — same scheme as
  My People, on both server (`account-repository.mjs`) and client
  (`bootstrap.js` `mergeImportantDates`). One optional photo per card,
  uploaded first via `/api/photos` like My People.
- **Logic**: `src/features/importantDates/importantDates.js` (pure, tested):
  occurrences (29 Feb → 28 Feb in other years; "once" only in its year),
  days-until, nearest countdown, phrases.
- **Settings screen**: `important_dates_settings`
  (`ImportantDatesScreen.jsx`), reusing My People's `.mp-*` chrome. Entry
  points: student card ("Важные даты") and the "Сегодня" params screen
  (section "Важные даты", which also picks the style). Offers to add the
  child's own birthday from My People's profile `birthDate`. Fixed-date
  preset holidays as chips (no Пасха — movable).
- **"Сегодня" screen** (`daily_orientation/index.jsx`):
  - on the day: ribbon under the carousel with photo + one sentence;
    "Празднично" style adds a garland + warm background; cake/icon under the
    number on the "Число" card; own birthday → crown, "Мне 8 лет.", candles
    by age (≤ 12);
  - before it: one countdown ribbon (nearest date only), one mark per day
    of the countdown window, one goes out each day — **candles for
    birthdays, dots for everything else** (therapist's call);
  - "Завтра" in the carousel previews tomorrow's festive look, so the change
    isn't a surprise in the morning;
  - calendar (Число modal) and week (День недели modal) show the dates;
  - param `importantDatesStyle`: `bright` | `calm` (ribbon only) | `off`.
  - Nothing animates and nothing plays on its own. The ribbons have **no
    speaker button** (removed 2026-10-07 at the therapist's request): the
    screen is always used with an adult, and the sentence is for the child
    to say, not the tablet.
  - Same reasoning for the whole screen: the cards' recorded-voice speakers
    are now **off by default** (param `cardSound`, "Озвучка карточек" in the
    topic settings). Kept, not deleted, for a child who can't say the answer
    — for them the speaker is their voice (AAC).

## Phrase rules (why they look like this)

- The adult writes the title as it reads alone ("День рождения мамы").
  On screen: "Сегодня/Завтра " + title with a lowercased first letter —
  no verb, so no gender agreement to get wrong. Holidays keep their
  capital ("Сегодня Новый год!").
- Countdown: "<title> через 3 дня" / "<title> завтра!" — the title stays
  nominative, so it works for any title without declension.
- Birthday title is prefilled from a linked My People person with a
  best-effort genitive ("мама" → "мамы", "бабушка Галя" → "бабушки Гали");
  the adult sees and can fix it.

## Step 2 backlog (agreed, not built)

- "Вчера был …" on the Вчера view (currently shows nothing for dates).
- Attach photos from the event afterwards, for retelling ("Что мы делали?").
- "?" button with adult question prompts on the day, by case:
  "У кого сегодня день рождения?" / "Кого поздравляем?" / "Кому подарим?" /
  "Сколько лет исполнилось?".
