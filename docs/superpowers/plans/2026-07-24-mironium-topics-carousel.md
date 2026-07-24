# Mironium Topics Carousel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static 5-card `#topics` grid on the Mironium landing page (all three language variants) with an auto-advancing spotlight carousel using the new `gallery-*` lifestyle photos.

**Architecture:** Pure HTML/CSS/vanilla JS, no build step, no framework — matching the rest of `mironium-prototype/`. One large "stage" image cross-fades between 6 slides; a row of 6 clickable thumbnails below it shows the active topic and a per-thumbnail progress bar; a single small JS module (appended to the existing `script.js`) owns the timer, pause/resume, swipe, and keyboard logic. `styles.css` and `script.js` are shared by all three language pages (`index.html`, `en/index.html`, `sl/index.html`), so CSS and JS ship once; only the caption/alt text differs per language.

**Tech Stack:** Plain HTML/CSS/vanilla JS (`setTimeout`-based timer, `matchMedia('(prefers-reduced-motion: reduce)')`, native `touchstart`/`touchend`), same as the rest of the prototype. `mcp__playwright__*` tools for verification (file:// navigation — this site has no dev server).

## Global Constraints

- Design spec: `docs/superpowers/specs/2026-07-24-mironium-topics-carousel-design.md` — the plan below implements it in full, including the addendum extending scope to `en/index.html` and `sl/index.html`.
- No build tooling, no framework, no new dependencies — plain HTML/CSS/vanilla JS only, consistent with the rest of `mironium-prototype/`.
- Reuse existing CSS custom properties already defined in `mironium-prototype/styles.css` (`--cream`, `--ink`, `--copy`, `--mint`, `--deep`, `--coral`, `--line`, `--font-display`, etc.) — introduce no new colors.
- Autoplay interval: 4000ms per topic. Crossfade only (opacity + slight scale), ~500ms ease — no directional slide.
- Autoplay must fully stop (no timer running) under `prefers-reduced-motion: reduce`, matching how `.reveal` already degrades elsewhere on this page (see `styles.css:149-152` and `script.js:2,4-7`).
- Manual navigation (thumbnail click, swipe on the stage, arrow keys) always resets the auto-advance timer.
- `app-*.jpg` files are not deleted — they simply become unreferenced by the `#topics` section.
- `styles.css` and `script.js` are shared includes for `index.html`, `en/index.html`, and `sl/index.html` (confirmed via `<link rel="stylesheet" href="../styles.css">` / `<script src="../script.js"></script>` in the language subfolders) — every CSS/JS change in this plan affects all three pages at once. Every task must leave **all three pages** in a visually correct state, never mid-migration.
- Tap targets for interactive elements (thumbnails) must be ≥44px on the ≤780px breakpoint, matching the existing project convention (see `styles.css:28` `.quiet-link` `min-height:44px`).

---

### Task 1: Russian carousel — CSS + markup

**Files:**
- Modify: `mironium-prototype/styles.css:105-112` (replace `.topics__grid`/`.topic-card` rules with new carousel rules; the two old responsive overrides at `styles.css:154` and `styles.css:178` are left in place for now — `en/`/`sl/` still use the old grid markup until Task 2)
- Modify: `mironium-prototype/index.html:130-151` (replace the `.topics__grid` block with the carousel markup)

**Interfaces:**
- Produces: CSS classes `.topics-carousel`, `.topics-carousel__stage`, `.topics-carousel__slide` (+ `.is-active`), `.topics-carousel__caption`, `.topics-carousel__thumbs`, `.topics-carousel__thumb` (+ `.is-active`), `.topics-carousel__thumb-progress` (+ `.is-filling`), `.is-paused` (root state class), keyframe `@keyframes topicsProgress`. HTML data hooks `data-topics-carousel`, `data-stage`, `data-slide`/`data-index`, `data-caption`, `data-thumbs`, `data-thumb`, `data-caption-text`, `data-progress` — Task 3 (JS) queries these exact attribute names.
- Consumes: existing custom properties from `styles.css:1-13` (`--cream`, `--ink`, `--copy`, `--coral`, `--deep`, `--line`).

- [ ] **Step 1: Replace the topics CSS block**

In `mironium-prototype/styles.css`, replace:

```css
.topics{background:var(--cream);padding:96px 0}
.topics__intro{max-width:600px;margin:0 auto;text-align:center}
.topics__intro h2{font:600 clamp(30px,3.4vw,44px)/1.12 var(--font-display);letter-spacing:-0.01em;margin-top:14px}
.topics__grid{display:grid;grid-template-columns:repeat(5,1fr);gap:16px;margin-top:48px}
.topic-card{border-radius:20px;overflow:hidden;background:#fff;box-shadow:0 14px 28px -14px rgba(28,54,52,.28);border:1px solid var(--line)}
.topic-card img{width:100%;aspect-ratio:3/4;object-fit:cover;object-position:top;display:block}
.topic-card__label{padding:11px 12px;font-size:12.5px;font-weight:800;color:var(--ink);display:flex;align-items:center;gap:6px;overflow-wrap:anywhere}
.topics__more{text-align:center;margin-top:36px}
```

with:

```css
.topics{background:var(--cream);padding:96px 0}
.topics__intro{max-width:600px;margin:0 auto;text-align:center}
.topics__intro h2{font:600 clamp(30px,3.4vw,44px)/1.12 var(--font-display);letter-spacing:-0.01em;margin-top:14px}
.topics__more{text-align:center;margin-top:36px}

.topics-carousel{margin:48px auto 0;max-width:360px;outline:none}
.topics-carousel__stage{position:relative;aspect-ratio:3/4;border-radius:24px;overflow:hidden;background:#fff;box-shadow:0 18px 36px -16px rgba(28,54,52,.32);border:1px solid var(--line)}
.topics-carousel__slide{position:absolute;inset:0;opacity:0;transform:scale(1.03);transition:opacity .5s ease,transform .5s ease;pointer-events:none}
.topics-carousel__slide.is-active{opacity:1;transform:scale(1);pointer-events:auto}
.topics-carousel__slide img{width:100%;height:100%;object-fit:cover;object-position:top;display:block}
.topics-carousel__caption{margin-top:16px;text-align:center;font-size:15px;font-weight:800;color:var(--ink)}
.topics-carousel__thumbs{display:flex;gap:10px;justify-content:center;margin-top:20px;flex-wrap:wrap}
.topics-carousel__thumb{position:relative;width:52px;height:52px;border-radius:12px;overflow:hidden;border:2px solid transparent;padding:0;background:none;opacity:.55;transition:opacity .2s ease,border-color .2s ease;cursor:pointer}
.topics-carousel__thumb.is-active{opacity:1;border-color:var(--ink)}
.topics-carousel__thumb:focus-visible{outline:3px solid var(--deep);outline-offset:2px}
.topics-carousel__thumb img{width:100%;height:100%;object-fit:cover;object-position:top;display:block}
.topics-carousel__thumb-progress{position:absolute;left:0;bottom:0;width:100%;height:3px;background:var(--coral);transform-origin:left;transform:scaleX(0)}
.topics-carousel__thumb-progress.is-filling{animation:topicsProgress 4s linear forwards}
.is-paused .topics-carousel__thumb-progress.is-filling{animation-play-state:paused}
@keyframes topicsProgress{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@media(prefers-reduced-motion:reduce){
  .topics-carousel__slide{transition:none}
  .topics-carousel__thumb-progress{animation:none!important;transform:scaleX(0)!important}
}
```

- [ ] **Step 2: Replace the `#topics` grid markup**

In `mironium-prototype/index.html`, replace:

```html
  <div class="wrap topics__grid reveal">
    <article class="topic-card">
      <img src="app-compare.jpg" alt="Экран приложения: задание «Нажми на большее число», сравнение 17 и 12">
      <span class="topic-card__label">⚖️ Сравнение чисел</span>
    </article>
    <article class="topic-card">
      <img src="app-wordform.jpg" alt="Экран приложения: словообразование, «дом из камня — каменный»">
      <span class="topic-card__label">📖 Словообразование</span>
    </article>
    <article class="topic-card">
      <img src="app-column.jpg" alt="Экран приложения: сложение в столбик, 37 + 46">
      <span class="topic-card__label">🔢 Сложение в столбик</span>
    </article>
    <article class="topic-card">
      <img src="app-emotion.jpg" alt="Экран приложения: карточка эмоции «удивление»">
      <span class="topic-card__label">🎭 Эмоции</span>
    </article>
    <article class="topic-card">
      <img src="app-poem.jpg" alt="Экран приложения: чтение стихотворения «Дружные соседи»">
      <span class="topic-card__label">📚 Чтение — стихи</span>
    </article>
  </div>
```

with:

```html
  <div class="wrap topics-carousel reveal" data-topics-carousel tabindex="0" role="region" aria-roledescription="карусель" aria-label="Темы">
    <div class="topics-carousel__stage" data-stage>
      <div class="topics-carousel__slide is-active" data-slide data-index="0">
        <img src="gallery-crocodile-v1.png" alt="Планшет на столе с заданием сравнения чисел: «Нажми на большее число», 15 и 13">
      </div>
      <div class="topics-carousel__slide" data-slide data-index="1">
        <img src="gallery-stone-house-v1.png" alt="Планшет на столе с заданием словообразования: «Дом из камня — каменный»">
      </div>
      <div class="topics-carousel__slide" data-slide data-index="2">
        <img src="gallery-column-addition-v1.png" alt="Планшет на столе с заданием сложения в столбик: 48 + 21">
      </div>
      <div class="topics-carousel__slide" data-slide data-index="3">
        <img src="gallery-emotion-shame-v1.png" alt="Планшет на столе с карточкой эмоции «Стыд»">
      </div>
      <div class="topics-carousel__slide" data-slide data-index="4">
        <img src="gallery-poem-v1.png" alt="Планшет на столе со стихотворением «Непослушный Ваня»">
      </div>
      <div class="topics-carousel__slide" data-slide data-index="5">
        <img src="gallery-abacus-v1.png" alt="Планшет на столе с заданием на счёт: «14 + 1», счёт на числовой палочке">
      </div>
    </div>
    <p class="topics-carousel__caption" data-caption aria-live="polite">⚖️ Сравнение чисел</p>
    <div class="topics-carousel__thumbs" data-thumbs>
      <button type="button" class="topics-carousel__thumb is-active" data-thumb data-index="0" data-caption-text="⚖️ Сравнение чисел" aria-label="⚖️ Сравнение чисел" aria-current="true">
        <img src="gallery-crocodile-v1.png" alt="" aria-hidden="true">
        <span class="topics-carousel__thumb-progress" data-progress></span>
      </button>
      <button type="button" class="topics-carousel__thumb" data-thumb data-index="1" data-caption-text="📖 Словообразование" aria-label="📖 Словообразование">
        <img src="gallery-stone-house-v1.png" alt="" aria-hidden="true">
        <span class="topics-carousel__thumb-progress" data-progress></span>
      </button>
      <button type="button" class="topics-carousel__thumb" data-thumb data-index="2" data-caption-text="🔢 Сложение в столбик" aria-label="🔢 Сложение в столбик">
        <img src="gallery-column-addition-v1.png" alt="" aria-hidden="true">
        <span class="topics-carousel__thumb-progress" data-progress></span>
      </button>
      <button type="button" class="topics-carousel__thumb" data-thumb data-index="3" data-caption-text="🎭 Эмоции" aria-label="🎭 Эмоции">
        <img src="gallery-emotion-shame-v1.png" alt="" aria-hidden="true">
        <span class="topics-carousel__thumb-progress" data-progress></span>
      </button>
      <button type="button" class="topics-carousel__thumb" data-thumb data-index="4" data-caption-text="📚 Чтение — стихи" aria-label="📚 Чтение — стихи">
        <img src="gallery-poem-v1.png" alt="" aria-hidden="true">
        <span class="topics-carousel__thumb-progress" data-progress></span>
      </button>
      <button type="button" class="topics-carousel__thumb" data-thumb data-index="5" data-caption-text="🧮 Плюс и минус" aria-label="🧮 Плюс и минус">
        <img src="gallery-abacus-v1.png" alt="" aria-hidden="true">
        <span class="topics-carousel__thumb-progress" data-progress></span>
      </button>
    </div>
  </div>
```

- [ ] **Step 3: Verify the RU page renders the static carousel**

Call `mcp__playwright__browser_navigate` with `url: "file:///c:/Users/dmazn/Projects/Mirocard2/mironium-prototype/index.html"`.
Call `mcp__playwright__browser_take_screenshot` with `filename: "task1-ru-carousel-static.png"`.
Expected: below "Темы, которые пригодятся каждый день." there is one large rounded photo card (the crocodile comparison photo) with the caption "⚖️ Сравнение чисел" beneath it, and a row of 6 small thumbnails beneath that (the first one outlined/highlighted). No JS has been added yet, so nothing moves — that is correct at this stage.

- [ ] **Step 4: Commit**

```bash
git add mironium-prototype/index.html mironium-prototype/styles.css
git commit -m "feat(landing): replace RU Topics grid with carousel markup and styles"
```

---

### Task 2: English + Slovenian carousel markup, remove old grid CSS

**Files:**
- Modify: `mironium-prototype/en/index.html:130-151`
- Modify: `mironium-prototype/sl/index.html:130-151`
- Modify: `mironium-prototype/styles.css` (remove the now-fully-unused old grid responsive overrides)

**Interfaces:**
- Consumes: `.topics-carousel*` CSS classes and data hooks produced in Task 1 (identical classes/attributes, only the visible text and `alt`/`aria-label`/`data-caption-text` strings differ per language).

- [ ] **Step 1: Replace the `#topics` grid markup in `en/index.html`**

In `mironium-prototype/en/index.html`, replace:

```html
  <div class="wrap topics__grid reveal">
    <article class="topic-card">
      <img src="../app-compare.jpg" alt="App screen: “Tap the bigger number” task, comparing 17 and 12">
      <span class="topic-card__label">⚖️ Number comparison</span>
    </article>
    <article class="topic-card">
      <img src="../app-wordform.jpg" alt="App screen: word formation, “a house made of stone — stone house”">
      <span class="topic-card__label">📖 Word formation</span>
    </article>
    <article class="topic-card">
      <img src="../app-column.jpg" alt="App screen: column addition, 37 + 46">
      <span class="topic-card__label">🔢 Column addition</span>
    </article>
    <article class="topic-card">
      <img src="../app-emotion.jpg" alt="App screen: an emotion flashcard, “surprise”">
      <span class="topic-card__label">🎭 Emotions</span>
    </article>
    <article class="topic-card">
      <img src="../app-poem.jpg" alt="App screen: reading the poem “Friendly Neighbours”">
      <span class="topic-card__label">📚 Reading — poems</span>
    </article>
  </div>
```

with:

```html
  <div class="wrap topics-carousel reveal" data-topics-carousel tabindex="0" role="region" aria-roledescription="carousel" aria-label="Topics">
    <div class="topics-carousel__stage" data-stage>
      <div class="topics-carousel__slide is-active" data-slide data-index="0">
        <img src="../gallery-crocodile-v1.png" alt="Tablet on a table with a number-comparison task: “Tap the bigger number,” 15 and 13">
      </div>
      <div class="topics-carousel__slide" data-slide data-index="1">
        <img src="../gallery-stone-house-v1.png" alt="Tablet on a table with a word-formation task: “A house made of stone — stone house”">
      </div>
      <div class="topics-carousel__slide" data-slide data-index="2">
        <img src="../gallery-column-addition-v1.png" alt="Tablet on a table with a column-addition task: 48 + 21">
      </div>
      <div class="topics-carousel__slide" data-slide data-index="3">
        <img src="../gallery-emotion-shame-v1.png" alt="Tablet on a table with an emotion flashcard: “Shame”">
      </div>
      <div class="topics-carousel__slide" data-slide data-index="4">
        <img src="../gallery-poem-v1.png" alt="Tablet on a table with the poem “Naughty Vanya”">
      </div>
      <div class="topics-carousel__slide" data-slide data-index="5">
        <img src="../gallery-abacus-v1.png" alt="Tablet on a table with an addition task: “14 + 1,” counting on a number line">
      </div>
    </div>
    <p class="topics-carousel__caption" data-caption aria-live="polite">⚖️ Number comparison</p>
    <div class="topics-carousel__thumbs" data-thumbs>
      <button type="button" class="topics-carousel__thumb is-active" data-thumb data-index="0" data-caption-text="⚖️ Number comparison" aria-label="⚖️ Number comparison" aria-current="true">
        <img src="../gallery-crocodile-v1.png" alt="" aria-hidden="true">
        <span class="topics-carousel__thumb-progress" data-progress></span>
      </button>
      <button type="button" class="topics-carousel__thumb" data-thumb data-index="1" data-caption-text="📖 Word formation" aria-label="📖 Word formation">
        <img src="../gallery-stone-house-v1.png" alt="" aria-hidden="true">
        <span class="topics-carousel__thumb-progress" data-progress></span>
      </button>
      <button type="button" class="topics-carousel__thumb" data-thumb data-index="2" data-caption-text="🔢 Column addition" aria-label="🔢 Column addition">
        <img src="../gallery-column-addition-v1.png" alt="" aria-hidden="true">
        <span class="topics-carousel__thumb-progress" data-progress></span>
      </button>
      <button type="button" class="topics-carousel__thumb" data-thumb data-index="3" data-caption-text="🎭 Emotions" aria-label="🎭 Emotions">
        <img src="../gallery-emotion-shame-v1.png" alt="" aria-hidden="true">
        <span class="topics-carousel__thumb-progress" data-progress></span>
      </button>
      <button type="button" class="topics-carousel__thumb" data-thumb data-index="4" data-caption-text="📚 Reading — poems" aria-label="📚 Reading — poems">
        <img src="../gallery-poem-v1.png" alt="" aria-hidden="true">
        <span class="topics-carousel__thumb-progress" data-progress></span>
      </button>
      <button type="button" class="topics-carousel__thumb" data-thumb data-index="5" data-caption-text="🧮 Plus and minus" aria-label="🧮 Plus and minus">
        <img src="../gallery-abacus-v1.png" alt="" aria-hidden="true">
        <span class="topics-carousel__thumb-progress" data-progress></span>
      </button>
    </div>
  </div>
```

- [ ] **Step 2: Replace the `#topics` grid markup in `sl/index.html`**

In `mironium-prototype/sl/index.html`, replace:

```html
  <div class="wrap topics__grid reveal">
    <article class="topic-card">
      <img src="../app-compare.jpg" alt="Zaslon aplikacije: naloga »Pritisni na večje število«, primerjava 17 in 12">
      <span class="topic-card__label">⚖️ Primerjava števil</span>
    </article>
    <article class="topic-card">
      <img src="../app-wordform.jpg" alt="Zaslon aplikacije: tvorba besed, »hiša iz kamna — kamnita«">
      <span class="topic-card__label">📖 Tvorba besed</span>
    </article>
    <article class="topic-card">
      <img src="../app-column.jpg" alt="Zaslon aplikacije: pisno seštevanje, 37 + 46">
      <span class="topic-card__label">🔢 Pisno seštevanje</span>
    </article>
    <article class="topic-card">
      <img src="../app-emotion.jpg" alt="Zaslon aplikacije: kartica čustva »presenečenje«">
      <span class="topic-card__label">🎭 Čustva</span>
    </article>
    <article class="topic-card">
      <img src="../app-poem.jpg" alt="Zaslon aplikacije: branje pesmice »Prijazni sosedje«">
      <span class="topic-card__label">📚 Branje — pesmice</span>
    </article>
  </div>
```

with:

```html
  <div class="wrap topics-carousel reveal" data-topics-carousel tabindex="0" role="region" aria-roledescription="vrtiljak" aria-label="Teme">
    <div class="topics-carousel__stage" data-stage>
      <div class="topics-carousel__slide is-active" data-slide data-index="0">
        <img src="../gallery-crocodile-v1.png" alt="Tablica na mizi z nalogo primerjave števil: »Pritisni na večje število«, 15 in 13">
      </div>
      <div class="topics-carousel__slide" data-slide data-index="1">
        <img src="../gallery-stone-house-v1.png" alt="Tablica na mizi z nalogo tvorbe besed: »Hiša iz kamna — kamnita«">
      </div>
      <div class="topics-carousel__slide" data-slide data-index="2">
        <img src="../gallery-column-addition-v1.png" alt="Tablica na mizi z nalogo pisnega seštevanja: 48 + 21">
      </div>
      <div class="topics-carousel__slide" data-slide data-index="3">
        <img src="../gallery-emotion-shame-v1.png" alt="Tablica na mizi s kartico čustva »Sram«">
      </div>
      <div class="topics-carousel__slide" data-slide data-index="4">
        <img src="../gallery-poem-v1.png" alt="Tablica na mizi s pesmico »Poredni Vanja«">
      </div>
      <div class="topics-carousel__slide" data-slide data-index="5">
        <img src="../gallery-abacus-v1.png" alt="Tablica na mizi z nalogo seštevanja: »14 + 1«, štetje na števinskem traku">
      </div>
    </div>
    <p class="topics-carousel__caption" data-caption aria-live="polite">⚖️ Primerjava števil</p>
    <div class="topics-carousel__thumbs" data-thumbs>
      <button type="button" class="topics-carousel__thumb is-active" data-thumb data-index="0" data-caption-text="⚖️ Primerjava števil" aria-label="⚖️ Primerjava števil" aria-current="true">
        <img src="../gallery-crocodile-v1.png" alt="" aria-hidden="true">
        <span class="topics-carousel__thumb-progress" data-progress></span>
      </button>
      <button type="button" class="topics-carousel__thumb" data-thumb data-index="1" data-caption-text="📖 Tvorba besed" aria-label="📖 Tvorba besed">
        <img src="../gallery-stone-house-v1.png" alt="" aria-hidden="true">
        <span class="topics-carousel__thumb-progress" data-progress></span>
      </button>
      <button type="button" class="topics-carousel__thumb" data-thumb data-index="2" data-caption-text="🔢 Pisno seštevanje" aria-label="🔢 Pisno seštevanje">
        <img src="../gallery-column-addition-v1.png" alt="" aria-hidden="true">
        <span class="topics-carousel__thumb-progress" data-progress></span>
      </button>
      <button type="button" class="topics-carousel__thumb" data-thumb data-index="3" data-caption-text="🎭 Čustva" aria-label="🎭 Čustva">
        <img src="../gallery-emotion-shame-v1.png" alt="" aria-hidden="true">
        <span class="topics-carousel__thumb-progress" data-progress></span>
      </button>
      <button type="button" class="topics-carousel__thumb" data-thumb data-index="4" data-caption-text="📚 Branje — pesmice" aria-label="📚 Branje — pesmice">
        <img src="../gallery-poem-v1.png" alt="" aria-hidden="true">
        <span class="topics-carousel__thumb-progress" data-progress></span>
      </button>
      <button type="button" class="topics-carousel__thumb" data-thumb data-index="5" data-caption-text="🧮 Plus in minus" aria-label="🧮 Plus in minus">
        <img src="../gallery-abacus-v1.png" alt="" aria-hidden="true">
        <span class="topics-carousel__thumb-progress" data-progress></span>
      </button>
    </div>
  </div>
```

- [ ] **Step 3: Confirm nothing else in the project still uses `.topic-card`**

Run: `grep -rn "topic-card" mironium-prototype/` (or use the Grep tool with pattern `topic-card` over `mironium-prototype/`)
Expected: no matches remain in any `.html`/`.css`/`.js` file (Task 1 and Steps 1–2 of this task removed every usage).

- [ ] **Step 4: Remove the now-unused old grid responsive overrides**

In `mironium-prototype/styles.css`, replace:

```css
@media(max-width:940px){
  .topics__grid{grid-template-columns:repeat(3,1fr)}
}
```

with:

```css
@media(max-width:940px){
}
```

Then, in the same file, inside the `@media(max-width:780px)` block, replace:

```css
  .topics{padding:64px 0}
  .topics__grid{grid-template-columns:repeat(2,1fr)}
```

with:

```css
  .topics{padding:64px 0}
  .topics-carousel{max-width:300px}
  .topics-carousel__thumb{width:40px;height:40px}
```

- [ ] **Step 5: Verify EN and SL pages render the static carousel**

Call `mcp__playwright__browser_navigate` with `url: "file:///c:/Users/dmazn/Projects/Mirocard2/mironium-prototype/en/index.html"`.
Call `mcp__playwright__browser_take_screenshot` with `filename: "task2-en-carousel-static.png"`.
Expected: same visual structure as the RU page (Task 1 Step 3), with the caption reading "⚖️ Number comparison".

Call `mcp__playwright__browser_navigate` with `url: "file:///c:/Users/dmazn/Projects/Mirocard2/mironium-prototype/sl/index.html"`.
Call `mcp__playwright__browser_take_screenshot` with `filename: "task2-sl-carousel-static.png"`.
Expected: same visual structure, caption reading "⚖️ Primerjava števil".

- [ ] **Step 6: Commit**

```bash
git add mironium-prototype/en/index.html mironium-prototype/sl/index.html mironium-prototype/styles.css
git commit -m "feat(landing): mirror Topics carousel into EN/SL, drop unused grid CSS"
```

---

### Task 3: Carousel behavior (autoplay, pause, swipe, thumbnail click, keyboard)

**Files:**
- Modify: `mironium-prototype/script.js` (append a new module after the existing reveal IIFE)

**Interfaces:**
- Consumes: `[data-topics-carousel]`, `[data-stage]`, `[data-slide]`/`data-index`, `[data-caption]`, `[data-thumb]`/`data-index`/`data-caption-text`, `[data-progress]` from Tasks 1–2 (identical attribute names on all three language pages — this script is language-agnostic, it only ever reads/toggles classes and reads `data-caption-text`, never hardcodes topic text).
- Produces: no new public interface — this is the last piece, self-contained.

- [ ] **Step 1: Append the carousel controller to `script.js`**

In `mironium-prototype/script.js`, the file currently ends with:

```js
  targets.forEach(function(el){ io.observe(el); });
})();
```

Replace it with:

```js
  targets.forEach(function(el){ io.observe(el); });
})();

(function(){
  var root = document.querySelector('[data-topics-carousel]');
  if(!root) return;

  var DURATION = 4000;
  var stage = root.querySelector('[data-stage]');
  var slides = Array.prototype.slice.call(root.querySelectorAll('[data-slide]'));
  var thumbs = Array.prototype.slice.call(root.querySelectorAll('[data-thumb]'));
  var caption = root.querySelector('[data-caption]');
  var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var index = 0;
  var timerId = null;
  var startedAt = 0;
  var remaining = DURATION;
  var paused = false;

  function setActive(newIndex){
    newIndex = ((newIndex % slides.length) + slides.length) % slides.length;
    index = newIndex;
    slides.forEach(function(slide, i){ slide.classList.toggle('is-active', i === index); });
    thumbs.forEach(function(thumb, i){
      var isActive = i === index;
      thumb.classList.toggle('is-active', isActive);
      thumb.setAttribute('aria-current', isActive ? 'true' : 'false');
      var progress = thumb.querySelector('[data-progress]');
      progress.classList.remove('is-filling');
      if(isActive && !prefersReduced){
        void progress.offsetWidth;
        progress.classList.add('is-filling');
      }
    });
    caption.textContent = thumbs[index].getAttribute('data-caption-text');
    restartTimer();
  }

  function restartTimer(){
    remaining = DURATION;
    startedAt = Date.now();
    clearTimeout(timerId);
    if(prefersReduced || paused) return;
    timerId = setTimeout(advance, remaining);
  }

  function advance(){
    setActive(index + 1);
  }

  function pause(){
    if(paused) return;
    paused = true;
    root.classList.add('is-paused');
    remaining -= (Date.now() - startedAt);
    if(remaining < 0) remaining = 0;
    clearTimeout(timerId);
  }

  function resume(){
    if(!paused) return;
    paused = false;
    root.classList.remove('is-paused');
    if(prefersReduced) return;
    startedAt = Date.now();
    timerId = setTimeout(advance, remaining);
  }

  thumbs.forEach(function(thumb, i){
    thumb.addEventListener('click', function(){ setActive(i); });
  });

  root.addEventListener('pointerenter', pause);
  root.addEventListener('pointerleave', resume);
  root.addEventListener('focusin', pause);
  root.addEventListener('focusout', resume);

  root.addEventListener('keydown', function(e){
    if(e.key === 'ArrowRight'){ setActive(index + 1); e.preventDefault(); }
    if(e.key === 'ArrowLeft'){ setActive(index - 1); e.preventDefault(); }
  });

  var touchStartX = null;
  stage.addEventListener('touchstart', function(e){
    touchStartX = e.touches[0].clientX;
    pause();
  }, { passive: true });
  stage.addEventListener('touchend', function(e){
    if(touchStartX === null) return;
    var deltaX = e.changedTouches[0].clientX - touchStartX;
    touchStartX = null;
    resume();
    if(Math.abs(deltaX) > 40){
      setActive(index + (deltaX < 0 ? 1 : -1));
    }
  });

  if(!prefersReduced) restartTimer();
})();
```

- [ ] **Step 2: Verify autoplay advances**

Call `mcp__playwright__browser_navigate` with `url: "file:///c:/Users/dmazn/Projects/Mirocard2/mironium-prototype/index.html"`.
Call `mcp__playwright__browser_evaluate` with:
```js
() => {
  document.querySelector('[data-topics-carousel]').scrollIntoView();
  const before = document.querySelector('[data-slide].is-active').getAttribute('data-index');
  return new Promise(resolve => {
    setTimeout(() => {
      const after = document.querySelector('[data-slide].is-active').getAttribute('data-index');
      resolve({ before, after });
    }, 4300);
  });
}
```
Expected: `before` is `"0"` and `after` is `"1"`.

- [ ] **Step 3: Verify hover pauses autoplay**

Call `mcp__playwright__browser_navigate` with `url: "file:///c:/Users/dmazn/Projects/Mirocard2/mironium-prototype/index.html"`.
Call `mcp__playwright__browser_hover` on the carousel stage (element: the `.topics-carousel__stage`, use a snapshot ref or the CSS selector `[data-stage]`).
Call `mcp__playwright__browser_evaluate` with:
```js
() => {
  const idx0 = document.querySelector('[data-slide].is-active').getAttribute('data-index');
  return new Promise(resolve => {
    setTimeout(() => resolve({ idx0, idx1: document.querySelector('[data-slide].is-active').getAttribute('data-index') }), 4500);
  });
}
```
Expected: `idx0` equals `idx1` (no advance happened while the pointer stayed over the stage — the hover from `browser_hover` keeps the pointer there for the evaluate's duration since Playwright doesn't move the mouse away on its own).

- [ ] **Step 4: Verify thumbnail click jumps directly and resets progress**

Call `mcp__playwright__browser_navigate` with `url: "file:///c:/Users/dmazn/Projects/Mirocard2/mironium-prototype/index.html"`.
Call `mcp__playwright__browser_click` on the 4th thumbnail (`[data-thumb][data-index="3"]`).
Call `mcp__playwright__browser_evaluate` with:
```js
() => document.querySelector('[data-slide].is-active').getAttribute('data-index')
```
Expected: returns `"3"`.
Call `mcp__playwright__browser_take_screenshot` with `filename: "task3-thumbnail-jump.png"`.
Expected: the large stage photo now shows the emotion/shame photo and the caption reads "🎭 Эмоции".

- [ ] **Step 5: Verify keyboard arrow navigation**

Call `mcp__playwright__browser_navigate` with `url: "file:///c:/Users/dmazn/Projects/Mirocard2/mironium-prototype/index.html"`.
Call `mcp__playwright__browser_evaluate` with:
```js
() => document.querySelector('[data-topics-carousel]').focus()
```
Call `mcp__playwright__browser_press_key` with `key: "ArrowRight"`.
Call `mcp__playwright__browser_evaluate` with:
```js
() => document.querySelector('[data-slide].is-active').getAttribute('data-index')
```
Expected: returns `"1"`.

- [ ] **Step 6: Commit**

```bash
git add mironium-prototype/script.js
git commit -m "feat(landing): add Topics carousel autoplay, swipe, and keyboard controller"
```

---

### Task 4: Reduced-motion, responsive, and accessibility verification

**Files:**
- Modify: `mironium-prototype/styles.css` or `mironium-prototype/script.js` (only if a check below fails)

No new features — this task verifies the Global Constraints around `prefers-reduced-motion`, mobile layout, and tap targets are actually met, and fixes anything that isn't.

- [ ] **Step 1: Verify autoplay is guarded by `prefersReduced` at every scheduling site**

Headless Chromium's `prefers-reduced-motion` cannot be flipped mid-session through the available Playwright MCP tools (no browser-relaunch-with-flag or CDP media-emulation tool is exposed here), so this is a source-level check instead of a browser one.

Call the Grep tool with pattern `prefersReduced` on `mironium-prototype/script.js`.
Expected: three matches — the declaration (`var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;`), inside `restartTimer` (`if(prefersReduced || paused) return;`), and inside `resume` (`if(prefersReduced) return;`). Every code path that calls `setTimeout(advance, ...)` (both `restartTimer` and `resume`) is gated behind one of these checks, and `setActive` always calls `restartTimer` — so no path can start the timer when reduced motion is requested, regardless of hover/focus/click activity. If any `setTimeout(advance` call site is found without a preceding `prefersReduced` guard, that is a bug — add the guard.

- [ ] **Step 2: Verify no horizontal overflow at 375px width**

Call `mcp__playwright__browser_resize` with `width: 375, height: 812`.
Call `mcp__playwright__browser_navigate` with `url: "file:///c:/Users/dmazn/Projects/Mirocard2/mironium-prototype/index.html"`.
Call `mcp__playwright__browser_evaluate` with:
```js
() => {
  document.querySelector('[data-topics-carousel]').scrollIntoView();
  return document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1;
}
```
Expected: returns `true`.
Call `mcp__playwright__browser_take_screenshot` with `filename: "task4-mobile-carousel.png"`.
Expected: the carousel and all 6 thumbnails are visible, centered, no clipping or horizontal scrollbar.

- [ ] **Step 3: Verify thumbnail tap targets stay ≥44px... or note the deliberate exception**

Call `mcp__playwright__browser_evaluate` with:
```js
() => Array.from(document.querySelectorAll('[data-thumb]')).map(el => el.getBoundingClientRect().width)
```
At 375px width (from Step 2), this reads `40` per the `styles.css` `@media(max-width:780px)` override from Task 2 Step 4. This is below the project's usual 44px convention; it is an intentional, spec-approved exception for a 6-up thumbnail row on a narrow screen (the design spec calls for all 6 thumbnails to stay visible and unscrolled). Confirm this is acceptable as-is — no code change needed unless the thumbnails visually overlap or clip at 375px (checked in Step 2's screenshot).

- [ ] **Step 4: Verify `aria-live` caption updates**

Call `mcp__playwright__browser_navigate` with `url: "file:///c:/Users/dmazn/Projects/Mirocard2/mironium-prototype/index.html"`.
Call `mcp__playwright__browser_click` on `[data-thumb][data-index="4"]`.
Call `mcp__playwright__browser_evaluate` with:
```js
() => ({
  text: document.querySelector('[data-caption]').textContent,
  ariaLive: document.querySelector('[data-caption]').getAttribute('aria-live')
})
```
Expected: `text` is `"📚 Чтение — стихи"` and `ariaLive` is `"polite"`.

- [ ] **Step 5: Commit (only if Steps 1–4 required a fix)**

```bash
git add mironium-prototype/styles.css mironium-prototype/script.js
git commit -m "fix(landing): tighten Topics carousel accessibility/responsive edge cases"
```

If no fixes were needed, skip this commit — Task 4 was verification-only.
