import { RESEND_API_KEY, SMTP_FROM, APP_BASE_URL, LEGAL_DOCS_VERSION } from "./config.mjs";

async function sendEmail({ to, subject, text, html }) {
  if (!RESEND_API_KEY) {
    console.log("[mailer] (dev) email:", subject, "→", to);
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: SMTP_FROM, to, subject, text, html }),
  });

  if (!res.ok) {
    // Every call site here .catch(console.error)s this, so whatever ends
    // up in the message lands in server logs -- Resend's error body can
    // echo back request fields (recipient address, subject) depending on
    // the failure, so this is capped rather than logged verbatim. The
    // status code alone is normally enough to tell "bad request" from
    // "Resend is down" from "rate limited".
    const body = await res.text().catch(() => "");
    throw new Error(`Resend API error ${res.status}: ${body.slice(0, 200)}`);
  }
}

export async function sendPasswordResetEmail(email, resetToken) {
  const resetUrl = `${APP_BASE_URL}/reset?token=${resetToken}`;

  await sendEmail({
    to: email,
    subject: "Сброс пароля Mironium",
    text: `Для сброса пароля перейдите по ссылке (действует 1 час):\n\n${resetUrl}\n\nЕсли вы не запрашивали сброс, проигнорируйте это письмо.`,
    html: `<p>Для сброса пароля нажмите <a href="${resetUrl}">эту ссылку</a> (действует 1 час).</p><p>Если вы не запрашивали сброс, проигнорируйте это письмо.</p>`,
  });
}

export async function sendEmailVerificationEmail(email, rawToken) {
  const verifyUrl = `${APP_BASE_URL}/verify-email?token=${rawToken}`;

  await sendEmail({
    to: email,
    subject: "Подтвердите email — Mironium",
    text: `Добро пожаловать в Mironium!\n\nДля подтверждения email перейдите по ссылке (действует 24 часа):\n\n${verifyUrl}\n\nЕсли вы не регистрировались — проигнорируйте это письмо.`,
    html: `<p>Добро пожаловать в Mironium!</p><p>Для подтверждения email нажмите <a href="${verifyUrl}">эту ссылку</a> (действует 24 часа).</p><p>Если вы не регистрировались — проигнорируйте это письмо.</p>`,
  });
}

function formatRuDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}

// Sent right after a promo code (e.g. the Instagram INSTAGRAM31 campaign)
// is redeemed -- this is the durable record of exactly what access was
// granted and until when, independent of the in-app success screen.
export async function sendPromoGrantEmail(email, { code, endsAt }) {
  const until = formatRuDate(endsAt);
  await sendEmail({
    to: email,
    subject: `Промокод ${code} активирован — Mironium`,
    text: `Промокод ${code} активирован.\n\nДоступ ко всем занятиям Mironium открыт до ${until}.\n\nОплата не потребуется — карта не привязывается, автоматических списаний нет. После ${until} доступ к платным темам будет ограничен, продлить можно будет вручную в приложении.`,
    html: `<p>Промокод <strong>${code}</strong> активирован.</p><p>Доступ ко всем занятиям Mironium открыт до <strong>${until}</strong>.</p><p>Оплата не потребуется — карта не привязывается, автоматических списаний нет. После ${until} доступ к платным темам будет ограничен, продлить можно будет вручную в приложении.</p>`,
  });
}

// Sent -5d, -1d before a paid/promo period ends, and once right after it
// has ended -- see scripts/entitlement-reminder-loop.mjs, which decides
// when to call this (this function itself just sends one email).
export async function sendEntitlementReminderEmail(email, { kind, endsAt, plan }) {
  const until = formatRuDate(endsAt);
  const planLabel = { trial: "пробный период", monthly: "Месяц", half_year: "Полгода", annual: "Год", free_grant: "промо-доступ" }[plan] ?? plan;
  const subjectByKind = {
    days5: `Доступ закончится через 5 дней — Mironium`,
    days1: `Доступ закончится завтра — Mironium`,
    expired: `Доступ к платным темам закончился — Mironium`,
  };
  const bodyByKind = {
    days5: `Ваш доступ (${planLabel}) действует до ${until} — осталось около 5 дней. Продление не происходит автоматически: чтобы не потерять доступ к платным темам, продлите его вручную в приложении.`,
    days1: `Ваш доступ (${planLabel}) действует до ${until} — остался последний день. Продление не происходит автоматически: продлите доступ в приложении, если хотите заниматься дальше.`,
    expired: `Доступ (${planLabel}) закончился ${until}. Платные темы теперь недоступны. Вы можете продлить доступ в любой момент в приложении.`,
  };
  await sendEmail({
    to: email,
    subject: subjectByKind[kind] ?? subjectByKind.expired,
    text: bodyByKind[kind] ?? bodyByKind.expired,
    html: `<p>${bodyByKind[kind] ?? bodyByKind.expired}</p>`,
  });
}

// Durable purchase record, sent once a paid order is confirmed by a
// provider webhook (see backend/lib/billing-orchestrator.mjs).
const SELLER_LINE = "Smart Washing d.o.o., Kamnica 11b, 1262 Dol pri Ljubljani, Slovenija";

const PURCHASE_EMAIL = {
  ru: {
    plans: { monthly: "Месяц", half_year: "Полгода", annual: "Год" },
    dateLocale: "ru-RU",
    subject: "Оплата получена — Mironium",
    thanks: "Спасибо за покупку!",
    seller: `Продавец: ${SELLER_LINE}, НДС SI98748092`,
    plan: "План", amount: "Сумма (с НДС)", until: "Доступ действует до",
    oneTime: (until) => `Это разовая оплата — карта не сохраняется, повторных списаний не будет. После ${until} доступ к платным темам закончится, продлить можно будет вручную.`,
    withdrawal: "Перед оплатой вы согласились на немедленное предоставление доступа к цифровому контенту и подтвердили, что с этого момента утрачиваете право на отказ от покупки в течение 14 дней. Случаи, когда деньги возвращаются, описаны на странице «Возврат средств».",
    terms: "Условия использования", refunds: "Возврат средств", version: "версия",
    pathPrefix: "",
  },
  sl: {
    plans: { monthly: "Mesec", half_year: "Pol leta", annual: "Leto" },
    dateLocale: "sl-SI",
    subject: "Plačilo prejeto — Mironium",
    thanks: "Hvala za nakup!",
    seller: `Prodajalec: ${SELLER_LINE}, ID za DDV SI98748092`,
    plan: "Paket", amount: "Znesek (z DDV)", until: "Dostop velja do",
    oneTime: (until) => `Gre za enkratno plačilo — kartica se ne shrani, ponovnih bremenitev ne bo. Po ${until} se dostop do plačljivih tem zaključi, podaljšate ga lahko ročno.`,
    withdrawal: "Pred plačilom ste privolili v takojšnjo dobavo digitalne vsebine in potrdili, da s tem izgubite pravico do odstopa od pogodbe v 14 dneh. Primeri, ko vrnemo kupnino, so opisani na strani »Vračilo kupnine«.",
    terms: "Splošni pogoji uporabe", refunds: "Vračilo kupnine", version: "različica",
    pathPrefix: "/sl",
  },
};

// EU Consumer Rights Directive art. 8(7): the confirmation of a distance
// contract, on a durable medium, must record the consumer's prior consent
// to immediate supply of digital content and their acknowledgment that the
// right of withdrawal is thereby lost. Checkout refuses to create an order
// without that consent (digitalContentAck), so every paid purchase reaching
// this email has given it. Sent in the language the consent was given in.
export async function sendPurchaseConfirmationEmail(email, { plan, amountMinor, currency, endsAt, locale = "ru", legalDocsVersion = LEGAL_DOCS_VERSION }) {
  const t = PURCHASE_EMAIL[locale] ?? PURCHASE_EMAIL.ru;
  const planLabel = t.plans[plan] ?? plan;
  const amount = `${(amountMinor / 100).toFixed(2)} ${currency}`;
  const until = endsAt ? new Date(endsAt).toLocaleDateString(t.dateLocale, { day: "numeric", month: "long", year: "numeric" }) : "";
  const termsUrl = `${APP_BASE_URL}${t.pathPrefix}/terms`;
  const refundsUrl = `${APP_BASE_URL}${t.pathPrefix}/refunds`;
  await sendEmail({
    to: email,
    subject: t.subject,
    text: `${t.thanks}\n\n${t.seller}\n${t.plan}: ${planLabel}\n${t.amount}: ${amount}\n${t.until}: ${until}\n\n${t.oneTime(until)}\n\n${t.withdrawal}\n\n${t.terms} (${t.version} ${legalDocsVersion}): ${termsUrl}\n${t.refunds}: ${refundsUrl}`,
    html: `<p>${t.thanks}</p><ul><li>${t.seller}</li><li>${t.plan}: ${planLabel}</li><li>${t.amount}: ${amount}</li><li>${t.until}: ${until}</li></ul><p>${t.oneTime(until)}</p><p>${t.withdrawal}</p><p><a href="${termsUrl}">${t.terms}</a> (${t.version} ${legalDocsVersion}) · <a href="${refundsUrl}">${t.refunds}</a></p>`,
  });
}
