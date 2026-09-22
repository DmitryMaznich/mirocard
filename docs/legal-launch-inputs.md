# Legal launch inputs — what product/legal must supply before go-live

This is a checklist, not a legal document. Nothing here should be read as
final text or a legal position — it lists exactly what a lawyer and the
product owner need to provide so the *technical* contour already built
(versioned `/terms`, `/privacy`, `/refunds`, `/cancellation`, `/contact`
pages at `backend/legal/*.html`; checkout consent capture; a
`LEGAL_DOCS_VERSION` config gate that refuses to create real orders until
it's set) can be filled in with real content and switched on.

**Until every item below is resolved and `LEGAL_DOCS_VERSION` is set in
production to something other than `"draft"`, checkout stays refused
(`POST /api/billing/checkout` returns 503) — this is enforced in code, not
just a process reminder.**

## 1. Entity and registration

- [ ] Exact legal entity operating Mironium's commercial sales (name, legal
      form, registration number).
- [ ] Registered address.
- [ ] VAT / tax registration number(s), and in which country(ies).
- [ ] Confirm whether `backend/legal/privacy.html`'s existing entity
      statement ("Smart Washing d.o.o., Словения, VAT SI98748092,
      Kamnica 11b, 1262 Dol pri Ljubljani, Slovenija" — reused from the
      existing in-app Privacy screen at `src/features/help/PrivacyContent.jsx`)
      is still correct for commercial sales, or needs to change.

## 2. Applicable law and markets

- [ ] Which country's law governs the Terms.
- [ ] Which markets/countries the product is actually sold into at launch
      (affects consumer-protection obligations, e.g. EU distance-selling
      rules on digital content and the right of withdrawal).
- [ ] Whether the digital-content-delivery consent/waiver currently in the
      checkout flow (`src/features/billing/SubscriptionScreen.jsx`'s third
      checkbox, "немедленное предоставление цифрового контента... может
      ограничить моё право на отказ от покупки") is the correct legal
      mechanism for those markets, or needs different wording/scope. This
      exact checkbox should not be treated as legally sufficient until a
      lawyer confirms it — see the code's own comment pointing here.

## 3. Final document text

- [ ] Terms of use (`backend/legal/terms.html` — currently a placeholder
      matching the existing draft at `landing/terms.html`).
- [ ] Privacy policy (`backend/legal/privacy.html` — currently reuses the
      real content already live in-app at
      `src/features/help/PrivacyContent.jsx`; needs a legal review pass
      even though it's not a blank placeholder, plus a decision on how
      long purchase/order records are retained for tax/accounting
      purposes — flagged as an open blank in that file today).
- [ ] Refund policy (`backend/legal/refunds.html` — currently a
      placeholder matching `landing/refund-policy.html`'s existing draft):
      exact conditions, time window, and process for a refund.
- [ ] Cancellation policy (`backend/legal/cancellation.html`): confirm the
      technical description already there (M0 = one-time purchase, nothing
      to "cancel", access just ends at period end) is an acceptable legal
      position, or needs a formal cancellation-right clause regardless.
- [ ] Contact page (`backend/legal/contact.html`): official contact
      channel for legal/complaints correspondence, if different from
      `hello@mironium.com`.

## 4. Contact for complaints / consumer disputes

- [ ] Designated contact (email/postal) for legal/regulatory
      correspondence.
- [ ] Whether an Alternative Dispute Resolution (ADR) body applies/must be
      named (common in EU consumer contracts) — if so, its name and link.

## 5. VAT / OSS and payment providers

- [ ] Whether VAT/OSS (One-Stop-Shop) registration is needed for the
      markets being sold into, and who handles VAT collection/remittance —
      Stripe and Lava Top's own capabilities differ here and this affects
      how `backend/lib/billing-plans.mjs`'s prices should be interpreted
      (VAT-inclusive or exclusive).
  Payment providers actually wired into the code today (see
  `backend/lib/billing-providers/`): **Stripe** (card rail) and
  **Lava Top** (МИР/СБП rail, unverified against their live API — see
  `docs/commercial-launch-runbook.md` §4). Confirm both are the intended,
  contracted providers before launch, and that their merchant agreements
  cover the entity named in §1.

## 6. Data processors / DPA / SCCs

- [ ] Data Processing Agreements (or equivalent) in place with every
      external processor the app actually sends data to. From
      `backend/legal/privacy.html`/`PrivacyContent.jsx`'s existing,
      already-accurate technical description of what's sent where:
      - **Resend** (US) — transactional email (verification, password
        reset, purchase confirmation, promo grant, expiry reminders).
      - **Stripe** (US) — card payments.
      - **Lava Top** — МИР/СБП payments.
      - **Anthropic (Claude API)** (US) — the in-app "Анализ прогресса"
        feature; only de-identified session statistics are sent (see
        `backend/lib/analysis.mjs`), no name/photo/notes text.
  For each: confirm a DPA (or the provider's standard one) is signed, and
  what cross-border-transfer safeguard applies (e.g. EU Standard
  Contractual Clauses) if the entity from §1 is EU-based.

## 7. Sign-off

- [ ] Once all of the above is resolved and the final text is in
      `backend/legal/*.html`, set `LEGAL_DOCS_VERSION` in the production
      environment (Railway → `mirocard-backend` → Variables) to a value
      that identifies this approved revision (e.g. the approval date,
      `2026-10-15`). This is what unblocks `POST /api/billing/checkout`
      and is what gets recorded against every `checkout_consents` row
      (`backend/lib/billing-repository.mjs:recordCheckoutConsent`) — so a
      later dispute can be matched back to exactly which version of the
      docs the customer agreed to.
