import {test,expect} from '@playwright/test';
async function start(page,{level='Первый успех',partner='Папа',animated=false,together=false}={}){
  await page.emulateMedia({reducedMotion:animated?'no-preference':'reduce'});
  await page.goto('/tests/responsive/games.html');
  await page.getByRole('button',{name:/Парковка/}).click();
  if(together){
    await page.getByRole('radio',{name:/^Вместе/}).click();
    await page.getByRole('textbox',{name:'Второй игрок',exact:true}).fill(partner);
  }else{
    await expect(page.getByRole('radio',{name:/^Самостоятельно/})).toHaveAttribute('aria-checked','true');
    await expect(page.getByRole('textbox',{name:'Второй игрок',exact:true})).toHaveCount(0);
  }
  await page.getByRole('radio',{name:new RegExp('^'+level)}).click();
  await page.getByRole('button',{name:'Начать',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}
async function hintedMove(page){
  await page.getByRole('button',{name:'Подсказка',exact:true}).click();
  const car=page.locator('.parking-piece[data-hint="true"]');
  await expect(car).toHaveCount(1);await car.click();
  await expect(page.locator('.parking-grid')).not.toHaveAttribute('data-phase','moving');
}

test('a started game becomes the latest topic on Home and survives a reload', async ({page})=>{
  await page.goto('/tests/responsive/games.html?recent');
  const recent=page.getByRole('region',{name:'Продолжить',exact:true});
  await page.getByRole('button',{name:/Парковка/}).click();
  await page.getByRole('button',{name:'К играм',exact:true}).click();
  await page.getByRole('button',{name:'На главный экран',exact:true}).click();
  await expect(recent.getByRole('heading',{name:'Предыдущая тема'})).toBeVisible();

  await page.reload();
  await page.getByRole('button',{name:/Парковка/}).click();
  await page.getByRole('button',{name:'Начать',exact:true}).click();
  await page.getByRole('button',{name:'К играм',exact:true}).click();
  await page.getByRole('button',{name:'Закончить игру',exact:true}).click();
  await page.getByRole('button',{name:'На главный экран',exact:true}).click();
  await expect(recent.getByRole('heading',{name:'Игры',exact:true})).toBeVisible();
  await expect(recent.getByRole('button',{name:/Парковка/})).toBeVisible();

  await page.reload();
  await page.getByRole('button',{name:'На главный экран',exact:true}).click();
  await expect(recent.getByRole('heading',{name:'Игры',exact:true})).toBeVisible();
  await expect(recent.getByRole('button',{name:/Парковка/})).toBeVisible();

  await recent.getByRole('button',{name:/Парковка.*Сменить/}).click();
  await page.getByRole('button',{name:/^Гонки/}).click();
  await expect(recent.getByRole('button',{name:/Гонки.*Сменить/})).toBeVisible();
});

test('the child completes a short puzzle and rings the bell before receiving a video',async({page})=>{
  await start(page);const board=page.locator('.parking-grid'),bell=page.getByRole('button',{name:'Колокольчик — парковка готова',exact:true});
  await expect(page.locator('.parking-piece')).toHaveCount(3);await expect(bell).toHaveCount(0);
  await page.locator('.parking-piece[data-movable="false"]').first().click({force:true});
  await expect(board).toHaveAttribute('data-moves','0');await expect(board).toHaveAttribute('data-turn','0');
  await hintedMove(page);await expect(board).toHaveAttribute('data-phase','ready');await expect(bell).toBeEnabled();
  await page.waitForTimeout(600);await expect(page.locator('.reward-modal-overlay')).toHaveCount(0);
  await bell.click();
  await expect(page.locator('.reward-modal__title')).toHaveText('Парковка готова!');
  await page.getByRole('button',{name:'Вернуться к парковке',exact:true}).click();
  await page.getByRole('button',{name:'Настроить игру',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await expect(page.getByRole('radio',{name:/^Самостоятельно/})).toHaveAttribute('aria-checked','true');
  await expect(page.getByRole('textbox',{name:'Второй игрок',exact:true})).toHaveCount(0);
});

test('the tablet desk bell plays one ring per tap and respects the sound setting',async({page})=>{
  await page.setViewportSize({width:1180,height:820});
  await start(page,{animated:true});
  const bell=page.getByRole('button',{name:'Колокольчик — парковка готова',exact:true});
  const sound=page.locator('.parking-game audio');
  await sound.evaluate(audio=>audio.addEventListener('playing',()=>{
    audio.dataset.starts=Number(audio.dataset.starts??0)+1;
  }));
  await hintedMove(page);
  await expect.poll(()=>bell.locator('img').first().evaluate(image=>image.naturalWidth)).toBeGreaterThan(0);
  const target=await bell.boundingBox();
  expect(target.height).toBeGreaterThanOrEqual(90);
  await bell.locator('.parking-bell-plunger').evaluate(plunger=>plunger.addEventListener('animationstart',event=>{
    if(event.animationName==='parking-bell-press')plunger.dataset.pressed='true';
  }));
  await page.screenshot({path:'.cache/parking-results/parking-desk-bell-tablet.png'});
  await page.touchscreen.tap(target.x+target.width/2,target.y+target.height/2);
  await expect(sound).toHaveAttribute('data-starts','1');
  await expect(page.locator('.parking-bell-plunger')).toHaveAttribute('data-pressed','true');
  await expect(page.locator('.reward-modal__title')).toHaveText('Парковка готова!');
  await expect(sound).toHaveAttribute('data-starts','1');

  await page.getByRole('button',{name:'Вернуться к парковке',exact:true}).click();
  await page.getByRole('button',{name:'Играть ещё',exact:true}).click();
  await page.getByRole('button',{name:'К играм',exact:true}).click();
  const toggle=page.getByRole('button',{name:'Звук',exact:true});
  await expect(toggle).toHaveAttribute('aria-pressed','true');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed','false');
  await page.getByRole('button',{name:'Продолжить',exact:true}).click();
  await hintedMove(page);
  await bell.tap();
  await expect(page.locator('.reward-modal__title')).toHaveText('Парковка готова!');
  await expect(sound).toHaveAttribute('data-starts','1');
});

test('partners alternate moves, pause preserves the board and the next puzzle waits for a tap',async({page})=>{
  await start(page,{level:'Несколько ходов',partner:'Логопед',animated:true,together:true});const board=page.locator('.parking-grid');
  await expect(page.locator('.parking-player[data-active=true]')).toHaveText(/Мирон/);
  await hintedMove(page);await expect(page.locator('.parking-player[data-active=true]')).toHaveText(/Логопед/);
  await page.getByRole('button',{name:'К играм',exact:true}).click();
  const before=await board.getAttribute('data-moves');await page.waitForTimeout(450);await expect(board).toHaveAttribute('data-moves',before);
  await page.getByRole('button',{name:'Продолжить',exact:true}).click();
  await hintedMove(page);await expect(page.locator('.parking-player[data-active=true]')).toHaveText(/Мирон/);
  await hintedMove(page);await expect(board).toHaveAttribute('data-phase','ready');await expect(board).toHaveAttribute('data-moves','3');
  await page.waitForTimeout(700);await expect(board).toHaveAttribute('data-moves','3');await expect(page.locator('.reward-modal-overlay')).toHaveCount(0);
  await page.getByRole('button',{name:'Колокольчик — парковка готова',exact:true}).click();
  await page.getByRole('button',{name:'Вернуться к парковке',exact:true}).click();
  await page.getByRole('button',{name:'Настроить игру',exact:true}).click();
  await expect(page.getByRole('radio',{name:/^Вместе/})).toHaveAttribute('aria-checked','true');
  await expect(page.getByRole('textbox',{name:'Второй игрок',exact:true})).toHaveValue('Логопед');
  await expect(page.getByRole('radio',{name:/^Несколько ходов/})).toHaveAttribute('aria-checked','true');
});

test('the shutters stay open until the cars enter and the finale resumes after a pause',async({page})=>{
  await start(page,{animated:true});
  await hintedMove(page);
  await page.getByRole('button',{name:'Колокольчик — парковка готова',exact:true}).click();
  const board=page.locator('.parking-grid');
  const shutter=page.locator('.parking-shutter').first();
  await expect(board).toHaveAttribute('data-phase','celebrating');
  await expect.poll(()=>shutter.evaluate(element=>new DOMMatrix(getComputedStyle(element).transform).d)).toBeLessThan(.15);
  await page.getByRole('button',{name:'К играм',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Пауза',exact:true})).toBeVisible();
  const car=page.locator('.parking-piece-surface').first();
  const position=await car.evaluate(element=>getComputedStyle(element).transform);
  await page.waitForTimeout(700);
  await expect(board).toHaveAttribute('data-phase','celebrating');
  expect(await car.evaluate(element=>getComputedStyle(element).transform)).toBe(position);
  await expect(page.locator('.reward-modal-overlay')).toHaveCount(0);
  await page.getByRole('button',{name:'Продолжить',exact:true}).click();
  await expect(board).toHaveAttribute('data-phase','finished');
  await expect(page.locator('.reward-modal__title')).toHaveText('Парковка готова!');
  await expect(car).toBeHidden();
  expect(await shutter.evaluate(element=>new DOMMatrix(getComputedStyle(element).transform).d)).toBe(1);
});

test('the large puzzle starts mixed and needs twelve to sixteen helpful moves',async({page})=>{
  await start(page,{level:'Большая парковка'});await expect(page.locator('.parking-piece')).toHaveCount(8);
  await expect(page.locator('.parking-player')).toHaveCount(0);
  await expect(page.locator('.parking-grid')).toHaveAttribute('data-play-mode','solo');
  const misplaced=await page.locator('.parking-piece').evaluateAll(cars=>cars.filter(car=>Number(car.dataset.color)!==Number(car.dataset.index)%3).length);
  expect(misplaced).toBeGreaterThanOrEqual(6);
  let moves=0;
  while(await page.locator('.parking-grid').getAttribute('data-phase')!=='ready'&&moves<16){await hintedMove(page);moves++;await expect(page.locator('.parking-grid')).toHaveAttribute('data-turn','0');}
  expect(moves).toBeGreaterThanOrEqual(12);expect(moves).toBeLessThanOrEqual(16);
  await expect(page.locator('.parking-grid')).toHaveAttribute('data-phase','ready');
  await expect(page.locator('.parking-grid')).toHaveAttribute('data-moves',String(moves));
  await expect(page.getByRole('img',{name:'Свободное место',exact:true})).toHaveCount(1);
});

for(const size of [{width:1280,height:800},{width:1024,height:768},{width:1366,height:1024},{width:820,height:1180},{width:550,height:900},{width:844,height:390},{width:390,height:844},{width:320,height:700}])test(`parking fits ${size.width}x${size.height}`,async({page})=>{
  await page.setViewportSize(size);await start(page,{level:'Большая парковка',partner:'Очень длинное имя игрока',together:true});
  if(size.width>=550)await page.evaluate(()=>{for(const side of ['top','right','bottom','left'])document.documentElement.style.setProperty('--app-safe-'+side,'20px');});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight)).toBe(true);
  expect(await page.locator('.parking-game').evaluate(game=>game.scrollWidth<=game.clientWidth&&game.scrollHeight<=game.clientHeight)).toBe(true);
  const board=await page.locator('.parking-grid').boundingBox();expect(board.width/3).toBeGreaterThanOrEqual(48);
  const offsets=await page.locator('.parking-piece').evaluateAll(cars=>cars.map(car=>{const r=car.getBoundingClientRect(),board=car.closest('.parking-grid').getBoundingClientRect(),i=Number(car.dataset.index);return Math.abs(r.x-board.x-(i%3)*board.width/3)+Math.abs(r.y-board.y-Math.floor(i/3)*board.height/3);}));
  expect(Math.max(...offsets)).toBeLessThan(2);
  const hint=await page.getByRole('button',{name:'Подсказка',exact:true}).boundingBox();
  expect(hint.x).toBeGreaterThanOrEqual(0);expect(hint.x+hint.width).toBeLessThanOrEqual(size.width);
  expect(hint.y+hint.height).toBeLessThanOrEqual(size.height);
  if(size.width>size.height)expect(hint.x).toBeGreaterThan(board.x+board.width);
  else expect(hint.y).toBeGreaterThan(board.y+board.height);
  const stage=await page.locator('.parking-play-area').boundingBox();
  const lot=await page.locator('.parking-lot').boundingBox();
  const actions=await page.locator('.parking-actions').boundingBox();
  const sideBySide=size.width>size.height;
  const widthUsed=(lot.width+(sideBySide?actions.width:0))/stage.width;
  const heightUsed=(lot.height+(sideBySide?0:actions.height))/stage.height;
  expect(Math.max(widthUsed,heightUsed)).toBeGreaterThan(.9);
  const gates=await page.locator('.parking-garages').boundingBox();
  expect(Math.abs(gates.y+gates.height-board.y)).toBeLessThan(2);
  await expect(page.getByRole('heading',{name:'Парковка',exact:true})).toBeVisible();
  await page.screenshot({path:`.cache/parking-results/parking-${size.width}.png`,fullPage:true});
});

test('rotating or resizing a tablet reflows the current round', async ({page})=>{
  await page.setViewportSize({width:820,height:1180});
  await start(page,{level:'Большая парковка'});
  await hintedMove(page);
  const grid=page.locator('.parking-grid');
  const positions=await page.locator('.parking-piece').evaluateAll(cars=>cars.map(({dataset})=>[dataset.car,dataset.index]));
  const portrait=await grid.boundingBox();
  await page.setViewportSize({width:1180,height:820});
  const landscape=await grid.boundingBox();
  const action=await page.getByRole('button',{name:'Подсказка',exact:true}).boundingBox();
  expect(action.x).toBeGreaterThan(landscape.x+landscape.width);
  expect(landscape.height).toBeLessThan(portrait.height);
  await page.setViewportSize({width:520,height:820});
  const split=await grid.boundingBox();
  const splitAction=await page.getByRole('button',{name:'Подсказка',exact:true}).boundingBox();
  expect(splitAction.y).toBeGreaterThan(split.y+split.height);
  expect(split.width).toBeLessThan(landscape.width);
  expect(await page.locator('.parking-piece').evaluateAll(cars=>cars.map(({dataset})=>[dataset.car,dataset.index]))).toEqual(positions);
  await expect(grid).toHaveAttribute('data-moves','1');
});
