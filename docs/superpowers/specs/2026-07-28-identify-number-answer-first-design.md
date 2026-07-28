# Design: "Какое это число?" answers its own question (IdentifyNumberTask)

## Problem

`IdentifyNumberTask.jsx` shows a permanent header `pv-instruction`: "Какое это
число?" (What is this number?). But the child is only ever asked two other
questions — "Сколько десятков?" (how many tens?) then "Сколько единиц?" (how
many ones?) — and the two-digit number is assembled *for* them by a merge
animation once both are answered correctly. The child never actually answers
the question the header asks. Flagged by the user as a logical mismatch
between the static header and the actual task flow.

## Resolution

Add a third step, inserted after the existing tens/ones questions, where the
child explicitly types the full two-digit number. Only once that's answered
correctly does the existing merge animation play — now demonstrating that the
tens+ones digits (already sitting in their own zone-linked slots) equal the
number the child just named, rather than merely assembling an answer nobody
was asked to give.

Confirmed flow, in order:
1. "Сколько десятков?" — unchanged.
2. "Сколько единиц?" — unchanged.
3. **New:** "Какое это число?" — child types the full two-digit number.
4. On success: merge animation (tens/ones digits fly from their slots and
   land on the just-typed guess), then "Правильно!", then the existing
   manual "Далее →" tap.

## State machine

Current: `phase` = `answerTens → answerOnes → done`.

New: `phase` = `answerTens → answerOnes → answerNumber → done`.

`questionText` (the sub-header prompt under the permanent instruction) gains a
third value for `answerNumber`: `"Какое это число?"` — now textually
identical to the permanent header, resolving the original mismatch.

## Input handling for the new `answerNumber` phase

A new local buffer, `numberInput` (array of typed digit strings, max length
2), fed by the same shared `pv-numpad` / `handleDigit` the other two phases
already use — no new keyboard component.

- Each digit tap appends to `numberInput`. No correctness check while
  `numberInput.length < 2` (same "accumulate first, validate once full"
  pattern already used by the sibling column-arithmetic "copy" mode, see
  `handleDigit` in `index.jsx` around line 862).
- Once `numberInput.length === 2`: compare
  `Number(numberInput.join(""))` against `task.model.tens * 10 +
  task.model.ones` (equivalently `task.number`).
  - **Wrong:** shake the guess field (reusing the existing
    `flashRowWrong`-style flash — same 500ms shake / mistake callback — under
    a new key, e.g. `"number"`), then clear `numberInput` back to `[]` for a
    fresh two-digit attempt. No directional (more/less) hint here — this is a
    whole-number guess, not a single digit, so the existing
    `hintDirectionFor` per-digit hint model doesn't apply here (it stays
    exactly as-is on steps 1–2).
  - **Correct:** `setPhase("done")` (as today) and the existing
    `playMergeAnimation` runs unmodified.

## New visual element — the guess field

Occupies the same position `pv-merged-number` already occupies today (the
centered spot between the tens/ones answer columns, above the coin zones —
see `.pv-answer-row--split` layout in `place_value.css`). On phases 1–2 it
stays empty/hidden as it does today.

On `answerNumber`, it shows two placeholder cells ("?" "?" initially), filling
in with the digits from `numberInput` as the child types — visually closer to
the existing `.pv-answer-slot` look than to `pv-merged-number`'s final,
bigger typography. This distinction matters: the child's in-progress guess
should read as a *guess*, not as the already-confirmed final number, so that
the subsequent fly-in of the real tens/ones digits on top of it reads as a
"these two match, confirmed" moment rather than a redundant re-print of
the same characters.

## Animation

No changes to `flyDigitGhost` or `playMergeAnimation` — both already target
`mergedTensRef` / `mergedOnesRef`, which now physically coincide with the
just-typed guess field's position. The existing 180ms pre-merge beat (see
`handleDigit`'s `setTimeout(playMergeAnimation, 180)`) and reduced-motion
fallback are unaffected.

## Copy

No new strings beyond the third `questionText` value, `"Какое это число?"` —
identical text to the existing permanent `pv-instruction` header content.

## Testing

`identifyNumber.smoke.test.jsx`:
- The existing test "shows 'Правильно!' and waits for a tap on Далее before
  calling onCorrect" (currently: correct tens → correct ones → advance timers
  → expect "Правильно!") needs a new step inserted between "correct ones" and
  the merge: type the two digits of the full number into the numpad, then
  proceed as before.
- New test: typing a wrong two-digit guess on the `answerNumber` phase shakes
  the guess field and clears it, without advancing `phase` past
  `answerNumber` and without calling `onMistake`/`onFlashIncorrect` more than
  once per wrong attempt (mirroring the existing per-phase mistake-callback
  expectations already tested for phases 1–2).
- Existing tests for phases 1–2 (tens-first question text, wrong-ones digit
  persisting the tens digit) are unaffected by this change.

## Out of scope

- No change to `hintDirectionFor` / the directional more/less hint on steps
  1–2 — confirmed to stay exactly as-is.
- No change to `BuildNumberTask.jsx` or `RegroupTenTask.jsx` — this is
  specific to `IdentifyNumberTask.jsx`'s own flow; the "coins + phased
  answer, no TTS, no live counter" shared visual language from the
  2026-07-26 sibling unification is not otherwise touched.
- No entry-order flexibility (tens vs ones first) — order stays fixed exactly
  as it is today.
