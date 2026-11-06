import {test,expect} from "@playwright/test";
async function input(page){await page.getByRole("button",{name:"Кубики брошены",exact:true}).click();await expect(page.getByRole("dialog",{name:"Бросайте кубики!",exact:true})).toHaveCount(0);}
async function start(page,reduced=true){
  if(reduced) await page.emulateMedia({reducedMotion:"reduce"});
  await page.goto("/tests/responsive/games.html");await page.getByRole("button",{name:/Налей до верха/}).click();
  await page.getByRole("textbox",{name:"Второй игрок"}).fill("Мама");
  await page.getByRole("group",{name:"Персонаж ученика",exact:true}).getByRole("button",{name:"Девочка",exact:true}).click();
  await page.getByRole("group",{name:"Персонаж второго игрока",exact:true}).getByRole("button",{name:"Женщина",exact:true}).click();
  await page.getByRole("button",{name:"На старт!"}).click();await input(page);
}
async function answer(page,a,b){await page.getByRole("button",{name:`Мирон: выпало ${a}`,exact:true}).click();await page.getByRole("button",{name:`Мама: выпало ${b}`,exact:true}).click();await page.getByRole("group",{name:"Кто нальёт больше воды?",exact:true}).getByRole("button",{name:a===b ? "Одинаково" : a>b ? "Я" : "Мама",exact:true}).click();}
async function round(page,a,b,n){await answer(page,a,b);await expect(page.locator(".race-round")).toHaveText(`Раунд ${n}`);await input(page);}
const amounts=page=>page.locator(".water-glass").evaluateAll(nodes=>nodes.map(n=>Number(n.dataset.amount)));

test("characters, comparison, exact volumes and paused pouring",async({page})=>{
  await page.setViewportSize({width:1280,height:800});await start(page,false);
  expect(await page.locator(".water-person").evaluateAll(nodes=>nodes.map(n=>n.dataset.character))).toEqual(["girl","woman"]);
  await page.getByRole("button",{name:"Мирон: выпало 5",exact:true}).click();await page.getByRole("button",{name:"Мама: выпало 3",exact:true}).click();
  const choices=page.getByRole("group",{name:"Кто нальёт больше воды?",exact:true});
  await choices.getByRole("button",{name:"Мама",exact:true}).click();expect(await amounts(page)).toEqual([0,0]);
  await choices.getByRole("button",{name:"Я",exact:true}).click();await expect(page.locator(".water-flow")).toHaveCount(2);
  await page.waitForTimeout(180);await page.getByRole("button",{name:"Пауза",exact:true}).click();
  const levels=await amounts(page);await page.waitForTimeout(500);expect(await amounts(page)).toEqual(levels);
  await page.getByRole("button",{name:"Продолжить",exact:true}).click();await expect(page.locator(".race-round")).toHaveText("Раунд 2");await input(page);
  expect(await amounts(page)).toEqual([5,3]);await expect(page.locator(".water-flow")).toHaveCount(0);
  expect(await page.locator(".water-faucet").evaluateAll(nodes=>nodes.map(n=>Number(n.dataset.open)))).toEqual([0,0]);
});
test("final full throw stays inside both glasses and gives only one tie prize",async({page})=>{
  await start(page);for(let i=0;i<3;i++) await round(page,6,6,i+2);await round(page,1,1,5);
  expect(await amounts(page)).toEqual([19,19]);await answer(page,6,3);
  await expect(page.locator(".reward-modal-overlay")).toBeVisible();
  expect(await amounts(page)).toEqual([25,22]);
  expect(await page.locator(".water-glass").evaluateAll(nodes=>nodes.every(n=>Number(n.dataset.level)>=146))).toBe(true);
  await expect(page.locator(".water-flow")).toHaveCount(0);await expect(page.locator(".reward-modal__title")).toHaveText("Ничья!");
  await page.getByRole("button",{name:"Вернуться к воде",exact:true}).click();await expect(page.locator(".video-reward-overlay")).toHaveCount(0);
  await page.getByRole("button",{name:"Наливать ещё",exact:true}).click();
  await expect(page.getByRole("textbox",{name:"Второй игрок"})).toHaveValue("Мама");
  await expect(page.getByRole("group",{name:"Персонаж второго игрока",exact:true}).getByRole("button",{name:"Женщина",exact:true})).toHaveAttribute("aria-pressed","true");
});
test("adult victory gives no child video",async({page})=>{
  await start(page);for(let i=0;i<3;i++) await round(page,1,6,i+2);await answer(page,1,2);
  await expect(page.getByRole("heading",{name:"Мама — победитель!",exact:true})).toBeVisible();await expect(page.locator(".video-reward-overlay")).toHaveCount(0);
});
for(const viewport of [{width:1280,height:800},{width:1024,height:768},{width:844,height:390},{width:390,height:844}])test(`water layout ${viewport.width}x${viewport.height}`,async({page})=>{
  await page.setViewportSize(viewport);await start(page);
  await page.evaluate(()=>{for(const s of ["top","bottom","left","right"])document.documentElement.style.setProperty(`--app-safe-${s}`,"20px");});
  await round(page,6,4,2);await round(page,5,4,3);
  await page.getByRole("button",{name:"Мирон: выпало 5",exact:true}).click();await page.getByRole("button",{name:"Мама: выпало 3",exact:true}).click();
  expect(await amounts(page)).toEqual([11,8]);
  const size=await page.evaluate(()=>({w:innerWidth,h:innerHeight,sw:document.documentElement.scrollWidth,sh:document.documentElement.scrollHeight}));
  expect(size.sw).toBeLessThanOrEqual(size.w);if(viewport.width>viewport.height)expect(size.sh).toBeLessThanOrEqual(size.h);
  const rect=await page.getByRole("button",{name:"Одинаково",exact:true}).boundingBox();expect(rect.x+rect.width).toBeLessThanOrEqual(viewport.width-20);if(viewport.width>viewport.height)expect(rect.y+rect.height).toBeLessThanOrEqual(viewport.height-20);
  const jars=await page.locator(".water-glass-vessel>path:first-child").evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().height));expect(jars[0]).toBeCloseTo(jars[1],1);
  await page.screenshot({path:`.cache/water-results/water-${viewport.width}.png`,fullPage:true});
});
