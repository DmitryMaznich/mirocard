import { describe,expect,it } from "vitest";
import { MAX_FLOORS,SCENE,TOWER_CENTERS,balconySide,constructionPose,floorY } from "./towerGeometry";
import { comparisonAnswer,createRace,raceReducer } from "./raceEngine";

describe("skyscraper construction geometry",() => {
  it("can pick up, carry and place every floor, including 19 and 20, on both sides",() => {
    for(let player=0;player<2;player++) for(let floor=1;floor<=MAX_FLOORS;floor++) {
      for(let step=0;step<=100;step++) {
        const pose=constructionPose(floor,step/100,player);
        expect(pose.hookY-11).toBeGreaterThan(SCENE.cableTop);
        expect(pose.moduleY).toBeGreaterThan(SCENE.jibY+SCENE.floorHeight);
        expect(pose.moduleY+SCENE.floorHeight).toBeLessThanOrEqual(SCENE.ground);
        expect(pose.moduleX-SCENE.towerWidth/2-28).toBeGreaterThan(125);
        expect(pose.moduleX+SCENE.towerWidth/2+28).toBeLessThan(1075);
      }
      const placed=constructionPose(floor,.66,player);
      expect(placed.moduleX).toBe(TOWER_CENTERS[player]);
      expect(placed.moduleY).toBe(floorY(floor));
      expect(placed.moduleY+SCENE.floorHeight).toBe(floorY(floor-1));
      expect(placed.attached).toBe(false);
    }
    expect(floorY(20)).toBe(SCENE.ground-20*SCENE.floorHeight);
  });
  it("alternates balcony floors and their sides",() => {
    expect(Array.from({length:8},(_,i)=>balconySide(i+1))).toEqual([null,"left",null,"right",null,"left",null,"right"]);
  });
  it("uses 20 floors, caps an overshoot and finishes a shared round as a tie",() => {
    let race={...createRace(20),positions:[19,18]};
    for(const action of [{type:"ready"},{type:"settled"},{type:"dice",player:0,value:6},{type:"dice",player:1,value:6}]) race=raceReducer(race,action);
    race=raceReducer(race,{type:"compare",answer:comparisonAnswer(race.dice)});
    race=raceReducer(race,{type:"tick"});
    expect(race.positions).toEqual([20,19]);
    expect(race.result).toBeNull();
    race=raceReducer(race,{type:"tick"});
    expect(race.positions).toEqual([20,20]);
    expect(race.result).toBe("tie");
    expect(raceReducer(race,{type:"tick"})).toBe(race);
  });
});
