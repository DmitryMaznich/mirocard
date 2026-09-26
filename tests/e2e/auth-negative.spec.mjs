import { test, expect } from "@playwright/test";
import { APP, MAIL, uniqueEmail, waitForMail, registerViaUi, loginViaUi, createVerifiedAccountViaApi, collectPageErrors, expectNoPageErrors } from "./helpers.mjs";

test("двойной клик «Создать аккаунт» создаёт ровно один аккаунт и одно письмо", async ({ page }) => {
  const email = uniqueEmail("dblclick");
  await registerViaUi(page, { email }).catch(() => {});
  await page.getByRole("button", { name: /Создать аккаунт|Создаём/ }).click({ clickCount: 2, force: true, timeout: 2000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const msgs = await (await fetch(`${MAIL}/messages?to=${encodeURIComponent(email)}`)).json();
  expect(msgs.length).toBe(1);
});

test("повторная регистрация того же email: понятное сообщение, не белый экран", async ({ page }) => {
  const sink = collectPageErrors(page);
  const email = uniqueEmail("dup");
  await createVerifiedAccountViaApi({ email });
  await registerViaUi(page, { email });
  await expect(page.getByText(/уже зарегистрирован|already registered/i)).toBeVisible();
  sink.errors = sink.errors.filter((e) => !e.includes("409"));
  await expectNoPageErrors(sink);
});

test("логин до подтверждения email: объясняет, что делать", async ({ page }) => {
  const email = uniqueEmail("unverified");
  await registerViaUi(page, { email });
  await expect(page.getByRole("button", { name: "Отправить повторно" })).toBeVisible();
  await loginViaUi(page, { email });
  await expect(page.getByText(/не подтвержд/i).first()).toBeVisible();
});

test("ссылка подтверждения, открытая второй раз, не оставляет в тупике", async ({ page }) => {
  const email = uniqueEmail("twice");
  await registerViaUi(page, { email });
  const link = new URL(await waitForMail(email));
  // Первый переход «съедает» токен (как префетч почтового клиента)
  await fetch(`${APP}/api/auth/verify-email?token=${link.searchParams.get("token")}`);
  await page.goto(link.pathname + link.search);
  // Ожидание: либо человек уже внутри, либо видит понятный путь «войти»
  await expect(page.getByText(/войти|вход|недействительн|истек/i).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: /войти|вход/i }).first()).toBeVisible();
});

test("неверный пароль: сообщение об ошибке, не зависание", async ({ page }) => {
  const email = uniqueEmail("wrongpw");
  await createVerifiedAccountViaApi({ email });
  await loginViaUi(page, { email, password: "definitely wrong" });
  await expect(page.getByText(/невер|incorrect|invalid/i).first()).toBeVisible();
});

test("забыл пароль → письмо → новый пароль → вход", async ({ page }) => {
  const email = uniqueEmail("forgot");
  await createVerifiedAccountViaApi({ email });
  await page.goto("/");
  await page.getByRole("button", { name: /забыли пароль/i }).click();
  await page.getByPlaceholder("Email").fill(email);
  await page.getByRole("button", { name: /отправ|восстанов|сброс/i }).first().click();
  const link = new URL(await waitForMail(email, { pathPart: "/reset" }));
  await page.goto(link.pathname + link.search);
  await page.locator("input[type=password]").first().fill("brand new password 1");
  if (await page.locator("input[type=password]").count() > 1) await page.locator("input[type=password]").nth(1).fill("brand new password 1");
  await page.getByRole("button", { name: /сохран|сменить|установ/i }).first().click();
  await loginViaUi(page, { email, password: "brand new password 1" });
  await expect(page.locator(".home-header")).toBeVisible({ timeout: 20_000 });
});
