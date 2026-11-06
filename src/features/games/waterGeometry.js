export const WATER_GOAL = 20;
export const WATER_CAPACITY = 26;
export const POUR_PORTION_MS = 400;
export const WATER_SCENE = { width:1200, height:540, glassWidth:180, innerWidth:160, rimY:130, innerTop:146, bottom:380, unitHeight:9, glassCenters:[400,800], spoutY:110 };
export const waterLevel = volume => WATER_SCENE.bottom - Math.max(0,Math.min(WATER_CAPACITY,volume))*WATER_SCENE.unitHeight;

export function pourFrame(race, progress) {
  const p=Math.max(0,Math.min(1,progress));
  return race.positions.map((volume,i)=>{
    const moving=race.phase==="moving";
    const active=moving && race.step<race.dice[i] && volume<WATER_CAPACITY;
    const amount=Math.min(WATER_CAPACITY,volume+(active ? p : 0));
    let open=0;
    if(active) open=race.step===0 ? Math.min(1,p*4) : 1;
    else if(moving && race.step===race.dice[i]) open=Math.max(0,1-p*4);
    else if(race.phase==="arriving" && race.step<=race.dice[i]) open=1-p;
    return {amount,level:waterLevel(amount),open,flow:active};
  });
}
