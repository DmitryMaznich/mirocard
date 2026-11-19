import assert from 'node:assert/strict';
let seed=20261119;
const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
// Historical rules reviewed at commit 362525b (before the five-throw redesign).
// Keep the historical model independent of the current game's reducer.
for(let a=1;a<=6;a++)for(let b=1;b<=6;b++){
 let position=0;const scores=[0,0];
 if(a!==b)for(let step=0;step<a+b;step++){
  const stronger=Math.sign(b-a);
  const direction=step<Math.min(a,b) ? -stronger : stronger;
  position+=direction;scores[direction<0 ? 0 : 1]++;
 }
 assert.equal(position,b-a);
 assert.deepEqual(scores,a===b ? [0,0] : [a,b]);
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
