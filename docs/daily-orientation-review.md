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

- **Время года** (2026-10-10): the picture is the whole card's background
  (cover), its lower part fades into the season tint and the name sits on
  that "ground" -- no separate band under a letterboxed picture.
- **Погода** (2026-10-10): the pictogram shrinks to the room left under the
  caption; on a shorter row (Важные даты ribbon) it used to spill over
  "Погода".
- **«Время суток» → «Сейчас»** (2026-10-10): caption + answer read as the
  phrase "Сейчас — утро" (same as the speaker). The clock card stays
  "Время" -- about the clock people ask "Сколько время?", without "сейчас".
  The concept modal keeps the title "Время суток" for the whole cycle.

- **Second pass on the "right now" row** (2026-10-10, from a photo of the
  wall tablet): «Сейчас» — pictogram on the left ~40% at full height,
  утро/день/вечер/ночь as a vertical column on the right; «Погода» — the
  pictogram is the card's background on a weather tint, the word on one
  line at the bottom; the clock sizes itself to the card's height
  (`container-type: size` + `--dial-room`) and no longer sticks out on short
  rows (ribbon + garland); the garland is in front of everything (z-index);
  the first touch puts the screen in fullscreen (`useFullscreenOnFirstTouch`)
  so the Android status bar band goes away and the canvas fills it.

- **The week modal is now «Неделя»** (2026-10-13): there were weekdays but
  no notion of a *week*. Tapping the weekday card (or the plan) opens trains
  of 7 wagons Mon..Sun (a small locomotive marks where a week starts) on a
  track that swipes ±2 weeks around today, with the weekly plan repeating in
  every train. «Сколько дней в неделе?» numbers the wagons 1-7 in their rims
  (2026-10-14: there, not as badges, so a number doesn't read as part of the
  day's schedule), aloud, says «Семь дней — это неделя» and
  moves on to next Monday («Потом всё сначала»). The count follows the
  topic's sound switch; a tapped day is only spoken with «Озвучка карточек»
  on. Clips `count_1..7`, `week_is_seven`, `week_again` are in the bank but
  not recorded yet (no `GEMINI_API_KEY` in that session) -- until they are,
  the count speaks via browser TTS. Re-run
  `node scripts/generate-daily-orientation-audio.mjs` and drop them from
  `NOT_YET_RECORDED` in `audioBank.test.js`. A 7-day ring with a
  forward-only hand shipped in v1.0.2585 and was removed the next day: it
  looked like a clock and confused more than it added -- the trains alone
  carry the cycle.

## Not done (bigger, discussed but not started)

- "Сейчас → потом" (first–then) strip from a daily schedule.
- "Спроси меня" mode: the screen asks, the child picks from 2–3 pictures
  (errorless). A separate mode, not part of the wall display.
- Clock difficulty levels for the dial itself (hours only → halves →
  quarters → minutes).
- "Что надеть?" next to the weather.
- A colour per weekday; dimming the screen at night; позавчера/послезавтра.
