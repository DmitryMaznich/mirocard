import {expectSideDice} from "./gameLayout.mjs";
import { test, expect } from "@playwright/test";

async function enterNumbers(page) {
  if(await page.getByRole("button",{name:"Бросить кубики",exact:true}).isVisible()) await page.getByRole("button",{name:"Бросить кубики",exact:true}).click();
  await page.getByRole("button",{name:"Кубики брошены",exact:true}).click();
  await expect(page.getByRole("dialog",{name:"Бросайте кубики!",exact:true})).toHaveCount(0);
}
async function start(page, stopDice = true) {
  await page.goto("/tests/responsive/games.html");
  await page.getByRole("button",{name:/Гонки/}).click();
  await page.getByRole("button",{name:"На старт!"}).click();
  if (stopDice) await enterNumbers(page);
}
async function dice(page, child, adult) {
  await page.getByRole("button",{name:`Мирон: выпало ${child}`,exact:true}).click();
  await page.getByRole("button",{name:`Папа: выпало ${adult}`,exact:true}).click();
  await page.getByRole("group",{name:"Кто едет дальше?",exact:true}).getByRole("button",{name:child===adult ? "Одинаково" : child>adult ? "Я" : "Папа",exact:true}).click();
}
async function round(page, child, adult, nextRound) {
  await dice(page, child, adult);
  if (nextRound) {
    await expect(page.locator(".race-round")).toHaveText(`Раунд ${nextRound}`);
    await enterNumbers(page);
  }
}

test("physical input, comparison, pause, and return to games",async ({page}) => {
  await page.setViewportSize({width:1280,height:800});
  await start(page);
  await expect(page.getByRole("button",{name:/Поехали/})).toHaveCount(0);
  const answers = page.getByRole("group",{name:"Кто едет дальше?",exact:true});
  expect(await answers.getByRole("button").allTextContents()).toEqual(["Я","Папа","Одинаково"]);
  await expect(answers.getByRole("button",{name:"Я",exact:true})).toBeDisabled();
  await page.getByRole("button",{name:"Мирон: выпало 5",exact:true}).click();
  await expect(answers.getByRole("button",{name:"Я",exact:true})).toBeDisabled();
  await page.getByRole("button",{name:"Папа: выпало 3",exact:true}).click();
  await page.getByRole("button",{name:"Мирон: выпало 2",exact:true}).click();
  await answers.getByRole("button",{name:"Я",exact:true}).click();
  await expect(page.getByRole("status")).toHaveText("Посмотри на кубики ещё раз");
  await expect(page.getByRole("img",{name:"Мирон: 0 из 19"})).toBeVisible();
  await expect(page.getByRole("img",{name:"Папа: 0 из 19"})).toBeVisible();
  await answers.getByRole("button",{name:"Папа",exact:true}).click();
  await expect(answers.getByRole("button",{name:"Папа",exact:true})).toBeDisabled();
  await page.getByRole("button",{name:"Пауза",exact:true}).click();
  const positions = await page.locator(".race-car>span").allTextContents();
  await page.waitForTimeout(1000);
  expect(await page.locator(".race-car>span").allTextContents()).toEqual(positions);
  await page.getByRole("button",{name:"Продолжить",exact:true}).click();
  await expect(page.locator(".race-round")).toHaveText("Раунд 2");
  await enterNumbers(page);
  await expect(page.getByRole("img",{name:"Мирон: 2 из 19"})).toBeVisible();
  await expect(page.getByRole("img",{name:"Папа: 3 из 19"})).toBeVisible();
  await page.getByRole("button",{name:"К списку игр"}).click();
  await page.getByRole("button",{name:"Закончить игру"}).click();
  await expect(page.getByRole("heading",{name:"Игры",exact:true})).toBeVisible();
});

test("adult victory gives no child video",async ({page}) => {
  await start(page);
  for(let i=0;i<3;i++) await round(page,1,6,i+2);
  await round(page,1,1);
  await expect(page.getByRole("heading",{name:"Папа — победитель!"})).toBeVisible();
  await expect(page.locator(".video-reward-overlay")).toHaveCount(0);
  await expect(page.getByText("Смотреть видео",{exact:true})).toHaveCount(0);
  await page.getByRole("button",{name:"Ещё гонка"}).click();
  await page.getByRole("button",{name:"На старт!"}).click();
  await enterNumbers(page);
  await expect(page.getByRole("img",{name:"Мирон: 0 из 19"})).toBeVisible();
});

for(const result of ["win","tie"]) test(`${result} uses existing student reward once`,async ({page}) => {
  await start(page);
  for(let i=0;i<3;i++) await round(page,6,result==="tie" ? 6 : 1,i+2);
  await round(page,1,1);
  await expect(page.locator(".reward-modal-overlay")).toBeVisible();
  await expect(page.locator(".reward-modal__title")).toHaveText(result==="tie" ? "Ничья!" : "Мирон — победитель!");
  await page.getByRole("button",{name:"Вернуться к гонке"}).click();
  await expect(page.locator(".video-reward-overlay")).toHaveCount(0);
  await expect(page.getByRole("heading",{name:result==="tie" ? "Ничья!" : "Мирон — победитель!"})).toBeVisible();
  await expect(page.getByText("Смотреть видео",{exact:true})).toHaveCount(0);
});

for(const viewport of [{width:1280,height:800},{width:1024,height:768},{width:844,height:390},{width:390,height:844}]) test(`layout ${viewport.width}x${viewport.height} with safe areas`,async ({page}) => {
  await page.setViewportSize(viewport);
  await start(page, false);
  await page.evaluate(() => {
    document.documentElement.style.setProperty("--app-safe-top","20px");
    document.documentElement.style.setProperty("--app-safe-bottom","21px");
    document.documentElement.style.setProperty("--app-safe-left","20px");
    document.documentElement.style.setProperty("--app-safe-right","20px");
  });
  const ready = await page.getByRole("button",{name:"Кубики брошены",exact:true}).boundingBox();
  expect(ready.y + ready.height).toBeLessThanOrEqual(viewport.height - 21);
  expect(ready.x).toBeGreaterThanOrEqual(20);
  expect(ready.x + ready.width).toBeLessThanOrEqual(viewport.width - 20);
  await expect(page.locator(".race-roll")).toHaveCSS("opacity", "1");
  await expectSideDice(page,viewport);
  await page.screenshot({path:`.cache/games-results/rolling-${viewport.width}x${viewport.height}.png`,fullPage:true});
  await enterNumbers(page);
  await round(page,5,3,2);
  await round(page,5,5,3);
  await page.getByRole("button",{name:"Мирон: выпало 5",exact:true}).click();
  await page.getByRole("button",{name:"Папа: выпало 3",exact:true}).click();
  const sizes = await page.evaluate(() => ({width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight}));
  expect(sizes.scrollWidth).toBeLessThanOrEqual(viewport.width);
  expect(await page.locator(".race-option").evaluateAll(buttons => buttons.every(button => button.scrollWidth <= button.clientWidth))).toBe(true);
  const lastScale = await page.locator(".race-ticks").last().boundingBox();
  const controls = await page.locator(".race-controls").boundingBox();
  if(viewport.width<viewport.height) expect(lastScale.y + lastScale.height).toBeLessThanOrEqual(controls.y);
  if(viewport.width>viewport.height) expect(sizes.scrollHeight).toBeLessThanOrEqual(viewport.height);
  const rect = await page.getByRole("button",{name:"Одинаково",exact:true}).boundingBox();
  expect(rect.x+rect.width).toBeLessThanOrEqual(viewport.width-20);
  if(viewport.width>viewport.height) expect(rect.y+rect.height).toBeLessThanOrEqual(viewport.height-21);
  await expectSideDice(page,viewport);
  await page.screenshot({path:`.cache/games-results/race-${viewport.width}x${viewport.height}.png`,fullPage:true});
});

test("answer uses the adult name chosen before the race",async ({page}) => {
  await page.goto("/tests/responsive/games.html");
  await page.getByRole("button",{name:/Гонки/}).click();
  await page.getByRole("textbox",{name:"Второй игрок"}).fill("Мама");
  await page.getByRole("button",{name:"На старт!"}).click();
  await enterNumbers(page);
  const answers = page.getByRole("group",{name:"Кто едет дальше?",exact:true});
  await expect(answers.getByRole("button",{name:"Мама",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Мирон: выпало 1",exact:true}).click();
  await page.getByRole("button",{name:"Мама: выпало 3",exact:true}).click();
  await answers.getByRole("button",{name:"Мама",exact:true}).click();
  await expect(page.locator(".race-round")).toHaveText("Раунд 2");
  await enterNumbers(page);
  await expect(page.getByRole("img",{name:"Мама: 3 из 19"})).toBeVisible();
});

test("dice keep rolling until stopped, pause safely, and return after a completed move",async ({page}) => {
  await start(page, false);
  const rolling = page.getByRole("dialog",{name:"Бросайте кубики!",exact:true});
  await expect(rolling).toBeVisible();
  await expect(rolling.getByText("Мирон",{exact:true})).toBeVisible();
  const cube = page.locator(".race-cube").first();
  const before = await cube.evaluate(el => getComputedStyle(el).transform);
  await page.waitForTimeout(400);
  expect(await cube.evaluate(el => getComputedStyle(el).transform)).not.toBe(before);
  expect(await page.locator(".race-car>span").allTextContents()).toEqual(["0","0"]);
  await expect(page.locator(".race-numbers button[aria-pressed=true]")).toHaveCount(0);
  await page.getByRole("button",{name:"Пауза",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Пауза",exact:true})).toBeVisible();
  expect(await cube.evaluate(el => getComputedStyle(el).animationPlayState)).toBe("paused");
  await page.getByRole("button",{name:"Продолжить",exact:true}).click();
  await expect(rolling).toBeVisible();
  await page.getByRole("button",{name:"Остановить анимацию и ввести числа",exact:true}).click();
  await expect(rolling).toHaveCount(0);
  await expect(page.locator(".race-numbers button[aria-pressed=true]")).toHaveCount(0);
  await dice(page,2,1);
  await expect(page.getByRole("button",{name:"Бросить кубики",exact:true})).toBeVisible();
  await page.waitForTimeout(1000);
  await expect(rolling).toHaveCount(0);
  await expect(page.locator('.race-numbers button[aria-pressed=true]')).toHaveCount(2);
  await page.getByRole("button",{name:"Бросить кубики",exact:true}).click();
  await expect(rolling).toBeVisible();
  expect(await page.locator(".race-car>span").allTextContents()).toEqual(["2","1"]);
  await enterNumbers(page);
  await expect(page.getByRole("img",{name:"Мирон: 2 из 19"})).toBeVisible();
});

test("reduced motion keeps the same stop and manual input flow",async ({page}) => {
  await page.emulateMedia({reducedMotion:"reduce"});
  await start(page,false);
  expect(await page.locator(".race-cube").first().evaluate(el => getComputedStyle(el).animationName)).toBe("none");
  await enterNumbers(page);
  await expect(page.getByRole("button",{name:"Мирон: выпало 1",exact:true})).toBeEnabled();
});
