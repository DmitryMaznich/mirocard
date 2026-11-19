import {createTugOfWar,raceReducer} from '../../src/features/games/raceEngine.js';
import assert from 'node:assert/strict';
let seed=20261119;
const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
// Check the shortcut against the current reducer for every possible pair of dice.
for(let a=1;a<=6;a++)for(let b=1;b<=6;b++){
 let s={...createTugOfWar(),phase:'input'};
 s=raceReducer(s,{type:'dice',player:0,value:a});s=raceReducer(s,{type:'dice',player:1,value:b});
 while(s.phase==='moving')s=raceReducer(s,{type:'tick'});
 assert.equal(s.ropePosition,b-a);
 assert.deepEqual(s.pullScores,a===b?[0,0]:[a,b]);
}
const rounds=[],scores=[];
for(let i=0;i<100000;i++){
 let p=0,r=0,a=0,b=0;
 while(Math.abs(p)<15){const x=1+Math.floor(random()*6),y=1+Math.floor(random()*6);p+=y-x;r++;if(x!==y){a+=x;b+=y;}}
 rounds.push(r);scores.push(Math.max(a,b));
}
rounds.sort((a,b)=>a-b);scores.sort((a,b)=>a-b);
const q=(a,p)=>a[Math.floor(a.length*p)];
const result={trials:rounds.length,seed:20261119,meanRounds:rounds.reduce((a,b)=>a+b,0)/rounds.length,medianRounds:q(rounds,.5),p90Rounds:q(rounds,.9),p95Rounds:q(rounds,.95),finishBy6:rounds.filter(x=>x<=6).length/rounds.length,finishBy10:rounds.filter(x=>x<=10).length/rounds.length,winnerScoreMedian:q(scores,.5),winnerScoreP90:q(scores,.9)};
console.log(JSON.stringify(result,null,2));
