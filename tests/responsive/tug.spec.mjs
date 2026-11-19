import {test,expect} from "@playwright/test";
import {expectSideDice} from "./gameLayout.mjs";
async function input(page){await page.getByRole("button",{name:"Кубики брошены",exact:true}).click();await expect(page.getByRole("dialog",{name:"Бросайте кубики!",exact:true})).toHaveCount(0);}
async function start(page,{count=false,animated=false,feminine=false,adult="Папа"}={}){
  await page.emulateMedia({reducedMotion:animated ? "no-preference" : "reduce"});
  await page.goto("/tests/responsive/games.html");
  await page.getByRole("button",{name:/Перетягивание каната/}).click();
  await page.getByRole("textbox",{name:"Второй игрок",exact:true}).fill(adult);
  if(count)await page.getByRole("radio",{name:"Считаем ходы",exact:true}).click();
  if(feminine){
    await page.getByRole("group",{name:"Персонаж ученика",exact:true}).getByRole("button",{name:"Девочка",exact:true}).click();
    await page.getByRole("group",{name:"Персонаж второго игрока",exact:true}).getByRole("button",{name:"Женщина",exact:true}).click();
  }
  await page.getByRole("button",{name:"На старт!",exact:true}).click();await input(page);
}
async function dice(page,a,b,adult="Папа"){
  await page.getByRole("button",{name:`Мирон: выпало ${a}`,exact:true}).click();
  await page.getByRole("button",{name:`${adult}: выпало ${b}`,exact:true}).click();
}
async function answer(page,a,b,{count=false,adult="Папа"}={}){
  await dice(page,a,b,adult);
  await page.getByRole("group",{name:"У кого выпало больше?",exact:true}).getByRole("button",{name:a===b ? "Одинаково" : a>b ? "Мирон" : adult,exact:true}).click();
  if(count && a!==b)await page.getByRole("group",{name:"Сколько точек осталось?",exact:true}).getByRole("button",{name:String(Math.abs(a-b)),exact:true}).click();
}
async function next(page){await page.getByRole("button",{name:"Бросить кубики",exact:true}).click();await input(page);}

test("comparison controls movement, pairs are countable, and a paused pull stays still",async({page})=>{
  await page.setViewportSize({width:1280,height:800});await start(page,{count:true,animated:true});
  const scene=page.locator(".tug-scene");await dice(page,5,3);
  await expect(scene).toHaveAttribute("data-rope-position","0");await page.waitForTimeout(350);
  await expect(scene).toHaveAttribute("data-rope-position","0");
  const choices=page.getByRole("group",{name:"У кого выпало больше?",exact:true});
  await choices.getByRole("button",{name:"Папа",exact:true}).click();
  await expect(scene).toHaveAttribute("data-rope-position","0");
  await expect(page.locator('.tug-dot[data-paired="true"][data-empty="false"]')).toHaveCount(6);
  await choices.getByRole("button",{name:"Мирон",exact:true}).click();
  const counts=page.getByRole("group",{name:"Сколько точек осталось?",exact:true});
  await expect(page.locator('.tug-dot[data-paired="false"][data-empty="false"]')).toHaveCount(2);
  await counts.getByRole("button",{name:"1",exact:true}).click();await expect(scene).toHaveAttribute("data-rope-position","0");
  await counts.getByRole("button",{name:"2",exact:true}).click();
  await expect(page.locator('.tug-dot[data-active="true"]')).toHaveCount(1);
  await page.getByRole("button",{name:"К списку игр",exact:true}).click();
  const rope=await page.locator(".tug-rope").getAttribute("transform");
  await page.waitForTimeout(350);expect(await page.locator(".tug-rope").getAttribute("transform")).toBe(rope);
  expect(await page.locator('.tug-dot[data-active="true"]').evaluate(el=>getComputedStyle(el).animationPlayState)).toBe("paused");
  await page.getByRole("button",{name:"Продолжить",exact:true}).click();
  await expect(page.getByRole("button",{name:"Бросить кубики",exact:true})).toBeVisible();
  await expect(scene).toHaveAttribute("data-rope-position","-2");await expect(scene).toHaveAttribute("data-completed-rounds","1");
  await page.waitForTimeout(800);await expect(page.locator(".race-roll")).toHaveCount(0);
  await expect(page.locator(".race-prompt")).toHaveCount(0);await expect(page.locator(".tug-equation,.tug-scoreboard")).toHaveCount(0);
});

for(const result of ["child","adult","tie"])test(`five throws resolve ${result}, with the existing reward rule`,async({page})=>{
  const options={count:result==="child",feminine:result==="child",adult:result==="child" ? "Мама" : "Папа"};
  await start(page,options);
  const throws=result==="tie" ? [[6,1],[1,6],[5,3],[3,5],[4,4]] : Array.from({length:5},()=>result==="child" ? [6,1] : [1,6]);
  for(let i=0;i<5;i++){
    const [a,b]=throws[i];await answer(page,a,b,options);
    if(i<4){await expect(page.getByRole("button",{name:"Бросить кубики",exact:true})).toBeVisible();await expect(page.locator(".tug-scene")).toHaveAttribute("data-completed-rounds",String(i+1));await expect(page.locator(".reward-modal-overlay,.games-result")).toHaveCount(0);await next(page);}
  }
  await expect(page.locator(".tug-scene")).toHaveAttribute("data-completed-rounds","5");
  await expect(page.locator('.tug-rounds>span[data-done="true"]')).toHaveCount(5);
  const expectedPosition=result==="tie" ? "0" : result==="child" ? "-25" : "25";
  await expect(page.locator(".tug-scene")).toHaveAttribute("data-rope-position",expectedPosition);
  if(result!=="tie"){
    const art=await page.locator(".tug-picture").boundingBox();
    const celebration=await page.locator(".tug-celebration").boundingBox();
    expect(celebration.x).toBeGreaterThanOrEqual(art.x);
    expect(celebration.y).toBeGreaterThanOrEqual(art.y);
    expect(celebration.x+celebration.width).toBeLessThanOrEqual(art.x+art.width);
  }
  if(result==="adult"){
    await expect(page.getByRole("heading",{name:"Папа — победитель!",exact:true})).toBeVisible();
    await expect(page.locator(".reward-modal-overlay")).toHaveCount(0);
  }else{
    await expect(page.locator(".reward-modal__title")).toHaveText(result==="tie" ? "Ничья!" : "Мирон — победитель!");
    await expect(page.locator(".reward-modal-overlay")).toHaveCount(1);
    await page.getByRole("button",{name:"Вернуться к канату",exact:true}).click();
    await expect(page.locator(".reward-modal-overlay")).toHaveCount(0);
  }
  await expect(page.getByRole("button",{name:"Бросить кубики",exact:true})).toHaveCount(0);
  await page.getByRole("button",{name:"Ещё партия",exact:true}).click();
  await expect(page.getByRole("textbox",{name:"Второй игрок",exact:true})).toHaveValue(options.adult);
  await expect(page.getByRole("radio",{name:options.count ? "Считаем ходы" : "Сравниваем",exact:true})).toHaveAttribute("aria-checked","true");
  if(options.feminine)await expect(page.getByRole("group",{name:"Персонаж второго игрока",exact:true}).getByRole("button",{name:"Женщина",exact:true})).toHaveAttribute("aria-pressed","true");
  await page.getByRole("button",{name:"На старт!",exact:true}).click();await input(page);
  await expect(page.locator(".tug-scene")).toHaveAttribute("data-rope-position","0");
  await expect(page.locator(".tug-scene")).toHaveAttribute("data-completed-rounds","0");
  if(options.feminine)expect(await page.locator(".tug-puller").evaluateAll(nodes=>nodes.map(n=>n.dataset.character))).toEqual(["girl","woman"]);
});

for(const viewport of [{width:1280,height:800},{width:1024,height:768},{width:844,height:390},{width:390,height:844}])test(`tug layout ${viewport.width}x${viewport.height}`,async({page})=>{
  await page.setViewportSize(viewport);await start(page,{count:true,feminine:true,adult:"Мама"});
  await page.evaluate(()=>{for(const side of ["top","right","bottom","left"])document.documentElement.style.setProperty(`--app-safe-${side}`,"20px");});
  await dice(page,5,3,"Мама");await page.getByRole("group",{name:"У кого выпало больше?",exact:true}).getByRole("button",{name:"Мирон",exact:true}).click();
  await expect(page.getByRole("group",{name:"Сколько точек осталось?",exact:true})).toBeVisible();
  await expectSideDice(page,viewport);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  if(viewport.width>viewport.height)expect(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight)).toBe(true);
  const last=await page.getByRole("group",{name:"Сколько точек осталось?",exact:true}).getByRole("button",{name:"5",exact:true}).boundingBox();
  expect(last.x+last.width).toBeLessThanOrEqual(viewport.width-20);if(viewport.width>viewport.height)expect(last.y+last.height).toBeLessThanOrEqual(viewport.height-20);
  await page.screenshot({path:`.cache/tug-results/tug-${viewport.width}.png`,fullPage:true});
});
