import { test, expect } from "@playwright/test";
import { uniqueEmail, waitForMail, registerViaUi, loginViaUi, collectPageErrors, expectNoPageErrors, addFirstStudent, openDeck, startMode, PASSWORD } from "./helpers.mjs";

test("новичок: регистрация → письмо → подтверждение → внутри → занятие → повторный вход", async ({ page }) => {
  const sink = collectPageErrors(page);
  const email = uniqueEmail("newcomer");

  await registerViaUi(page, { email });
  await expect(page.getByText(/проверьте почту|письмо/i).first()).toBeVisible();

  // «Отправить повторно» работает и не ломает экран
  await page.getByRole("button", { name: "Отправить повторно" }).click();
  await expect(page.getByRole("button", { name: /Письмо отправлено|Отправляем/ })).toBeVisible();

  const link = await waitForMail(email);
  await page.goto(new URL(link).pathname + new URL(link).search);

  await expect(page.getByText("Email подтверждён!")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Перейти в приложение" }).click();

  // После подтверждения человек внутри приложения (главный экран)
  await expect(page.locator(".home-header")).toBeVisible({ timeout: 20_000 });
  await page.screenshot({ path: `output/e2e-report/newcomer-home-${test.info().project.name}.png`, fullPage: true });

  // Первое занятие: ученик → колода каталога → режим → PIN → занятие идёт
  await addFirstStudent(page);
  await openDeck(page, "Глаголы");
  await startMode(page, 1);
  await expect(page.getByRole("button", { name: "✕" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/^1 \/ \d+/).first()).toBeVisible();

  // Выход и повторный вход тем же паролем
  await page.context().clearCookies();
  await page.evaluate(async () => {
    localStorage.clear();
    for (const d of (await indexedDB.databases?.()) ?? []) indexedDB.deleteDatabase(d.name);
  });
  await loginViaUi(page, { email, password: PASSWORD });
  await expect(page.locator(".home-header")).toBeVisible({ timeout: 20_000 });

  await expectNoPageErrors(sink);
});
