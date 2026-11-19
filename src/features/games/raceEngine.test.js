import { describe, expect, it } from "vitest";
import { FINISH, TUG_MAX_DISTANCE, comparisonAnswer, createRace, createTugOfWar, raceReducer, tugDistance } from "./raceEngine";

function input(state = createRace()) {
  if (state.phase === "between") state = raceReducer(state, {type:"nextThrow"});
  return raceReducer(raceReducer(state, { type:"ready" }), { type:"settled" });
}

function enterDice(state, child, adult) {
  let race = raceReducer(input(state), { type: "dice", player: 0, value: child });
  return raceReducer(race, { type: "dice", player: 1, value: adult });
}

function play(state, child, adult) {
  let race=enterDice(state,child,adult);
  race=raceReducer(race,{type:"compare",answer:comparisonAnswer(race.dice)});
  if(race.phase==="counting") race=raceReducer(race,{type:"count",answer:tugDistance(race.dice)});
  if(race.phase==="pairing") race=raceReducer(race,{type:"paired"});
  while(race.phase==="moving") race=raceReducer(race,{type:"tick"});
  if(race.phase==="arriving") race=raceReducer(race,{type:"arrived"});
  return race;
}

describe("physical dice race", () => {
  it("cannot finish before both players have thrown at least three times", () => {
    let race = createRace();
    for (let i = 0; i < 3; i++) race = play(race, 6, 6);
    expect(race.positions).toEqual([18,18]);
    expect(race.result).toBeNull();
    expect(play(race, 1, 1).result).toBe("tie");
  });
  it("requires two physical results and the correct comparison before moving", () => {
    let race = input();
    expect(raceReducer(race, { type: "compare", answer: "equal" })).toBe(race);
    race = raceReducer(race, { type: "dice", player: 0, value: 5 });
    race = raceReducer(race, { type: "dice", player: 1, value: 3 });
    race = raceReducer(race, { type: "compare", answer: "adult" });
    expect(race.mistake).toBe(true);
    expect(race.positions).toEqual([0,0]);
    expect(race.phase).toBe("input");
    race = raceReducer(race, { type: "compare", answer: "child" });
    expect(race.phase).toBe("moving");
    expect(raceReducer(race, { type:"compare", answer:"child" })).toBe(race);
    expect(raceReducer(race, { type:"dice", player:0, value:6 })).toBe(race);
    expect(play(createRace(),5,3).positions).toEqual([5,3]);
  });
  it("clears wrong answer feedback when an entered result changes", () => {
    let race = { ...input(), dice:[6,2], answer:"adult", mistake:true };
    race = raceReducer(race, { type: "dice", player: 0, value: 1 });
    expect(race.answer).toBeNull();
    expect(race.mistake).toBe(false);
    expect(race.phase).toBe("input");
    expect(raceReducer(race, { type:"dice", player:0, value:7 })).toBe(race);
  });
  it("handles equality without awarding an advantage", () => {
    expect(comparisonAnswer([4,4])).toBe("equal");
    expect(play(createRace(),4,4).positions).toEqual([4,4]);
  });
  it("waits for both cars before resolving a shared finishing round", () => {
    let race = { ...input(), positions:[18,14], dice:[1,6] };
    race = raceReducer(race, { type:"compare", answer:"adult" });
    race = raceReducer(race, { type:"tick" });
    expect(race.positions).toEqual([FINISH,15]);
    expect(race.result).toBeNull();
    while (race.phase === "moving") race = raceReducer(race, { type:"tick" });
    expect(race.result).toBe("tie");
    expect(race.positions).toEqual([FINISH,FINISH]);
  });
  it("resolves either winner, allows overshooting, and blocks duplicate moves", () => {
    const nearFinish = { ...createRace(), positions:[16,10] };
    const win = play(nearFinish,6,6);
    expect(win.result).toBe("child");
    expect(win.positions).toEqual([FINISH,16]);
    expect(play({ ...createRace(), positions:[10,16] },6,6).result).toBe("adult");
    expect(raceReducer(win, { type:"compare", answer:"child" })).toBe(win);
    expect(raceReducer(win, { type:"tick" })).toBe(win);
  });
  it("waits for real throws, never generates a number, and opens input only after stopping", () => {
    let race = createRace();
    expect(race.phase).toBe("rolling");
    expect(raceReducer(race, { type:"tick" })).toBe(race);
    expect(raceReducer(race, { type:"dice", player:0, value:6 })).toBe(race);
    race = raceReducer(race, { type:"ready" });
    expect(race.phase).toBe("settling");
    expect(race.dice).toEqual([null,null]);
    expect(raceReducer(race, { type:"compare", answer:"equal" })).toBe(race);
    race = raceReducer(race, { type:"settled" });
    expect(race.phase).toBe("input");
    expect(race.dice).toEqual([null,null]);
    expect(play(race,2,1)).toMatchObject({phase:"between",round:2,dice:[2,1],positions:[2,1]});
  });
  it("finishes the last car step before starting the next throw", () => {
    let race = input();
    race = raceReducer(race, { type:"dice", player:0, value:1 });
    race = raceReducer(race, { type:"dice", player:1, value:1 });
    race = raceReducer(race, { type:"compare", answer:"equal" });
    race = raceReducer(race, { type:"tick" });
    expect(race).toMatchObject({phase:"arriving",round:1,positions:[1,1]});
    expect(raceReducer(race, { type:"ready" })).toBe(race);
    race = raceReducer(race, { type:"arrived" });
    expect(race).toMatchObject({phase:"between",round:2,dice:[1,1],positions:[1,1]});
    for (const type of ["tick","arrived","ready","settled","compare","dice"]) expect(raceReducer(race,{type,player:0,value:6,answer:"equal"})).toBe(race);
    race = raceReducer(race,{type:"nextThrow"});
    expect(race).toMatchObject({phase:"rolling",round:2,dice:[null,null],answer:null});
    expect(raceReducer(race,{type:"nextThrow"})).toBe(race);
  });
});

describe("tug of war to the boundary",()=>{
  it.each(Array.from({length:36},(_,n)=>[Math.floor(n/6)+1,n%6+1]))("moves only the difference for %i versus %i",(a,b)=>{
    const race=play(createTugOfWar(),a,b);
    expect(race).toMatchObject({ropePosition:b-a,completedRounds:1,round:1,phase:"between",result:null});
    expect(race.step).toBe(Math.abs(b-a));
  });
  it("waits for a correct comparison of this throw before anything moves",()=>{
    let s=enterDice(createTugOfWar(),5,3);
    expect(s).toMatchObject({phase:"input",ropePosition:0});
    expect(raceReducer(s,{type:"tick"})).toBe(s);
    s=raceReducer(s,{type:"compare",answer:"adult"});
    expect(s).toMatchObject({phase:"input",mistake:true,ropePosition:0});
    s=raceReducer(s,{type:"compare",answer:"child"});
    expect(s.phase).toBe("pairing");
    expect(raceReducer(s,{type:"compare",answer:"child"})).toBe(s);
    s=raceReducer(s,{type:"paired"});
    expect(s.phase).toBe("moving");
    s=raceReducer(s,{type:"tick"});expect(s.ropePosition).toBe(-1);
    s=raceReducer(s,{type:"tick"});expect(s).toMatchObject({ropePosition:-2,phase:"arriving"});
  });
  it("allows the next throw only by tap and leaves the completed throw visible",()=>{
    let s=play(createTugOfWar(),5,3);
    for(const type of ["tick","arrived","paired","compare","count"]) expect(raceReducer(s,{type,answer:2})).toBe(s);
    expect(s.dice).toEqual([5,3]);
    s=raceReducer(s,{type:"nextThrow"});
    expect(s).toMatchObject({round:2,completedRounds:1,phase:"rolling",dice:[null,null]});
    expect(raceReducer(s,{type:"nextThrow"})).toBe(s);
  });
  it.each([[6,1,"child",-TUG_MAX_DISTANCE],[1,6,"adult",TUG_MAX_DISTANCE]])("stops at the boundary mid-throw for %i versus %i",(a,b,result,position)=>{
    let s=play(createTugOfWar(),a,b);
    expect(s).toMatchObject({phase:"between",result:null,ropePosition:b-a});
    s=play(s,a,b);
    expect(s).toMatchObject({phase:"finished",result,ropePosition:position,step:1,completedRounds:2});
    for(const type of ["tick","arrived","nextThrow","paired","compare"]) expect(raceReducer(s,{type,answer:"child"})).toBe(s);
  });
  it("continues beyond five throws, including equality and reversals",()=>{
    let s=createTugOfWar(true);
    for(let i=0;i<3;i++)for(const [a,b] of [[6,1],[1,6],[5,3],[3,5],[4,4]]) s=play(s,a,b);
    expect(s).toMatchObject({result:null,phase:"between",completedRounds:15,ropePosition:0});
    s=play(s,6,1);s=play(s,6,1);
    expect(s).toMatchObject({result:"child",phase:"finished",completedRounds:17,ropePosition:-TUG_MAX_DISTANCE});
  });
  it("asks for the remainder only in count mode and never moves on a wrong count",()=>{
    let s=enterDice(createTugOfWar(true),5,3);
    s=raceReducer(s,{type:"compare",answer:"child"});
    expect(s.phase).toBe("counting");
    expect(raceReducer(s,{type:"count",answer:0})).toBe(s);
    expect(raceReducer(s,{type:"count",answer:6})).toBe(s);
    s=raceReducer(s,{type:"count",answer:1});
    expect(s).toMatchObject({phase:"counting",mistake:true,ropePosition:0});
    expect(raceReducer(s,{type:"tick"})).toBe(s);
    s=raceReducer(s,{type:"count",answer:2});
    expect(s).toMatchObject({phase:"pairing",mistake:false,countAnswer:2});
    expect(raceReducer(s,{type:"count",answer:2})).toBe(s);
    expect(play(createTugOfWar(true),4,4)).toMatchObject({phase:"between",step:0,completedRounds:1});
  });
  it("preserves the selected teaching variant on reset and locks it after play starts",()=>{
    let s=raceReducer(createTugOfWar(),{type:"configureTug",countMoves:true});
    expect(s.countMoves).toBe(true);
    s=input(s);
    expect(raceReducer(s,{type:"configureTug",countMoves:false})).toBe(s);
    expect(raceReducer(s,{type:"reset"})).toEqual(createTugOfWar(true));
  });
});
