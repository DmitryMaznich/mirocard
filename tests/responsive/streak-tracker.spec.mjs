import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";

const sizes = [
  { name: "iphone-se", width: 320, height: 568, top: 20, bottom: 0 },
  { name: "iphone-13", width: 390, height: 844, top: 47, bottom: 34 },
  { name: "iphone-pro", width: 393, height: 852, top: 59, bottom: 34 },
  { name: "iphone-landscape", width: 844, height: 390, top: 0, bottom: 21, left: 47, right: 47 },
  { name: "iphone-se-landscape", width: 568, height: 320, top: 0, bottom: 0 },
  { name: "ipad-mini", width: 768, height: 1024, top: 24, bottom: 20 },
  { name: "ipad-landscape", width: 1024, height: 768, top: 24, bottom: 20 },
  { name: "ipad-pro", width: 1024, height: 1366, top: 24, bottom: 20 },
  { name: "ipad-split-view", width: 375, height: 900, top: 24, bottom: 20 },
];

async function expectFits(page, size) {
  const rects = await page.evaluate(() => {
    const rect = element => {
      const r = element.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
    };
    return {
      stars: [...document.querySelectorAll(".operation-manual__star")].map(rect),
      buttons: [...document.querySelectorAll(".operation-manual__btn")].map(rect),
      rows: [...document.querySelectorAll(".operation-manual__stars")].map(rect),
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
    };
  });
  expect(rects.overflow).toBe(false);
  for (const r of [...rects.stars, ...rects.buttons]) {
    expect(r.left).toBeGreaterThanOrEqual((size.left || 0) - 1);
    expect(r.right).toBeLessThanOrEqual(size.width - (size.right || 0) + 1);
    expect(r.top).toBeGreaterThanOrEqual(size.top);
    expect(r.bottom).toBeLessThanOrEqual(size.height - size.bottom + 1);
  }
  for (const r of rects.buttons) {
    expect(r.width).toBeGreaterThanOrEqual(44);
    expect(r.height).toBeGreaterThanOrEqual(44);
  }
  for (const star of rects.stars) for (const button of rects.buttons) {
    const overlaps = star.left < button.right && star.right > button.left && star.top < button.bottom && star.bottom > button.top;
    expect(overlaps).toBe(false);
  }
}

for (const size of sizes) for (const perStar of [1, 2, 3]) {
  test(`${size.name}: ${5 * perStar} stars and answer buttons fit`, async ({ page }) => {
    await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, route => route.abort());
    await page.setViewportSize({ width: size.width, height: size.height });
    const query = new URLSearchParams({ perStar, ...size, count: 5 * perStar - 1 });
    await page.goto(`/tests/responsive/streak-tracker.html?${query}`);
    await expect(page.locator(".operation-manual__star")).toHaveCount(5 * perStar);
    await expectFits(page, size);
    await page.getByRole("button", { name: "Верно", exact: true }).click();
    await expect(page.locator(".operation-manual__star--lit")).toHaveCount(5 * perStar);
    // Include the transformed lit stars and the header's larger feedback badge.
    await page.waitForTimeout(300);
    await expectFits(page, size);
    mkdirSync(".cache/streak-tracker-screenshots", { recursive: true });
    if (perStar === 3) await page.screenshot({ path: `.cache/streak-tracker-screenshots/${size.name}.png` });
    await page.getByRole("button", { name: "Неверно", exact: true }).click();
    await expect(page.locator(".operation-manual__star--lit")).toHaveCount(0);
    await expectFits(page, size);
  });
}

test("rotation keeps the same tracker and all controls onscreen", async ({ page }) => {
  const portrait = sizes.find(s => s.name === "iphone-13");
  const landscape = sizes.find(s => s.name === "iphone-landscape");
  await page.setViewportSize(portrait);
  await page.goto(`/tests/responsive/streak-tracker.html?${new URLSearchParams({ ...portrait, perStar: 3, count: 8 })}`);
  await expect(page.locator(".operation-manual__star--lit")).toHaveCount(8);
  await page.setViewportSize(landscape);
  await page.evaluate(size => {
    for (const side of ["top", "right", "bottom", "left"]) document.documentElement.style.setProperty(`--app-safe-${side}`, `${size[side] || 0}px`);
  }, landscape);
  await expectFits(page, landscape);
  await expect(page.locator(".operation-manual__star--lit")).toHaveCount(8);
});
