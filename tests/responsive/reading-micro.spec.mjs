import { test, expect } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";

test("all choices look alike and only confirmation checks the answer on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://127.0.0.1:8099/tests/responsive/reading-micro.html", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => document.documentElement.style.setProperty("--app-safe-bottom", "34px"));
  await page.getByRole("button", { name: "Вопросы", exact: true }).click();
  await expect(page.locator(".story-screen--micro")).toHaveCSS("-webkit-tap-highlight-color", "rgba(0, 0, 0, 0)");
  const right = page.getByRole("button", { name: "Вова", exact: true }).first();
  const wrong = page.getByRole("button", { name: "играл", exact: true }).first();
  const confirm = page.getByRole("button", { name: "Ответить", exact: true });
  await expect(confirm).toBeDisabled();
  await right.hover();
  const rightHover = await right.evaluate(el => getComputedStyle(el).backgroundColor);
  await wrong.hover();
  expect(await wrong.evaluate(el => getComputedStyle(el).backgroundColor)).toBe(rightHover);
  await right.focus();
  const rightFocus = await right.evaluate(el => getComputedStyle(el).outline);
  await wrong.focus();
  expect(await wrong.evaluate(el => getComputedStyle(el).outline)).toBe(rightFocus);
  await right.click();
  await expect(page.locator(".micro-answer-history li")).toHaveCount(0);
  const rightSelected = await right.evaluate(el => getComputedStyle(el).backgroundColor);
  await wrong.click();
  expect(await wrong.evaluate(el => getComputedStyle(el).backgroundColor)).toBe(rightSelected);
  await expect(wrong).toHaveAttribute("aria-pressed", "true");
  await expect(right).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator(".story-quiz__word--found, .story-quiz__word--miss")).toHaveCount(0);
  const box = await confirm.boundingBox();
  expect(box.y + box.height).toBeLessThanOrEqual(844 - 34);
  await confirm.click();
  await expect(wrong).toHaveClass(/story-quiz__word--miss/);
  await expect(confirm).toBeDisabled();
  await expect(page.locator(".micro-exercise-question [role=status]")).toContainText("Мы ищем имя мальчика");
  await expect(page.locator(".micro-answer-history li")).toHaveCount(0);
  await right.click();
  await expect(page.locator(".micro-answer-history li")).toHaveCount(0);
  await confirm.click();
  await expect(page.locator(".micro-answer-history li")).toHaveAttribute("data-attempts", "2");
  await expect(page.locator(".micro-answer-history li")).toHaveAttribute("data-first-answer", "играл");
  await expect(page.getByRole("button", { name: "Следующий вопрос", exact: true })).toBeVisible();
  mkdirSync(".cache/reading-micro-screenshots", { recursive: true });
  await page.screenshot({ path: ".cache/reading-micro-screenshots/confirmed-selection-phone.png" });
});

for (const [width, height, safeBottom] of [[320, 844, 0], [390, 844, 34], [844, 390, 21], [768, 1024, 0], [1280, 800, 0]]) {
  test(`story navigation stays at the screen bottom at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("http://127.0.0.1:8099/tests/responsive/reading-micro.html", { waitUntil: "domcontentloaded" });
    await page.evaluate(value => document.documentElement.style.setProperty("--app-safe-bottom", `${value}px`), safeBottom);
    await expect(page.locator(".story-frame__image")).toHaveCount(2);
    const nav = page.locator(".micro-reader-nav");
    const position = await nav.boundingBox();
    expect(Math.abs(position.y + position.height - height)).toBeLessThan(2);
    await page.locator(".story-screen--micro").evaluate(el => { el.scrollTop = el.scrollHeight; });
    const after = await nav.boundingBox();
    expect(Math.abs(after.y - position.y)).toBeLessThan(1);
    expect(Math.abs(after.y + after.height - height)).toBeLessThan(2);
    const picture = await page.locator(".story-frame__image").last().boundingBox();
    expect(picture.y + picture.height).toBeLessThanOrEqual(after.y);
    const next = await page.locator(".micro-reader-nav__next").boundingBox();
    expect(next.y + next.height).toBeLessThanOrEqual(height - safeBottom);
    await page.locator(".micro-reader-nav__next").click();
    await expect(page.locator(".reading-title")).toHaveText("Башня упала");
    await page.locator(".micro-reader-nav__previous").click();
    await expect(page.locator(".reading-title")).toHaveText("Мяч под стулом");
    mkdirSync(".cache/reading-micro-screenshots", { recursive: true });
    await page.screenshot({ path: `.cache/reading-micro-screenshots/fixed-nav-${width}.png` });
  });
}

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
      await page.getByRole("button", { name: "Ответить", exact: true }).click();
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
    await page.getByRole("button", { name: "Ответить", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Мы ищем имя мальчика." })).toBeVisible();
    await page.getByRole("button", { name: "Вова", exact: true }).first().click();
    await page.getByRole("button", { name: "Ответить", exact: true }).click();
    await expect(page.locator(".micro-answer-history li")).toHaveCount(1);
    await page.getByRole("button", { name: "Следующий вопрос", exact: true }).click();
    await page.getByRole("button", { name: "под стул", exact: true }).click();
    await page.getByRole("button", { name: "Ответить", exact: true }).click();
    await expect(page.locator(".micro-answer-history li")).toHaveCount(2);
    await expect(page.locator(".micro-answer-history")).toContainText("Как зовут мальчика?");
    await expect(page.locator(".micro-answer-history")).toContainText("под стул");
    await page.getByRole("button", { name: "Следующий вопрос", exact: true }).click();
    await page.getByRole("button", { name: "мяч", exact: true }).first().click();
    await page.getByRole("button", { name: "Ответить", exact: true }).click();
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
    await page.getByRole("button", { name: "Ответить", exact: true }).click();
    await page.getByRole("button", { name: "Вова", exact: true }).first().click();
    await page.getByRole("button", { name: "Ответить", exact: true }).click();
    await expect(page.locator("[data-outcome='prompted']")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Куда закатился мяч?" })).toBeVisible();
    await expect(page.locator(".story-frames img")).toHaveCount(0);
    await page.getByRole("button", { name: "под стул", exact: true }).click();
    await page.getByRole("button", { name: "Ответить", exact: true }).click();
    await page.getByRole("button", { name: "мяч", exact: true }).first().click();
    await page.getByRole("button", { name: "Ответить", exact: true }).click();
    await expect(page.getByRole("button", { name: "Пока нет ответа", exact: true })).toBeVisible();
    await expect(page.locator(".story-quiz__text")).toContainText("Вова играл с мячом.");
    await page.screenshot({ path: `.cache/reading-micro-screenshots/oral-${width}.png` });
    await page.getByRole("button", { name: "Пока нет ответа", exact: true }).click();
    await expect(page.locator("[data-outcome='none']")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    expect(errors).toEqual([]);
  });
}
