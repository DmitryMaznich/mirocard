---
name: record-app-scenario
description: Use when the user wants a screen-recording video of a specific Mirocard2 topic/mode acting out a scenario (a given text typed/written/assembled, a given sequence of taps, etc.) for marketing/social use (Instagram reels, carousel slides). Covers any topic/mode in src/topics/renderers/*, not just the ones already exercised — read this before writing any Playwright automation against the real app.
---

# Recording a scripted screen video of a Mirocard2 mode

## What this produces

A short (or long — see "Duration") vertical video of the **real, unmodified app interface**
performing a scripted action — e.g. the "Тетрадный лист" propis mode writing out a given
paragraph letter-by-letter, or "Свободная азбука" dragging letter tiles to spell given text —
recorded with Playwright, cropped/framed for Instagram (1080×1350, 4:5), with a matching cover
PNG. Never a mockup or a hand-drawn imitation: it drives the actual React component tree via a
throwaway local harness, so whatever the video shows is exactly what a real user's screen would
show.

**Non-negotiable constraint, always**: never modify app source to make recording easier (no
"debug mode" flags, no commits). The only artifacts this produces are two throwaway harness
files (deleted before finishing) and the output video/PNG in `artifacts/`.

## Overview of the recipe

1. Nail down the scenario with the user: exact text/params, which mode, full-vs-partial
   animation, target duration expectations. **Ask when ambiguous — text content, mode choice,
   and duration/quality tradeoffs are product decisions, not yours to guess.**
2. Read the mode's own renderer + engine + topic.json to learn its task shape and interaction
   model (tap-to-toggle? drag-and-drop? something else?).
3. Verify the scenario's content is fully supported by the real data (no system-font fallback
   for a "real handwriting" claim, no missing catalog items, etc.) — **before** writing any
   automation.
4. Build a throwaway dev harness that mounts the renderer directly (skip full app navigation).
5. Inspect real geometry/timing in the browser — never guess crop dimensions or animation speed.
6. Write the interaction script with **verified, retried** actions (see "Reliability" — this is
   the section that will save you the most time; skipping it costs full re-recordings).
7. Record via `context.recordVideo`, trim/encode with the bundled ffmpeg, verify, deliver.
8. Delete the harness files. Never commit them.

Read `docs/propis.md` (or the equivalent topic doc, if one exists) for the target topic before
touching its code — same rule as `designing-mirocard-screens`.

## Step 1 — Pin down the scenario with the user

Don't start recording until you have, explicit and confirmed:
- **The exact text/content**, character-for-character. If it's copy the user is drafting
  live, iterate on it in chat first — every re-record is expensive (see "Duration").
- **Which mode** (`tools/<topic>/topic.json`'s `modes[]`, matched by `id`/`type`).
- **Full animation of every element, or a curated highlight** (tap/drag only a few words) —
  this is a real tradeoff between video length and how "complete" it reads; ask, don't assume
  (see "Duration" below for why this matters so much for propis-style modes).
- **Output framing expectations** if the content is long enough that "zoom in tight" and
  "show everything" conflict (e.g. more than roughly one page's worth of propis rows) — offer
  the real options (shrink to fit vs. a panning camera that follows the active row) rather than
  silently picking one.

## Step 2 — Read the mode before scripting it

For the target topic, read in this order:
1. `tools/<topic>/topic.json` — `modes[]` (find the target mode's `id`/`type`/`params`),
   `cards[]` (the real captured/authored data your scenario will draw on).
2. `src/topics/renderers/<topic>/engine.js` — `generateTasks(mode, cards, sessionSize,
   sessionParams)`. This tells you the exact task object shape the view expects, and which
   `sessionParams` keys the mode reads (e.g. propis `read_lines` reads `sessionParams.lines`;
   magnetic_alphabet reads `sessionParams.layout`).
3. `src/topics/renderers/<topic>/index.jsx` — routes `task.type` to the actual view component.
4. The view component itself — this is where you learn the **interaction model**:
   - Tap-to-toggle (propis `PrintPageView`/`ReadTextView`): a hit-rect per word, click toggles
     an `activeIndex`, active word renders via an `AnimatedStrokes`-style component.
   - Drag-and-drop (magnetic_alphabet `magnetic_free`/`magnetic_words`): `onPointerDown` on a
     source tile + `onPointerMove`/`onPointerUp` on a canvas drop target, real pointer capture.
   - Something else: read carefully, there is no shortcut — the interaction model dictates
     everything about the automation approach in Step 6.
5. Any CSS the view imports, for what's safe to hide for recording (see Step 5) vs. structural.

## Step 3 — Verify content support before recording

If the mode's whole point is "this is real captured/authored data, not a generic renderer",
confirm your exact scenario content is actually backed by real data — **before** writing
automation, and **before** asking the user to lock in wording:

```js
const t = require('./tools/<topic>/topic.json');
const withData = t.cards.filter(c => /* whatever marks a card as "real", e.g. */ Array.isArray(c.strokes) && c.strokes.length);
const supported = new Set(withData.map(c => c.label ?? c.id));
const missing = [...new Set(scenarioText)].filter(ch => ch !== ' ' && !supported.has(ch));
```

If something's missing, **stop and tell the user** what's unsupported and offer real
alternatives (reword, or confirm they're OK with a fallback) — do not silently substitute.
This bit the propis videos twice: once for literal quotation marks (no captured glyph), once
for Latin "PDF" + a hyphen inside otherwise-Cyrillic copy.

## Step 4 — Throwaway dev harness

Mount the renderer directly via `generateTasks`, skipping topic-picker/params-screen/session
navigation entirely — much faster to iterate, and the resulting video has no app chrome to crop
out in the first place.

`dev-<topic>.html`:
```html
<!doctype html>
<html lang="ru"><head><meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>dev preview</title>
<style>html,body,#root{margin:0;padding:0;height:100%;background:#0b0b0b;}</style>
</head><body><div id="root"></div>
<script type="module" src="/src/dev-<topic>-preview.jsx"></script>
</body></html>
```

`src/dev-<topic>-preview.jsx` (propis example — adapt the task/props to the target mode):
```jsx
import { createRoot } from "react-dom/client";
import Renderer from "./topics/renderers/<topic>/index.jsx";
import { generateTasks } from "./topics/renderers/<topic>/engine.js";
import topicData from "../tools/<topic>/topic.json";

const mode = topicData.modes.find((m) => m.id === "<mode_id>");
const tasks = generateTasks(mode, topicData.cards ?? topicData, 1, { /* sessionParams, e.g. lines: [...] */ });

createRoot(document.getElementById("root")).render(
  <Renderer task={tasks[0]} mode={mode} onClose={() => {}} onAdvance={() => {}} onCorrect={() => {}} />
);
```
Match the exact prop names the renderer/index.jsx actually destructures — check Step 2's
reading, don't guess (magnetic_alphabet's `MagneticAlphabetRenderer` wants `mode`,
`sessionParams`, `soundEnabled`, `playFeedback`, `topicId`, `playTopicFile`, `onCorrect`,
`onAdvance`; propis's `PropisRenderer` wants just `task`/`onAdvance`/`onClose`).

Start the dev server: `npx vite --host 0.0.0.0 --port 8080 --configLoader native`, confirm with
`curl localhost:8080/dev-<topic>.html`. If `node_modules` doesn't exist yet, `npm ci` first —
that's the project's own declared dependencies, not "installing new packages".

**Delete both files before finishing the task.** Never commit them — they're scripted
scaffolding for this one recording session, not part of the app.

## Step 5 — Inspect real geometry and timing (never guess)

Take a full, uncropped screenshot first (`page.screenshot({ fullPage: true })`) to see what
you're actually working with before deciding on any crop.

**Framing**: figure out the real content bounding box (row/column count, max width actually
used) from the live DOM, not from eyeballing one short test case:
```js
const info = await page.evaluate(() => {
  const hits = document.querySelectorAll(".some-hit-target-class");
  return [...hits].map(el => el.closest("[transform]")?.getAttribute("transform"));
});
```
A crop width tuned against a short/simple scenario **will clip** a longer one whose wrapped
rows use more of the real content width — this happened going from a 4-line propis text to an
8-sentence one (636 units was fine for one, clipped the other; the real ceiling is
`PRINT_CONTENT_W_UNITS` + its left inset, i.e. compute it, don't eyeball it). Recompute the
crop's usable width from the mode's own real layout constants for the actual scenario length,
every time.

**Timing**: if the mode has a real animation whose speed is baked into the component (not
something you control), you cannot estimate its duration — measure it directly in the browser
before planning any hold/wait durations:
```js
// click, then read however the component exposes "how much is left to animate" —
// e.g. propis: SVG path total length / the component's own SPEED constant
const info = await page.evaluate(() =>
  [...document.querySelectorAll("[data-pr-anim]")].map(p => p.getTotalLength()));
```
Sum real per-element durations for the **whole** scenario before committing to "full
animation of everything" — tell the user the real total (it can be dramatically longer than
intuition suggests: a 3-sentence propis text was ~3 minutes of real animation; an 8-sentence
one was ~16 minutes). See "Duration" below.

## Step 6 — Reliability: verify every scripted action, don't trust fire-and-forget

This is the single highest-value section in this skill. Every bug hit while building these
videos was the same root shape: **a scripted interaction silently didn't do what was intended,
and the script kept going anyway**, corrupting everything downstream. Structure every
interaction as **act → verify → retry-if-not**, never a bare `click()`/drag with a fixed wait.

**Click targeting**: don't click the geometric center of a hit target if real content (ink,
tiles, anything painted) can visually overlap that exact point. In propis, the hit-`<rect>` is
rendered *before* (i.e. underneath, in paint order) the letter strokes inside the same `<g>` —
a click landing on a painted stroke pixel hits that `<path>` directly and the event **never
bubbles through the sibling `<rect>`'s own `onClick`** (siblings, not ancestor/descendant — it
silently does nothing). Fix: click a few px into a guaranteed-blank margin of the hit area
(e.g. `box.y + 6`, not `box.y + box.height/2`), verified by testing that words which failed at
dead-center succeeded reliably a few px off it.

**Verify state changed, specifically**: after a click/drag, poll for the *exact* expected
outcome — not just "something happened":
```js
async function actAndVerify(doAction, checkFn, { attempts = 3, timeoutMs = 1500 } = {}) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    await doAction();
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (await checkFn()) return;
      await new Promise(r => setTimeout(r, 30));
    }
    console.log(`attempt ${attempt} did not produce the expected result, retrying`);
  }
  throw new Error("action never produced the expected result after retries");
}
```
"Expected result" must be **specific to what you just did**, not a generic signal — a toggle
that checks only "is *something* animating" will happily confirm the *previous* still-active
element and let you sail past a silently-failed click (confirmed bug: 3 words in a row landed
on the same "check passed" state while the actual DOM content was garbage — the check needs to
name the specific word/token/letter expected, not just "count > 0").

**Live-query positions, never cache them across a long interaction sequence.** A coordinate
snapshot taken once at setup can silently drift out of sync with reality partway through a long
recording (root cause not fully pinned down — suspected page scroll — but the fix is what
matters): re-query the DOM for the current element's real `getBoundingClientRect()`
**immediately before** every single interaction, not once up front. This was the exact cause of
a drag-and-drop scenario silently spelling wrong letters/random digits starting midway through
a 150-drag sequence, despite the *first* several dozen drags working perfectly — the bug is
easy to miss in a short test and only shows up at scale, so don't skip this even when a short
dry run looks clean.

**Cross-window/page-boundary transitions** (e.g. propis's page 1→2 "Следующая страница"): if
you hid the nav bar via CSS for the recording crop, its buttons are `display:none` and
Playwright's `elementHandle.click()` will refuse them as "not visible" — drive the click at the
DOM level instead (`page.evaluate(() => button.click())`), which works regardless of CSS
visibility.

**Dry-run before committing to a long recording.** Before running the real (possibly
many-minutes) take, run the *exact same script* with short fixed durations substituted for real
timings (a simple regex swap on the durations array/constant is enough) to validate the whole
mechanical flow end-to-end — clicking, panning, page turns, whatever — in under two minutes.
This caught three separate bugs (wrong click point, wrong verification check, a hidden nav
button) before they cost 15+ minutes of wasted real recording each.

## Step 7 — Recording, trimming, encoding

**Playwright + ffmpeg setup in this sandbox** (verify paths/versions differ elsewhere):
```js
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs"; // global install, not a project dep
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-*/chrome-linux/chrome" });
const context = await browser.newContext({
  viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1,
  recordVideo: { dir: VIDEO_DIR, size: { width: 1080, height: 1350 } }, // match viewport exactly, no distortion
});
```
ffmpeg binary: `/opt/pw-browsers/ffmpeg-*/ffmpeg-linux` — Playwright's own bundled build. In
this sandbox it's compiled **webm/VP8 only** (no h264/mp4 encoder, no `-vf fps=`/`tile=`/
`drawtext` filters, no `null` muxer) — check what filters/muxers are actually available before
relying on one (`ffmpeg -h full` or just try it and read the error). Don't try to install a
fuller ffmpeg — respect any "don't install new packages" constraint from the user.

**Trimming: never trust arithmetic from logged real-world timestamps.** Playwright's recorded
video timeline can run measurably slower *or* faster than real elapsed time under this
sandbox's CPU load (observed ratios from ~1.08× to ~1.4×, not constant, not predictable from
duration alone) — a trim point computed as "script logged tap N at real-time T, so it must be
at video-time T" is wrong, sometimes by 10+ seconds on a long recording. Instead, always find
cut points **empirically** from the actual video content:
```bash
for t in <candidates>; do
  ffmpeg -y -ss $t -i raw.webm -frames:v 1 -vf "scale=220:-1" "thumb-$t.png"
done
```
then visually inspect (Read tool) and binary-search down to the exact frame where the state you
want (clean static / animation just starting) actually appears. This is not optional
polish — it's the only reliable way to trim correctly in this environment.

**Verify a background-encoded file is actually complete, not just present.** A long ffmpeg job
run via a detached/backgrounded shell can get silently killed by an environment or session
restart partway through — the resulting `.webm`'s container header can still claim the full
intended duration (written speculatively) while the actual frame data is truncated a few
seconds in. `ffprobe`/`ffmpeg -i`'s printed `Duration:` line is **not sufficient** verification.
Confirm by actually decoding a frame near the claimed end:
```bash
ffmpeg -y -ss <duration-minus-a-few-seconds> -i out.webm -frames:v 1 test.png
# "Output file is empty, nothing was encoded" here even though ffprobe reported a full
# Duration means the file is truncated — re-encode, don't just re-check ffprobe.
```
Prefer the harness's own tracked background execution (the `run_in_background` bash parameter,
which survives and notifies properly) over a manually-detached `nohup ... &` shell job for any
encode expected to run past a few minutes — the latter was the thing that got silently killed.

## Duration

There is no way to make a full-animation, real-interface recording of a long scenario short —
the animation speed (propis's pen, e.g.) is a fixed property of the shipped component, not
something this recording process controls. Do the arithmetic **before** committing to a take
(Step 5) and tell the user the real number; let them choose between:
- Full animation of everything (long real recording; they speed it up afterward in editing —
  confirmed an acceptable, even preferred, workflow for the propis videos).
- A curated highlight — only tap/drag a handful of key elements, each held only partway through
  its own real animation, accepting that individual elements won't visibly *finish* on screen.
- Shortening the scenario itself.

None of these is obviously "correct" — it's a real tradeoff, ask rather than assume. Once
chosen, a **background** recording (harness-tracked, see Step 7) is the right way to run
anything past a minute or two — schedule a check-in rather than blocking the conversation, and
don't fabricate progress; wait for the actual notification.

## Delivery

`SendUserFile` caps at 30MB. For anything long, budget for it: estimate a target bitrate as
`(30MB × 8) / duration_seconds` before encoding, and lean safely under 30MB (25–27MB) since VP8
rate control on real content doesn't land exactly on target. If a scenario naturally spans a
hard boundary (e.g. a page turn), splitting there instead of blind mid-content cutting keeps
each part watchable on its own — but see Step 6/7: verify the split lands on a *clean* moment on
both sides (static, not mid-transition) by scanning real frames, not by estimating from any
per-word/per-drag log. Never deliver an unverified split "because the duration looks right" —
confirm both the start and end frames of each piece.

The full unsplit/uncompressed file has no path to the user beyond `SendUserFile`'s cap — base64
through a Drive-upload-style tool is not viable for anything beyond a few MB (a 30MB video is
~40MB of base64, already impractical; don't attempt it for anything larger). If they want the
original quality/an uncut file, say so plainly rather than trying and failing quietly.

## Cleanup

Before ending the task: delete `dev-<topic>.html` and `src/dev-<topic>-preview.jsx`, confirm
`git status --short` shows nothing but `artifacts/` (untracked, not committed — that directory
is the delivery staging area per the user's own convention, not something this skill commits).
Stop any dev server / lingering background processes you started.
