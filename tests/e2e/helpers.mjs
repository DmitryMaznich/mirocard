import { expect } from "@playwright/test";

// E2E_APP_PORT/E2E_MAIL_PORT let a second environment run next to one already up.
export const APP = `http://127.0.0.1:${process.env.E2E_APP_PORT || 4310}`;
export const MAIL = `http://127.0.0.1:${process.env.E2E_MAIL_PORT || 4311}`;
export const PASSWORD = "correct horse battery";

// The app allows 10 registrations/hour per client IP, and every test comes from
// 127.0.0.1. The backend trusts X-Forwarded-For (finding R6), so each test poses
// as a distinct client — the same thing hundreds of real newcomers are.
export function randomIp() {
  const b = () => 1 + Math.floor(Math.random() * 250);
  return `10.${b()}.${b()}.${b()}`;
}

// Only same-origin API calls: adding the header to every request breaks the
// CORS preflight of third-party fonts (fonts.gstatic.com).
export async function asDistinctClient(page) {
  const ip = randomIp();
  await page.route("**/api/**", (route) =>
    route.continue({ headers: { ...route.request().headers(), "x-forwarded-for": ip } }));
}

export function uniqueEmail(tag) {
  return `${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.test`;
}

export async function waitForMail(email, { pathPart = "/verify-email", timeoutMs = 10_000 } = {}) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    const msgs = await (await fetch(`${MAIL}/messages?to=${encodeURIComponent(email)}`)).json();
    const link = msgs.map((m) => (m.text.match(/https?:\/\/\S+/g) || []).find((u) => u.includes(pathPart))).filter(Boolean).at(-1);
    if (link) return link;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`no ${pathPart} mail for ${email}`);
}

export async function registerViaUi(page, { email, password = PASSWORD, firstName = "Тест", role = "parent" }) {
  await asDistinctClient(page);
  await page.goto("/");
  // Стартовый экран — логин; ссылка на регистрацию внизу.
  await page.getByRole("button", { name: /зарегистр/i }).first().click();
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Имя *").fill(firstName);
  await page.locator("select").nth(0).selectOption(role);
  await page.locator("select").nth(1).selectOption("other");
  await page.getByPlaceholder("Пароль (минимум 8 символов) *").fill(password);
  // Only the required personal-data consent; the news opt-in (name=marketingOptIn)
  // must stay unchecked by default -- that is what opt-in means.
  await page.locator(".auth-consent input[type=checkbox]:not([name=marketingOptIn])").check();
  await page.getByRole("button", { name: "Создать аккаунт" }).click();
}

export async function createVerifiedAccountViaApi({ email, password = PASSWORD }) {
  const reg = await fetch(`${APP}/api/auth/register`, {
    method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-For": randomIp() },
    body: JSON.stringify({ email, password, firstName: "Тест", role: "parent", referralSource: "other", consentPersonalData: true }),
  });
  if (reg.status !== 201) throw new Error(`register ${reg.status}`);
  const link = new URL(await waitForMail(email));
  const ver = await fetch(`${APP}/api/auth/verify-email?token=${link.searchParams.get("token")}`);
  return { token: (await ver.json()).token };
}

export async function loginViaUi(page, { email, password = PASSWORD }) {
  await page.goto("/");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Пароль", { exact: true }).fill(password);
  await page.getByRole("button", { name: /^войти$/i }).click();
}

export function collectPageErrors(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text()}`); });
  page.on("response", (r) => { if (r.status() >= 500) errors.push(`HTTP ${r.status()} ${r.url()}`); });
  return { errors };
}

export async function expectNoPageErrors(sink) {
  expect(sink.errors, sink.errors.join("\n")).toEqual([]);
}

// ── Путь новичка до занятия (разведан вручную 2026-09-26) ──────────────────
// Главная → «Добавить ученика» → имя → «Сохранить» → «1 Тема» → вкладка «Всё» →
// у колоды каталога кнопка «По подписке» (в пробный период бесплатно добавляет её) →
// «Открыть» → «2 Режим» → список режимов (listitem > button) → экран параметров
// «Начать занятие» → при первом старте «Придумайте PIN-код» + «Повторите PIN-код»
// → занятие стартует само.
export const PIN = "1234";

export async function addFirstStudent(page, name = "Миша") {
  await page.getByRole("button", { name: "Добавить ученика" }).click();
  await page.getByPlaceholder("Имя ученика").fill(name);
  await page.getByRole("button", { name: "Сохранить" }).click();
  await expect(page.getByRole("button", { name: /Тема/ }).first()).toBeVisible({ timeout: 15_000 });
}

export async function openDeck(page, deckTitle) {
  await page.getByRole("button", { name: /^(1 Тема|.* Тема )/ }).first().click();
  await page.getByRole("button", { name: "Всё", exact: true }).click();
  const card = page.getByRole("article").filter({ hasText: deckTitle }).first();
  // Badge states (TopicTile.jsx): lock "По подписке" = not yet claimed; ↓ "Установить" =
  // owned but not on this device; "Открыть"/"Активна" = installed.
  await card.getByRole("button", { name: /По подписке|Установить|Открыть|Активна/ }).first().waitFor({ timeout: 15_000 });
  for (const name of ["По подписке", "Установить"]) {
    const b = card.getByRole("button", { name });
    if (await b.count()) { await b.click(); break; }
  }
  // "Установить" asks "Установить тему?" first.
  const confirm = page.getByRole("dialog").getByRole("button", { name: "Установить" });
  if (await confirm.isVisible({ timeout: 2000 }).catch(() => false)) await confirm.click();
  await card.getByRole("button", { name: "Открыть" }).click({ timeout: 30_000 });
}

export async function enterPinIfAsked(page) {
  const keypad = page.getByText(/PIN-код/);
  for (let round = 0; round < 3; round++) {
    if (!(await keypad.isVisible().catch(() => false))) return;
    for (const d of PIN) await page.getByRole("button", { name: d, exact: true }).last().click();
    await page.waitForTimeout(600);
  }
}

export async function startMode(page, modeIndex = 0) {
  await page.getByRole("button", { name: /Режим/ }).first().click();
  await page.getByRole("listitem").nth(modeIndex).getByRole("button").first().click();
  await page.getByRole("button", { name: "Начать занятие" }).last().click();
  await enterPinIfAsked(page);
  const start = page.getByRole("button", { name: "Начать занятие" });
  if (await start.isVisible().catch(() => false)) await start.last().click();
}
