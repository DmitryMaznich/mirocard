# Рисунки рук — «Покажи на пальцах» (addition_subtraction)

Все рисунки рук темы в одном месте (копии; приложение берёт файлы из `public/hands/`).
Рисунок — ладонь левой руки ребёнка, большой палец слева; правая рука на экране — тот же рисунок, отражённый.
Буквы позы: t — большой, i — указательный, m — средний, r — безымянный, p — мизинец (какие пальцы подняты).

## `app/` — 14 поз, которые сейчас в приложении

Имя файла: `<сколько пальцев>-<поза>.webp`.

| Пальцев | Поза | Здесь | В приложении |
|---|---|---|---|
| 0 | кулак | `app/0-fist.webp` | `public/hands/hand_right_0.webp` |
| 1 | указательный | `app/1-i.webp` | `public/hands/hand_right_1.webp` |
| 1 | большой | `app/1-t.webp` | `public/hands/combo_t.webp` |
| 1 | мизинец | `app/1-p.webp` | `public/hands/combo_p.webp` |
| 2 | указательный + средний | `app/2-im.webp` | `public/hands/hand_right_2.webp` |
| 2 | большой + указательный | `app/2-ti.webp` | `public/hands/combo_ti.webp` |
| 2 | большой + мизинец | `app/2-tp.webp` | `public/hands/combo_tp.webp` |
| 2 | указательный + мизинец | `app/2-ip.webp` | `public/hands/combo_ip.webp` |
| 3 | указательный + средний + безымянный | `app/3-imr.webp` | `public/hands/hand_right_3.webp` |
| 3 | большой + указательный + средний | `app/3-tim.webp` | `public/hands/combo_tim.webp` |
| 3 | средний + безымянный + мизинец | `app/3-mrp.webp` | `public/hands/combo_mrp.webp` |
| 4 | указательный + средний + безымянный + мизинец | `app/4-imrp.webp` | `public/hands/hand_right_4.webp` |
| 4 | большой + указательный + средний + безымянный | `app/4-timr.webp` | `public/hands/combo_timr.webp` |
| 5 | все пять | `app/5-timrp.webp` | `public/hands/hand_right_5.webp` |
## `drafts/` — все черновики генерации (Gemini), 2026-11-27

`hand_<поза>_<номер>.webp`. Утверждены и попали в приложение: t_1, p_4, ti_2, tp_3, ip_1, tim_1, mrp_3, timr_1.
Остальные — отбракованные: не то число пальцев или не те пальцы (средний вместо безымянного,
отставленный большой палец и т. п.). `tip_*` — копии tp_1, tp_2, ip_3 (на них большой + указательный + мизинец),
ещё не утверждены.

Как генерировать и собирать: `scripts/generate-finger-combos.mjs`, `scripts/build-finger-combos.mjs`;
история и подводные камни — `docs/addition-subtraction-design-review.md`, раздел от 2026-11-27.
