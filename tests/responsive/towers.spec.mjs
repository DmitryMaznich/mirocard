import {test,expect} from "@playwright/test";
async function input(page) {
  await page.getByRole("button",{name:"Кубики брошены",exact:true}).click();
  await expect(page.getByRole("dialog",{name:"Бросайте кубики!",exact:true})).toHaveCount(0);
}
async function start(page,reduced=true) {
  if(reduced) await page.emulateMedia({reducedMotion:"reduce"});
  await page.goto("/tests/responsive/games.html");
  await page.getByRole("button",{name:/До облаков/}).click();
  await page.getByRole("textbox",{name:"Второй игрок"}).fill("Мама");
  await page.getByRole("button",{name:"На старт!"}).click();
  await input(page);
}
async function answer(page,child,adult) {
  await page.getByRole("button",{name:`Мирон: выпало ${child}`,exact:true}).click();
  await page.getByRole("button",{name:`Мама: выпало ${adult}`,exact:true}).click();
  await page.getByRole("group",{name:"Кто построит больше этажей?",exact:true}).getByRole("button",{name:child===adult ? "Одинаково" : child>adult ? "Я" : "Мама",exact:true}).click();
}
async function round(page,child,adult,next) {
  await answer(page,child,adult);
  await expect(page.locator(".race-round")).toHaveText(`Раунд ${next}`);
  await input(page);
}
const counts=page=>page.locator(".tower-building").evaluateAll(nodes=>nodes.map(n=>Number(n.dataset.floors)));

test("builds floors after comparison, alternates inhabited balconies and freezes cranes on pause",async({page})=>{
  await page.setViewportSize({width:1280,height:800});
  await start(page,false);
  const options=page.getByRole("group",{name:"Кто построит больше этажей?",exact:true});
  await page.getByRole("button",{name:"Мирон: выпало 4",exact:true}).click();
  await page.getByRole("button",{name:"Мама: выпало 2",exact:true}).click();
  await options.getByRole("button",{name:"Мама",exact:true}).click();
  expect(await counts(page)).toEqual([0,0]);
  await options.getByRole("button",{name:"Я",exact:true}).click();
  await expect(page.locator(".tower-moving-floor")).toHaveCount(2);
  await page.waitForTimeout(350);
  await page.getByRole("button",{name:"Пауза",exact:true}).click();
  const p=await page.locator(".tower-construction-step").getAttribute("data-progress");
  await page.waitForTimeout(500);
  expect(await page.locator(".tower-construction-step").getAttribute("data-progress")).toBe(p);
  await page.getByRole("button",{name:"Продолжить",exact:true}).click();
  await expect(page.locator(".race-round")).toHaveText("Раунд 2",{timeout:12000});
  expect(await counts(page)).toEqual([4,2]);
  await input(page);
  const child=page.locator(".tower-building--0");
  expect(await child.locator(".tower-balcony").evaluateAll(nodes=>nodes.map(n=>n.dataset.side))).toEqual(["left","right"]);
  await expect(child.locator(".tower-resident")).toHaveCount(2);
});

test("both cranes can place the twentieth floor, never exceed twenty, and give one tie prize",async({page})=>{
  await page.setViewportSize({width:1280,height:800});
  await start(page);
  for(let i=0;i<3;i++) await round(page,6,6,i+2);
  expect(await counts(page)).toEqual([18,18]);
  await page.emulateMedia({reducedMotion:"no-preference"});
  await answer(page,6,6);
  const last=page.locator('.tower-moving-floor[data-next-floor="20"]');
  await expect(last).toHaveCount(2);
  await expect.poll(async()=>Number(await page.locator(".tower-construction-step").getAttribute("data-progress"))).toBeGreaterThan(.3);
  expect(await last.locator(".tower-hoist").evaluateAll(nodes=>nodes.every(n=>Number(n.dataset.hookY)>58))).toBe(true);
  await page.screenshot({path:".cache/towers-results/twentieth-floor.png"});
  await expect(page.locator(".reward-modal-overlay")).toBeVisible({timeout:8000});
  expect(await counts(page)).toEqual([20,20]);
  await expect(page.locator(".tower-building--0 .tower-floor--built")).toHaveCount(20);
  await expect(page.locator(".tower-building--1 .tower-floor--built")).toHaveCount(20);
  await expect(page.locator(".reward-modal__title")).toHaveText("Ничья!");
  await page.getByRole("button",{name:"Вернуться к стройке",exact:true}).click();
  await expect(page.locator(".video-reward-overlay")).toHaveCount(0);
  await expect(page.getByRole("heading",{name:"Ничья!",exact:true})).toBeVisible();
});

test("adult victory has no video and a replay starts at zero",async({page})=>{
  await start(page);
  for(let i=0;i<3;i++) await round(page,1,6,i+2);
  await answer(page,1,2);
  await expect(page.getByRole("heading",{name:"Мама — победитель!",exact:true})).toBeVisible();
  await expect(page.locator(".video-reward-overlay")).toHaveCount(0);
  await page.getByRole("button",{name:"Строить ещё",exact:true}).click();
  await expect(page.getByRole("textbox",{name:"Второй игрок"})).toHaveValue("Мама");
  await page.getByRole("button",{name:"На старт!"}).click();
  await input(page);
  expect(await counts(page)).toEqual([0,0]);
});

for(const viewport of [{width:1280,height:800},{width:1024,height:768},{width:844,height:390},{width:390,height:844}]) test(`tower layout ${viewport.width}x${viewport.height}`,async({page})=>{
  await page.setViewportSize(viewport);
  await start(page);
  await page.evaluate(()=>{for(const side of ["top","bottom","left","right"]) document.documentElement.style.setProperty(`--app-safe-${side}`,"20px");});
  await round(page,6,4,2);
  await round(page,5,4,3);
  await page.getByRole("button",{name:"Мирон: выпало 5",exact:true}).click();
  await page.getByRole("button",{name:"Мама: выпало 3",exact:true}).click();
  expect(await counts(page)).toEqual([11,8]);
  const fits=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,height:innerHeight,scrollHeight:document.documentElement.scrollHeight}));
  expect(fits.scroll).toBeLessThanOrEqual(fits.width);
  if(viewport.width>viewport.height) expect(fits.scrollHeight).toBeLessThanOrEqual(fits.height);
  const b=await page.getByRole("button",{name:"Одинаково",exact:true}).boundingBox();
  expect(b.x+b.width).toBeLessThanOrEqual(viewport.width-20);
  if(viewport.width>viewport.height) expect(b.y+b.height).toBeLessThanOrEqual(viewport.height-20);
  const cranes=await page.locator(".tower-crane").evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().top));
  expect(cranes[0]).toBeCloseTo(cranes[1],1);
  await page.screenshot({path:`.cache/towers-results/towers-${viewport.width}.png`,fullPage:true});
});
