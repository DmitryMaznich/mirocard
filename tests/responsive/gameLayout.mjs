import {expect} from "@playwright/test";

export async function expectSideDice(page,viewport){
  if(viewport.width<=viewport.height) return;
  const cards=page.locator('.race-card');
  await expect(page.getByRole("button",{name:"Пауза",exact:true})).toHaveCount(0);
  const dice=page.locator(".race-card .race-die");
  for(let i=0;i<2;i++){const box=await dice.nth(i).boundingBox();expect(box.width).toBeGreaterThanOrEqual(viewport.height<=530 ? 44 : 56);}
  const scene=await page.locator('.tower-scene,.water-scene-wrap,.race-course').boundingBox();
  const left=await cards.nth(0).boundingBox(),right=await cards.nth(1).boundingBox();
  expect(left.x+left.width).toBeLessThanOrEqual(scene.x);
  expect(right.x).toBeGreaterThanOrEqual(scene.x+scene.width);
  expect(scene.height).toBeGreaterThan(viewport.height*.4);
  for(let i=0;i<2;i++){
    const buttons=await cards.nth(i).locator('.race-numbers button').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,h:r.height};}));
    expect(buttons).toHaveLength(6);
    for(let n=0;n<6;n++){
      expect(buttons[n].x).toBeCloseTo(buttons[0].x,1);
      expect(buttons[n].h).toBeGreaterThanOrEqual(30);
      if(n) expect(buttons[n].y).toBeGreaterThanOrEqual(buttons[n-1].y+buttons[n-1].h);
    }
  }
}
