# Legal launch inputs — status and open questions

Scope decided 2026-09-23 by the product owner: **EU market only, seller is
Smart Washing d.o.o. (Slovenia), payments via Stripe only (Lava Top not
enabled), refunds = statutory minimum.** The five pages in `backend/legal/*.html`
are now full drafts written for that scope. They are drafts for a lawyer's
review, not reviewed legal text.

**Checkout stays refused (`POST /api/billing/checkout` → 503) until
`LEGAL_DOCS_VERSION` is set in production to something other than `"draft"`
— enforced in code.**

## 1. Decisions already made (reflected in the drafts)

- Seller: Smart Washing d.o.o., Kamnica 11b, 1262 Dol pri Ljubljani,
  Slovenija, VAT SI98748092.
- Governing law: Slovenia, with the mandatory consumer protection of the
  consumer's EU country of residence preserved.
- Payment: Stripe, one-time purchase per period, no auto-renewal. Prices
  (9.90 / 49.90 / 89.90 EUR) are stated as VAT-inclusive final prices.
- Right of withdrawal: lost on immediate supply of digital content, with
  prior express consent + acknowledgment (checkout checkbox, wording
  strengthened from "может ограничить" to "теряю право") and confirmation
  of that consent in the purchase email (durable medium).
- Refunds: only the statutory cases (non-conformity not fixed in a
  reasonable time, duplicate charge, account blocked through no fault of
  the user / service shut down).
- Complaints answered within 8 working days; no ADR provider recognized
  (statement + pointer to the gov.si list).
- Purchase records retained 10 years (Slovenian VAT act) — in privacy.html.
- Supervisory authority named: Informacijski pooblaščenec RS.

## 2. Placeholders the owner must fill in (`[[...]]` in the HTML)

- [ ] `matična številka` — `terms.html`, `contact.html`.
- [ ] Registering court / authority — `contact.html`.
- [ ] Share capital (`osnovni kapital`) — `contact.html`.

`grep -rn '\[\[' backend/legal` must return nothing before sign-off.

## 3. Questions for the lawyer / accountant

1. **Language.** ZVPot-1 requires Slovenian in dealings with consumers in
   Slovenia. Now available in Slovenian: all five documents (`/sl/<slug>`,
   `backend/legal/sl/`), the checkout consent checkboxes and pre-purchase
   disclaimer (RU/SL toggle on the checkout screen; the chosen language is
   stored in `checkout_consents.locale`), and the purchase-confirmation
   email (sent in the consent's language). Machine-assisted translation —
   needs a native legal proofread. Still Russian only: the rest of the app
   UI and the other transactional emails. Is that acceptable?
2. **VAT threshold.** Is it correct to charge Slovenian VAT (22%) on all EU
   B2C sales while cross-border EU B2C sales stay under €10,000/year, and
   register for OSS only once that's exceeded? Who monitors the threshold?
3. **Invoices.** Does every B2C sale need an invoice under ZDDV-1, and is
   a Stripe receipt/invoice sufficient in form and numbering?
4. **Fiscal verification (ZDavPR).** Do online card payments through Stripe
   fall under "davčno potrjevanje računov"? (Unclear — must be confirmed
   by the accountant, not assumed either way.)
5. **Registered activity.** Does Smart Washing d.o.o.'s registered activity
   (SKD code) cover selling digital educational content, or must a code be
   added? Stripe's merchant review may ask the same.
6. **Withdrawal waiver wording** — confirm the checkbox text and the
   purchase-email confirmation satisfy CRD art. 16(m) / ZVPot-1.
7. **Minors' data.** The service stores data about children (entered by
   parents/specialists), including optional health-related notes under
   explicit consent. Is the current privacy wording and consent mechanism
   sufficient, and is a DPIA needed?
8. **Account deletion** is currently soft-delete only (see
   `docs/commercial-launch-runbook.md` §6). Confirm this is acceptable for
   GDPR erasure requests, or it must become a hard delete (minus the
   10-year purchase records).
9. **Liability and content-change clauses** (terms §7, §9) — acceptable
   under Slovenian consumer law?

## 4. Data processors / DPA

- [ ] Resend (US) — transactional email. DPA + SCCs.
- [ ] Stripe — payments. Stripe's standard DPA covers this.
- [ ] Anthropic (US) — "Анализ прогресса", de-identified statistics only.
      DPA + SCCs.

## 5. Sign-off

Once §2 is filled and §3 answered (and the drafts adjusted), set
`LEGAL_DOCS_VERSION` in Railway → `mirocard-backend` → Variables to the
approval date (e.g. `2026-10-15`). That unblocks checkout and is recorded
against every `checkout_consents` row, so a dispute can be matched to the
exact document version the customer accepted.
