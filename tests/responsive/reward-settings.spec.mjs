import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";

for (const width of [390, 768, 1024]) {
  test(`student opt-in and rollback at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/tests/responsive/reward-settings.html");
    const duration = page.getByRole("button", { name: "1 минута", exact: true });
    await expect(duration).toBeEnabled();
    await page.getByRole("button", { name: "Все звёзды", exact: true }).click();
    await page.getByRole("checkbox", { name: "Строгий подсчёт", exact: true }).uncheck();
    await page.getByRole("button", { name: "До конца ролика, не более 3 минут" }).click();
    await page.getByRole("button", { name: "Прежние правила", exact: true }).click();
    await expect(duration).toBeDisabled();
    await page.getByRole("button", { name: "Новые правила", exact: true }).click();
    await expect(page.getByRole("button", { name: "До конца ролика, не более 3 минут" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: "Все звёзды", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("checkbox", { name: "Строгий подсчёт", exact: true })).not.toBeChecked();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
    mkdirSync(".cache/reward-settings-screenshots", { recursive: true });
    await page.locator("section.reward-settings").screenshot({ path: `.cache/reward-settings-screenshots/profile-${width}.png` });
  });
  test(`lesson controls and one-star loss at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/tests/responsive/reward-settings.html?view=lesson");
    await expect(page.getByText("Изменить их можно в карточке ученика", { exact: false })).toBeVisible();
    await expect(page.getByRole("button", { name: "Все звёзды", exact: true })).toHaveCount(0);
    await expect(page.getByRole("switch", { name: "Строгий подсчёт", exact: true })).toHaveCount(0);
    await expect(page.getByText("Одна звезда", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
    await page.goto("/tests/responsive/reward-settings.html?view=tracker&perStar=3");
    await expect(page.locator(".operation-manual__star--lit")).toHaveCount(3);
    await expect(page.locator(".operation-manual__star")).toHaveCount(5);
    await page.evaluate(() => window.__rewardTest.mistake());
    await expect(page.locator(".operation-manual__star--burn")).toHaveCount(1);
    await expect(page.locator(".operation-manual__star--lit")).toHaveCount(2);
    await page.evaluate(() => window.__rewardTest.mistake());
    await expect(page.locator(".operation-manual__star--lit")).toHaveCount(2);
    await page.getByRole("button", { name: "Верно", exact: true }).click();
    await expect(page.locator(".operation-manual__star--lit")).toHaveCount(2);
    const controls = await page.locator(".operation-manual__btn").all();
    for (const button of controls) {
      const bounds = await button.boundingBox();
      expect(bounds.height).toBeGreaterThanOrEqual(44);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(900 - 34);
    }
  });
}
