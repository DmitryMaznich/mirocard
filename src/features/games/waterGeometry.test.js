import {describe,it,expect} from "vitest";
import {WATER_GOAL,WATER_CAPACITY,WATER_SCENE,waterLevel,pourFrame} from "./waterGeometry";
import {createRace,raceReducer} from "./raceEngine";

describe("water game quantity and finish",()=>{
  it("uses equal linear portions and fits the largest final throw below the rim",()=>{
    for(let n=0;n<WATER_CAPACITY;n++) expect(waterLevel(n)-waterLevel(n+1)).toBe(WATER_SCENE.unitHeight);
    expect(waterLevel(0)).toBe(WATER_SCENE.bottom);
    expect(waterLevel(19+6)).toBeGreaterThan(WATER_SCENE.innerTop);
    expect(waterLevel(19+6)).toBeGreaterThan(WATER_SCENE.rimY);
    expect(waterLevel(WATER_GOAL)).toBeLessThan(waterLevel(19));
  });
  it("pours at the same rate and closes the shorter throw first",()=>{
    const race={...createRace(20,26,true),phase:"moving",dice:[5,3],positions:[11,8],step:0};
    const frames=pourFrame(race,.5);
    expect(frames.map(f=>f.amount)).toEqual([11.5,8.5]);
    expect(frames.map(f=>f.flow)).toEqual([true,true]);
    const later=pourFrame({...race,step:3,positions:[14,11]},.5);
    expect(later.map(f=>f.amount)).toEqual([14.5,11]);
    expect(later.map(f=>f.open)).toEqual([1,0]);
  });
  it("plays both full throws even across the target and closes taps before awarding a tie",()=>{
    let race={...createRace(20,26,true),phase:"input",positions:[19,19],dice:[6,3]};
    race=raceReducer(race,{type:"compare",answer:"child"});
    race=raceReducer(race,{type:"tick"});
    expect(race).toMatchObject({phase:"moving",positions:[20,20],result:null});
    for(let i=0;i<5;i++) race=raceReducer(race,{type:"tick"});
    expect(race).toMatchObject({phase:"arriving",positions:[25,22],result:"tie"});
    expect(pourFrame(race,1).map(f=>f.open)).toEqual([0,0]);
    race=raceReducer(race,{type:"arrived"});
    expect(race.phase).toBe("finished");
    expect(raceReducer(race,{type:"tick"})).toBe(race);
    expect(raceReducer(race,{type:"reset"})).toMatchObject({finish:20,capacity:26,deferResult:true,positions:[0,0]});
  });
});
