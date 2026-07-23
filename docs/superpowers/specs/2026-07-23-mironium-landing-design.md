# Mironium landing page (presentation site)

## Context

Mirocard's consumer-facing brand is "Mironium" — a home-learning app for a parent to run short flashcard/topic sessions with their child, reviewed by a speech therapist (logoped). Brand assets already exist (`public/brand/mironium-*.svg`, `design/mironium-landing-logo/*.svg`) and the product itself uses the `Nunito` (UI/body) + `DM Serif Display` (headings) font pairing (`src/styles.css`).

Two earlier attempts at a marketing landing page exist in the repo and are dead:
- `landing/index.html` — a stale draft containing two conflicting hero implementations (static HTML overwritten at runtime by an inline `<script>` that replaces `document.body.innerHTML`).
- `landing/v2/index.html` — a single-line stub: `<!-- Discarded draft. The actual landing is maintained in a separate session. -->`.

The live design work is `mironium-prototype/hero-v2.html`, a hand-sketched hero section (built with Codex) establishing a warm, organic visual direction: paper/cream background, ink/mint/coral/sun accent palette, blob-shaped photo crop, `DM Serif Display` + `Nunito`. It includes a `story` section (problem/promise) and a `principle` section ("gadget complements, doesn't replace") but no "About" section, despite the nav linking to `#about`.

This spec covers designing and building the actual presentation site from that starting point.

## Scope

Covers:
- A single static HTML page (no build step, no framework) at `mironium-prototype/index.html`, replacing the current placeholder file there.
- One-page structure with scroll anchors: Header/nav → Hero → "Зачем это нужно" (`#why`) → "Как это работает" (`#how`) → "О нас" (`#about`, new) → final CTA → footer.
- A refined version of the hero-v2.html visual direction (palette, type, shapes) — same ingredients, tuned for a calmer, higher-contrast, lower-visual-noise execution appropriate for the target audience.
- Copy for every section, using only confirmed real facts for "О нас".
- Scroll-triggered fade-in per section and one staggered hero entrance animation, respecting `prefers-reduced-motion`.
- Responsive collapse at ~780px matching the existing prototype's breakpoint approach.

Explicitly out of scope for this spec:
- Domain/hosting/deploy target for the finished site (stays a local static file for now; deployment is a separate decision).
- Integrating the page into the main Vite app or its build pipeline.
- A "Темы" (topics catalog) section, a pricing section, or any section not implied by the existing nav (`#why`, `#how`, `#about`) plus a final CTA.
- Testimonials, review quotes, or metrics — none exist yet; nothing is fabricated.
- `landing/` directory — left untouched, still dead.

## Audience & goal

Primary audience: parents of children with special needs (speech delay / developmental needs), who value predictability, calm, and a sense of a structured method over high-energy persuasion. Primary goal: every path on the page leads to opening the app (`https://app.mironium.com`) — this is an acquisition page, not a lead-capture form.

The hero/why/how copy stays broadly parent-facing (no clinical language in headlines); the trust signal for the target audience comes from concrete, calm facts in "Как это работает" (content reviewed by a logoped) and "О нас" (real people, not a generic team bio).

## Design

### Visual system

Palette is unchanged from the hero-v2.html sketch (`--paper:#f7f1e7; --ink:#1c3634; --mint:#4a9b8f; --deep:#2f5b57; --coral:#ef6f5e; --sun:#f3c969`), but disciplined in application:
- One dominant accent shape per section, not a cluster of decorative circles.
- Each color keeps one job: mint = primary action, coral = single inline emphasis marker, sun = one warm background accent per screen — never combined in the same cluster.
- Shadows softened from the sketch's hard-edged "sticker" `box-shadow` (`18px 20px 0 #d6e9df`) to a lower-opacity, blurred drop shadow.
- Body copy contrast raised from the sketch's `#60726d` to `#526562` on `#f7f1e7` (matches the old `landing/index.html` draft's `--copy` value) to clear AA at small sizes.

Composition follows the hero-v2.html **v3** poster-style hero (single asymmetric grid, blob-clipped photo bleeding to the edge) rather than the v2 layout (separate photo card with multiple small decorative circles + caption chip) — v3 reads as one composition instead of scattered ornaments, which fits the lower-visual-noise goal.

Typography unchanged: `DM Serif Display` for headings (already the product's brand headline font), `Nunito` for body/UI (already the product's body font) — this also means the marketing site and the app itself share a typographic identity.

### Sections

**Header** — logo (`public/brand/mironium-logo.svg`) + nav (`Зачем это нужно` `#why`, `Как это работает` `#how`, `О нас` `#about`) + primary button "Открыть приложение" → `https://app.mironium.com`. Nav hidden below 780px (button stays).

**Hero** — kicker "Занятия дома без хаоса", h1 "Всё для занятия — *под рукой.*" (mint emphasis on the last line), lead paragraph on spending less time searching/prepping and more time present with the child, two actions (primary "Попробовать Mironium" → app, quiet text-link "Посмотреть, как это работает" → `#how`), italic serif footnote "Планшет, тетрадь, ручка и немного времени вместе." Visual: v3-style poster photo (reuse `mironium-hero-v2.png`, re-crop/re-tone if it clashes with the tuned palette).

**"Зачем это нужно" (`#why`)** — adapted from the sketch's `story` section: an aside quoting the familiar pain ("Сначала найди хорошие карточки. Потом распечатай. Потом разложи…") next to the promise of starting a session in a couple of minutes. Three-fact grid: "Меньше поиска", "Меньше бумаги", plus a new third fact replacing the sketch's generic "Больше практики" with something specific to the predictability benefit — "Один и тот же понятный порядок каждый раз, ребёнку легче включиться."

**"Как это работает" (`#how`)** — adapted from the sketch's `principle` section: pull-quote card on the position that the screen complements, not replaces, hands-on learning; three numbered steps (choose topic & difficulty → child does a short session with you → you decide what's next). Add one calm sentence noting topics and pacing are reviewed by a logoped — stated as fact, not as a badge/certification graphic.

**"О нас" (`#about`, new)** — three-card grid, personal tone, real facts only: the parent-creator (built it out of their own need), Мирон (their son, the main tester), the logoped (reviews and corrects topics). No invented team, no stock bios.

**Final CTA** — "Время заниматься — не искать материалы." + primary button to the app.

**Footer** — brand mark + one-line tagline, link back to the app.

### Motion & accessibility

One staggered fade/slide-in on the hero's text elements via `animation-delay` on load; every other section fades in on scroll via `IntersectionObserver` (no animation library). No looping/bouncing decorative motion. All of it is skipped under `prefers-reduced-motion: reduce`.

Buttons ≥44px tap target, visible focus states, keyboard-reachable nav and CTAs, body text contrast ≥ AA at its size.

### Responsive

Single breakpoint around 780px, matching the existing prototype: grids collapse to one column, nav hides, primary/secondary buttons go full-width — same pattern already proven in `hero-v2.html`'s own media query.
