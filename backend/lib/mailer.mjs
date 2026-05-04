import nodemailer from "nodemailer";
import { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, APP_BASE_URL } from "./config.mjs";

function getTransport() {
  if (!SMTP_HOST) {
    return nodemailer.createTransport({ jsonTransport: true });
  }
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

export async function sendPasswordResetEmail(email, resetToken) {
  const transport = getTransport();
  const resetUrl = `${APP_BASE_URL}/reset?token=${resetToken}`;

  const info = await transport.sendMail({
    from: SMTP_FROM,
    to: email,
    subject: "Сброс пароля Mirocard",
    text: `Для сброса пароля перейдите по ссылке (действует 1 час):\n\n${resetUrl}\n\nЕсли вы не запрашивали сброс, проигнорируйте это письмо.`,
    html: `<p>Для сброса пароля нажмите <a href="${resetUrl}">эту ссылку</a> (действует 1 час).</p><p>Если вы не запрашивали сброс, проигнорируйте это письмо.</p>`,
  });

  if (!SMTP_HOST) {
    console.log("[mailer] Password reset email (dev):", JSON.parse(info.message).subject, "→", resetUrl);
  }
}
