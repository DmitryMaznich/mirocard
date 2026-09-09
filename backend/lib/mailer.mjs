import { RESEND_API_KEY, SMTP_FROM, APP_BASE_URL } from "./config.mjs";

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
    const body = await res.text().catch(() => "");
    throw new Error(`Resend API error ${res.status}: ${body}`);
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
