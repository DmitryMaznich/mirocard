import { test, expect } from "@playwright/test";

async function start(page) {
  await page.goto("/tests/responsive/games.html");
  await page.getByRole("button",{name:/Гонки/}).click();
  await page.getByRole("button",{name:"На старт!"}).click();
}
async function dice(page, child, adult) {
  await page.getByRole("button",{name:`Мирон: выпало ${child}`,exact:true}).click();
  await page.getByRole("button",{name:`Папа: выпало ${adult}`,exact:true}).click();
  await page.getByRole("button",{name:child===adult ? "Поровну" : `Больше у игрока ${child>adult ? "Мирон" : "Папа"}`,exact:true}).click();
}
async function round(page, child, adult, nextRound) {
  await dice(page, child, adult);
  await page.getByRole("button",{name:/Поехали/}).click();
  if (nextRound) await expect(page.locator(".race-round")).toHaveText(`Раунд ${nextRound}`);
}

test("physical input, comparison, pause, and return to games",async ({page}) => {
  await page.setViewportSize({width:1280,height:800});
  await start(page);
  const move = page.getByRole("button",{name:/Поехали/});
  await expect(move).toBeDisabled();
  await dice(page,5,3);
  await page.getByRole("button",{name:"Мирон: выпало 2",exact:true}).click();
  await expect(move).toBeDisabled();
  await page.getByRole("button",{name:"Больше у игрока Мирон",exact:true}).click();
  await expect(page.getByRole("status")).toHaveText("Посмотри на кубики ещё раз");
  await expect(move).toBeDisabled();
  await page.getByRole("button",{name:"Больше у игрока Папа",exact:true}).click();
  await move.click();
  await page.getByRole("button",{name:"Пауза",exact:true}).click();
  const positions = await page.locator(".race-car>span").allTextContents();
  await page.waitForTimeout(1000);
  expect(await page.locator(".race-car>span").allTextContents()).toEqual(positions);
  await page.getByRole("button",{name:"Продолжить",exact:true}).click();
  await expect(page.locator(".race-round")).toHaveText("Раунд 2");
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
  await start(page);
  await page.evaluate(() => {
    document.documentElement.style.setProperty("--app-safe-top","20px");
    document.documentElement.style.setProperty("--app-safe-bottom","21px");
    document.documentElement.style.setProperty("--app-safe-left","20px");
    document.documentElement.style.setProperty("--app-safe-right","20px");
  });
  await round(page,5,3,2);
  await round(page,5,5,3);
  await page.getByRole("button",{name:"Мирон: выпало 5",exact:true}).click();
  await page.getByRole("button",{name:"Папа: выпало 3",exact:true}).click();
  const sizes = await page.evaluate(() => ({width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight}));
  expect(sizes.scrollWidth).toBeLessThanOrEqual(viewport.width);
  if(viewport.width>viewport.height) expect(sizes.scrollHeight).toBeLessThanOrEqual(viewport.height);
  const rect = await page.getByRole("button",{name:/Поехали/}).boundingBox();
  expect(rect.x+rect.width).toBeLessThanOrEqual(viewport.width-20);
  if(viewport.width>viewport.height) expect(rect.y+rect.height).toBeLessThanOrEqual(viewport.height-21);
  await page.screenshot({path:`.cache/games-results/race-${viewport.width}x${viewport.height}.png`,fullPage:true});
});
