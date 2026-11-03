export const DELETION_SURVEY_SUBJECT = "Можно один вопрос о Mironium?";
export const DELETION_SURVEY_PROMISE = "Обещаю: без вашего разрешения больше не пришлю вам ни одного письма.";
export const DELETION_SURVEY_ANSWERS = [
  "Не получилось разобраться, как пользоваться приложением.",
  "Не нашлось темы, ради которой я пришёл в приложение.",
  "Приложение работало с ошибками.",
  "В нужной теме не хватало функций или настроек.",
  "Не подошло содержание заданий и материалов.",
  "Хотелось просто посмотреть, что это за приложение.",
  "Нужные материалы для печати уже получены, аккаунт больше не нужен.",
  "Пока нет времени пользоваться приложением.",
  "Не хочется хранить свои данные или данные ребёнка в приложении.",
  "Другая причина.",
];

const escape = value => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");

export function buildDeletionSurveyEmail(account, archivedAt, {
  from = "Дмитрий из Mironium <hello@mironium.com>", replyTo = "dmaznichenko@gmail.com",
} = {}) {
  const name = String(account.first_name ?? "").trim().replace(/\s+/g, " ");
  const validName = name.length > 0 && name.length <= 60 && /^[\p{L}\p{M} '\u2019-]+$/u.test(name)
    && !["test", "тест", "user", "admin", "пользователь"].includes(name.toLowerCase());
  const greeting = validName ? `Здравствуйте, ${name}!` : "Здравствуйте!";
  const elapsed = Date.parse(archivedAt) - Date.parse(account.created_at);
  const quickly = Number.isFinite(elapsed) && elapsed >= 0 && elapsed <= 86400000;
  const intro = quickly
    ? "Вы удалили аккаунт вскоре после регистрации в Mironium. Я создатель приложения, и мне очень важно понять, что побудило вас так быстро решить уйти."
    : "Вы удалили аккаунт в Mironium. Я создатель приложения, и мне очень важно понять, почему вы решили уйти.";
  const request = "Буду очень признателен, если ответите на это письмо буквально одним предложением. Если удобнее, можно прислать только номер основной причины:";
  const optional = "Если можете добавить пару слов к выбранному номеру — это особенно поможет.";
  const thanks = "Спасибо за ваше время!";
  const signature = "Дмитрий, создатель Mironium";
  const text = [greeting, intro, request, DELETION_SURVEY_ANSWERS.map((a, i) => `${i + 1}. ${a}`).join("\n"),
    optional, DELETION_SURVEY_PROMISE, thanks, signature].join("\n\n") + "\n";
  const p = value => `<p style="margin:0 0 20px">${escape(value)}</p>`;
  const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:24px;color:#25332f;background:#fff;font:16px/1.6 Arial,Helvetica,sans-serif"><div style="max-width:600px;margin:auto">${p(greeting)}${p(intro)}${p(request)}<ol style="padding-left:26px">${DELETION_SURVEY_ANSWERS.map(a => `<li style="margin-bottom:9px">${escape(a)}</li>`).join("")}</ol>${p(optional)}<p style="margin:0 0 20px"><strong>${escape(DELETION_SURVEY_PROMISE)}</strong></p>${p(thanks)}${p(signature)}</div></body></html>`;
  return { from, to: account.email, replyTo, subject: DELETION_SURVEY_SUBJECT, text, html };
}
