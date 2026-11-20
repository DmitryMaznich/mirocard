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

test('the child completes a short puzzle and rings the bell before receiving a video',async({page})=>{
  await start(page);const board=page.locator('.parking-grid'),bell=page.getByRole('button',{name:'Колокольчик — парковка готова',exact:true});
  await expect(page.locator('.parking-piece')).toHaveCount(3);await expect(bell).toBeDisabled();
  await page.locator('.parking-piece[data-movable="false"]').first().click({force:true});
  await expect(board).toHaveAttribute('data-moves','0');await expect(board).toHaveAttribute('data-turn','0');
  await hintedMove(page);await expect(board).toHaveAttribute('data-phase','ready');await expect(bell).toBeEnabled();
  await page.waitForTimeout(600);await expect(page.locator('.reward-modal-overlay')).toHaveCount(0);
  await bell.click();await expect(board).toHaveAttribute('data-phase','celebrating');
  await expect(page.locator('.reward-modal__title')).toHaveText('Парковка готова!');
  await page.getByRole('button',{name:'Вернуться к парковке',exact:true}).click();
  await page.getByRole('button',{name:'Настроить игру',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await expect(page.getByRole('radio',{name:/^Самостоятельно/})).toHaveAttribute('aria-checked','true');
  await expect(page.getByRole('textbox',{name:'Второй игрок',exact:true})).toHaveCount(0);
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

test('the large puzzle starts mixed and needs twelve to sixteen helpful moves',async({page})=>{
  await start(page,{level:'Большая парковка'});await expect(page.locator('.parking-piece')).toHaveCount(8);
  await expect(page.locator('.parking-player')).toHaveCount(1);
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

for(const size of [{width:1280,height:800},{width:1024,height:768},{width:844,height:390},{width:390,height:844},{width:320,height:700}])test(`parking fits ${size.width}x${size.height}`,async({page})=>{
  await page.setViewportSize(size);await start(page,{level:'Большая парковка',partner:'Очень длинное имя игрока',together:true});
  if(size.width>size.height&&size.height<500)await page.evaluate(()=>{for(const side of ['top','right','bottom','left'])document.documentElement.style.setProperty('--app-safe-'+side,'20px');});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  if(size.width>size.height)expect(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight)).toBe(true);
  const board=await page.locator('.parking-grid').boundingBox();expect(board.width/3).toBeGreaterThanOrEqual(48);
  const offsets=await page.locator('.parking-piece').evaluateAll(cars=>cars.map(car=>{const r=car.getBoundingClientRect(),board=car.closest('.parking-grid').getBoundingClientRect(),i=Number(car.dataset.index);return Math.abs(r.x-board.x-(i%3)*board.width/3)+Math.abs(r.y-board.y-Math.floor(i/3)*board.height/3);}));
  expect(Math.max(...offsets)).toBeLessThan(2);
  const bell=await page.locator('.parking-bell').boundingBox();expect(bell.x).toBeGreaterThanOrEqual(0);expect(bell.x+bell.width).toBeLessThanOrEqual(size.width);
  await page.screenshot({path:`.cache/parking-results/parking-${size.width}.png`,fullPage:true});
});
