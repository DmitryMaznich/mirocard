import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

for (const width of [360, 768]) test(`home statistics toolbar at ${width}px`, async ({ page }) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, route => route.abort());
  await page.setViewportSize({ width, height: 820 });
  const url = pathToFileURL(resolve(".cache/statistics-responsive/tests/responsive/home-statistics.html")).href;
  await page.goto(url);
  const stats = page.getByRole("tab", { name: "Статистика", exact: true });
  const lesson = page.getByRole("tab", { name: "Занятие", exact: true });
  await expect(stats).toBeEnabled();
  await expect(page.getByRole("tab")).toHaveCount(2);
  const bounds = await stats.boundingBox();
  expect(bounds.height).toBeGreaterThanOrEqual(44);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(820);
  mkdirSync(".cache/statistics-screenshots", { recursive: true });
  await page.screenshot({ path: `.cache/statistics-screenshots/home-${width}.png`, fullPage: true });
  await stats.click();
  await expect(page.getByRole("heading", { name: "Плюсы-минусы", exact: true })).toBeVisible();
  await expect(page.getByText("80% · 8 из 10", { exact: true }).first()).toBeVisible();
  await expect(stats).toHaveAttribute("aria-selected", "true");
  const statsBounds = await lesson.boundingBox();
  expect(statsBounds.y + statsBounds.height).toBeLessThanOrEqual(820);
  await page.screenshot({ path: `.cache/statistics-screenshots/home-topic-${width}.png`, fullPage: true });
  await lesson.click();
  await expect(page.getByRole("button", { name: /Начать занятие/ })).toBeVisible();
  await expect(page.getByText("Слушай и посчитай", { exact: true })).toBeVisible();
  for (const state of ["empty", "first-entry"]) {
    await page.goto(`${url}?state=${state}`);
    await expect(stats).toBeDisabled();
    await page.screenshot({ path: `.cache/statistics-screenshots/home-${state}-${width}.png`, fullPage: true });
  }
  await page.goto(`${url}?state=all-tools`);
  await expect(page.getByRole("tab")).toHaveCount(5);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
  await page.screenshot({ path: `.cache/statistics-screenshots/home-tools-${width}.png`, fullPage: true });
  expect(errors).toEqual([]);
});
