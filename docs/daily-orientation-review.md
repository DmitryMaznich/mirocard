# «Сегодня» (daily_orientation) — speech-therapy review, 2026-10-07

A review of the topic by a speech therapist's eye (children with ASD/speech
delay, a wall tablet used with an adult). Important dates are their own
feature — see `docs/important-dates.md`. This file is the rest of the review.

## Done

- **Card speakers off by default** (`cardSound`). The adult asks, the child
  answers; the recorded voice is kept for a child who can't say the answer
  (then the speaker is their voice — AAC).
- **Weather said the way people say it**: "Сегодня солнечно / пасмурно /
  идёт дождь / идёт снег / туман" (was "Погода дождливая"). The recorded
  clips still have the old adjective wording, so with sound on this card
  uses browser TTS. Re-record the five clips with
  `scripts/generate-daily-orientation-audio.mjs` (needs `GEMINI_API_KEY`) and
  switch the card back to clips if that matters.
- **Unmarked weather** is a quiet "?" ("Отметить"), not a dashed empty box.
- **Вчера/Завтра**: month and season that didn't change are dimmed and
  silent (no "Вчера был октябрь" as a model sentence); the "right now" row,
  empty on those days, shows that day's plan ("Что было вчера — 🏊 Бассейн").
- **Weekly plan pictures**: per day, chosen in settings, stored in front of
  the text ("Вт: 🏊 Бассейн" — same "Пн: …" format), shown in the week modal
  and on the Вчера/Завтра card.
- **Время суток**: the current part is as big as the other cards' answers.
- **Месяцы modal**: day counts removed (not needed, one more thing to read).
- **Letter case** (`letterCase`: upper | sentence): one form everywhere for
  a child who reads whole words.
- **Time in words** (`timeWordsStyle`: exact | spoken): "двадцать минут
  десятого", "без пяти десять", "половина десятого" on a 12-hour clock
  (`getSpokenClockWordParts` in `timeUtils.js`). Spoken with TTS when sound
  is on (no recorded clips for these).

## Not done (bigger, discussed but not started)

- "Сейчас → потом" (first–then) strip from a daily schedule.
- "Спроси меня" mode: the screen asks, the child picks from 2–3 pictures
  (errorless). A separate mode, not part of the wall display.
- Clock difficulty levels for the dial itself (hours only → halves →
  quarters → minutes).
- "Что надеть?" next to the weather.
- A colour per weekday; dimming the screen at night; позавчера/послезавтра.
