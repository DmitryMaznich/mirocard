import { test, expect } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";

test("all fifteen stories keep every answer without overflow on a narrow phone", async ({ page }) => {
  const stories = JSON.parse(readFileSync("content/reading_short_stories/micro/stories.json", "utf8"));
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto("http://127.0.0.1:8099/tests/responsive/reading-micro.html", { waitUntil: "domcontentloaded" });
  for (const story of stories) {
    await page.selectOption('select[aria-label="Рассказ"]', story.id);
    await page.getByRole("button", { name: "Вопросы", exact: true }).click();
    for (const [index, [prompt, target]] of story.find.entries()) {
      await expect(page.locator(".micro-exercise-question h2")).toHaveText(prompt);
      await page.getByRole("button", { name: target, exact: true }).first().click();
      await expect(page.locator(".micro-answer-history li")).toHaveCount(index + 1);
      expect(await page.locator(".story-screen--micro").evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
      await page.getByRole("button", { name: "Следующий вопрос", exact: true }).click();
    }
    await page.getByRole("button", { name: "Обсудили", exact: true }).click();
    await expect(page.locator(".micro-answer-history li")).toHaveCount(4);
  }
});

for (const [width, height] of [[360, 800], [768, 1024], [1280, 800]]) {
  test(`inline questions keep answers until the story ends at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("http://127.0.0.1:8099/tests/responsive/reading-micro.html", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Вопросы", exact: true }).click();
    await expect(page.locator(".story-frames img")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Как зовут мальчика?" })).toBeVisible();
    await page.getByRole("button", { name: "играл", exact: true }).first().click();
    await expect(page.getByRole("status").filter({ hasText: "Посмотри в тексте ещё раз." })).toBeVisible();
    await page.getByRole("button", { name: "Вова", exact: true }).first().click();
    await expect(page.locator(".micro-answer-history li")).toHaveCount(1);
    await page.getByRole("button", { name: "Следующий вопрос", exact: true }).click();
    await page.getByRole("button", { name: "под стул", exact: true }).click();
    await expect(page.locator(".micro-answer-history li")).toHaveCount(2);
    await expect(page.locator(".micro-answer-history")).toContainText("Как зовут мальчика?");
    await expect(page.locator(".micro-answer-history")).toContainText("под стул");
    await page.getByRole("button", { name: "Следующий вопрос", exact: true }).click();
    await page.getByRole("button", { name: "мяч", exact: true }).first().click();
    await expect(page.locator(".micro-answer-history li")).toHaveCount(3);
    await page.getByRole("button", { name: "Следующий вопрос", exact: true }).click();
    await expect(page.getByRole("button", { name: "Обсудили", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Обсудили", exact: true }).click();
    await expect(page.locator(".micro-answer-history li")).toHaveCount(4);
    mkdirSync(".cache/reading-micro-screenshots", { recursive: true });
    await page.locator(".micro-answer-history").scrollIntoViewIfNeeded();
    await page.screenshot({ path: `.cache/reading-micro-screenshots/inline-completed-${width}.png` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.locator(".micro-reader-nav__next").click();
    await expect(page.locator(".reading-title")).toHaveText("Башня упала");
    await expect(page.locator(".micro-answer-history li")).toHaveCount(0);
  });
  test(`micro-story reading and text evidence fit ${width}x${height}`, async ({ page }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, (route) => route.abort());
    await page.setViewportSize({ width, height });
    await page.goto("http://127.0.0.1:8099/tests/responsive/reading-micro.html", { waitUntil: "domcontentloaded" });
    await expect(page.locator(".story-frames img")).toHaveCount(2);
    await expect(page.getByRole("combobox", { name: "Рассказ", exact: true })).toBeVisible();
    expect(await page.locator(".story-screen--micro .reading-line").first().evaluate((line) => getComputedStyle(line).justifyContent)).toBe("flex-start");
    await expect.poll(() => page.locator(".story-frames img").evaluateAll((images) => images.every((image) => image.complete && image.naturalWidth > 0))).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    mkdirSync(".cache/reading-micro-screenshots", { recursive: true });
    await page.screenshot({ path: `.cache/reading-micro-screenshots/read-${width}.png` });
    await page.locator(".micro-reader-nav__next").click();
    await expect(page.locator(".reading-title")).toHaveText("Башня упала");
    await page.locator(".micro-reader-nav__previous").click();
    await expect(page.locator(".reading-title")).toHaveText("Мяч под стулом");
    await page.getByRole("button", { name: "Ищем ответы", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Как зовут мальчика?" })).toBeVisible();
    await expect(page.locator(".story-frames img")).toHaveCount(0);
    await expect(page.locator(".story-quiz__text")).toContainText("Вова играл с мячом.");
    await page.screenshot({ path: `.cache/reading-micro-screenshots/find-${width}.png` });
    await page.getByRole("button", { name: "Показать картинки", exact: true }).click();
    await expect(page.locator(".story-frames img")).toHaveCount(2);
    await page.getByRole("button", { name: "Скрыть картинки", exact: true }).click();
    await page.getByRole("button", { name: "играл", exact: true }).first().click();
    await page.getByRole("button", { name: "Вова", exact: true }).first().click();
    await expect(page.locator("[data-outcome='prompted']")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Куда закатился мяч?" })).toBeVisible();
    await expect(page.locator(".story-frames img")).toHaveCount(0);
    await page.getByRole("button", { name: "под стул", exact: true }).click();
    await page.getByRole("button", { name: "мяч", exact: true }).first().click();
    await expect(page.getByRole("button", { name: "Пока нет ответа", exact: true })).toBeVisible();
    await expect(page.locator(".story-quiz__text")).toContainText("Вова играл с мячом.");
    await page.screenshot({ path: `.cache/reading-micro-screenshots/oral-${width}.png` });
    await page.getByRole("button", { name: "Пока нет ответа", exact: true }).click();
    await expect(page.locator("[data-outcome='none']")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    expect(errors).toEqual([]);
  });
}
