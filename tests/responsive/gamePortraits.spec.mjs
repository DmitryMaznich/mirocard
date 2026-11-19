import {test,expect} from "@playwright/test";
for(const game of ["Перетягивание каната","Наливаем до краёв"]){
  test(`${game}: both character pickers render even when full-size artwork is unavailable`,async({page})=>{
    await page.setViewportSize({width:1280,height:800});
    // Reproduce a missing/very slow artwork request independently of the connection speed.
    await page.route("**/game-art/**",route=>route.abort());
    await page.goto("/tests/responsive/games.html");
    await page.getByRole("button",{name:new RegExp(game)}).click();
    for(const groupName of ["Персонаж ученика","Персонаж второго игрока"]){
      const group=page.getByRole("group",{name:groupName,exact:true});
      const images=group.locator(".water-character-portrait image");
      await expect(images).toHaveCount(4);
      const portraits=await images.evaluateAll(async nodes=>Promise.all(nodes.map(async node=>{
        const src=node.getAttribute("href");
        const image=new Image();image.src=src;await image.decode();
        return {inline:src.startsWith("data:image/webp;base64,"),width:image.naturalWidth,height:image.naturalHeight};
      })));
      expect(portraits).toEqual(Array.from({length:4},()=>({inline:true,width:112,height:112})));
    }
    const picker=page.getByRole("group",{name:"Персонаж второго игрока",exact:true});
    await picker.getByRole("button",{name:"Женщина",exact:true}).click();
    await expect(picker.getByRole("button",{name:"Женщина",exact:true})).toHaveAttribute("aria-pressed","true");
    await page.screenshot({path:`.cache/portrait-results/${game.includes("каната") ? "tug" : "water"}.png`});
  });
}
