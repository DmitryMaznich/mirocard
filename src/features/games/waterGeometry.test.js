import {describe,it,expect} from "vitest";
import {WATER_GOAL,WATER_WIN,WATER_CAPACITY,WATER_SCENE,waterLevel,pourFrame} from "./waterGeometry";
import {createRace,raceReducer} from "./raceEngine";

describe("water game quantity and finish",()=>{
  it("fills equal portions exactly to the rim and sends extra water outside",()=>{
    for(let n=0;n<WATER_GOAL;n++) expect(waterLevel(n)-waterLevel(n+1)).toBe(WATER_SCENE.unitHeight);
    expect(waterLevel(0)).toBe(WATER_SCENE.bottom);
    expect(waterLevel(WATER_GOAL)).toBe(WATER_SCENE.rimY);
    expect(waterLevel(WATER_WIN)).toBe(WATER_SCENE.rimY);
    const full={...createRace(WATER_WIN,WATER_CAPACITY,true,true),phase:"moving",positions:[20,19],dice:[6,6],step:0};
    expect(pourFrame(full,.5).map(f=>f.overflow)).toEqual([.5,0]);
  });
  it("pours at the same rate and closes the shorter throw first",()=>{
    const race={...createRace(WATER_WIN,WATER_CAPACITY,true,true),phase:"moving",dice:[5,3],positions:[11,8],step:0};
    const frames=pourFrame(race,.5);
    expect(frames.map(f=>f.amount)).toEqual([11.5,8.5]);
    expect(frames.map(f=>f.flow)).toEqual([true,true]);
    const later=pourFrame({...race,step:3,positions:[14,11]},.5);
    expect(later.map(f=>f.amount)).toEqual([14.5,11]);
    expect(later.map(f=>f.open)).toEqual([1,0]);
  });
  it("a full glass is not yet a win, simultaneous overflow gives a tie",()=>{
    let race={...createRace(WATER_WIN,WATER_CAPACITY,true,true),phase:"input",positions:[19,19],dice:[6,3]};
    race=raceReducer(race,{type:"compare",answer:"child"});
    race=raceReducer(race,{type:"tick"});
    expect(race).toMatchObject({phase:"moving",positions:[20,20],result:null});
    race=raceReducer(race,{type:"tick"});
    expect(race).toMatchObject({phase:"arriving",positions:[21,21],result:"tie"});
    expect(pourFrame(race,1).map(f=>f.open)).toEqual([0,0]);
    race=raceReducer(race,{type:"arrived"});
    expect(race.phase).toBe("finished");
    expect(raceReducer(race,{type:"tick"})).toBe(race);
    expect(raceReducer(race,{type:"reset"})).toMatchObject({finish:21,capacity:21,deferResult:true,firstToFinish:true,positions:[0,0]});
  });
  it.each([[20,19,"child"],[19,20,"adult"]])("stops both taps at the first overflow from %s / %s",(a,b,result)=>{
    let race={...createRace(WATER_WIN,WATER_CAPACITY,true,true),phase:"input",positions:[a,b],dice:[6,6]};
    race=raceReducer(race,{type:"compare",answer:"equal"});
    race=raceReducer(race,{type:"tick"});
    expect(race).toMatchObject({phase:"arriving",positions:[a+1,b+1],result});
    expect(raceReducer(race,{type:"tick"})).toBe(race);
  });
});
