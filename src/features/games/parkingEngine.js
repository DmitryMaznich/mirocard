export const PARKING_LEVELS = Object.freeze({
  first: { columns: 2, rows: 2, distance: 1 },
  practice: { columns: 2, rows: 3, distance: 3 },
  big: { columns: 3, rows: 3, distance: 12, maxDistance: 16, minMisplaced: 6 },
});
export const PARKING_MOVE_MS = 320;
const graphs = new Map();
const keyOf = board => board.map(car => car === null ? '_' : typeof car === 'number' ? car : car.color).join('');
const sample = (items, random) => items[Math.min(items.length-1, Math.max(0, Math.floor(random()*items.length)))];

export function parkingNeighbors(blank, columns, rows) {
  const x=blank%columns,y=Math.floor(blank/columns);
  return [y>0?blank-columns:null,x>0?blank-1:null,x<columns-1?blank+1:null,y<rows-1?blank+columns:null].filter(i=>i!==null);
}
export function parkingSolved(board, columns) {
  return board.every((car,i)=>car===null || (typeof car==='number'?car:car.color)===i%columns);
}
function swapKey(key,a,b) {const chars=key.split('');[chars[a],chars[b]]=[chars[b],chars[a]];return chars.join('');}
// Multi-source BFS treats every correct position of the empty space as solved.
// There are only 5,040 arrangements on the largest board (3+3+2 cars).
function graphFor(columns,rows,missingColumn) {
  const id=`${columns}-${rows}-${missingColumn}`;
  if(graphs.has(id))return graphs.get(id);
  const distances=new Map(),queue=[];
  for(let row=0;row<rows;row++) {
    const goal=Array.from({length:columns*rows},(_,i)=>i===row*columns+missingColumn?'_':String(i%columns)).join('');
    distances.set(goal,0);queue.push(goal);
  }
  for(let cursor=0;cursor<queue.length;cursor++) {
    const key=queue[cursor],blank=key.indexOf('_'),distance=distances.get(key);
    for(const index of parkingNeighbors(blank,columns,rows)) {
      const next=swapKey(key,blank,index);
      if(!distances.has(next)){distances.set(next,distance+1);queue.push(next);}
    }
  }
  graphs.set(id,distances);return distances;
}
export function createParking(level='first',random=Math.random,playMode='solo') {
  const selected=Object.hasOwn(PARKING_LEVELS,level)?level:'first';
  const {columns,rows,distance,maxDistance=distance,minMisplaced=0}=PARKING_LEVELS[selected];
  const missingColumn=sample(Array.from({length:columns},(_,i)=>i),random);
  const palette=sample(columns===2?[[0,1],[1,2],[0,2]]:[[0,1,2],[2,0,1],[1,2,0]],random);
  const graph=graphFor(columns,rows,missingColumn);
  const candidates=[...graph].filter(([key,d])=>{
    if(d<distance||d>maxDistance)return false;
    const misplaced=[...key].filter((color,i)=>color!=='_'&&Number(color)!==i%columns).length;
    if(misplaced<minMisplaced)return false;
    // The large board starts mixed in every lane, with at least six of the
    // eight cars outside their garage lane, rather than nearly sorted.
    return !minMisplaced||Array.from({length:columns},(_,column)=>[...key].some((color,i)=>i%columns===column&&color!=='_'&&Number(color)!==column)).every(Boolean);
  }).map(([key])=>key);
  const start=sample(candidates,random);
  const counts=Array(columns).fill(0);
  const board=start.split('').map(color=>color==='_'?null:{color:Number(color),id:`car-${color}-${counts[Number(color)]++}`});
  return {level:selected,playMode:playMode==='together'?'together':'solo',columns,rows,missingColumn,palette:[...palette],board,turn:0,phase:'playing',moves:0};
}
export function parkingCanMove(state,index) {
  return Number.isInteger(index)&&index>=0&&index<state.board.length&&state.board[index]!==null&&parkingNeighbors(state.board.indexOf(null),state.columns,state.rows).includes(index);
}
export function parkingDistance(state) {
  return graphFor(state.columns,state.rows,state.missingColumn).get(keyOf(state.board));
}
export function parkingHint(state) {
  const distance=parkingDistance(state);
  if(!distance)return null;
  const key=keyOf(state.board),blank=key.indexOf('_'),graph=graphFor(state.columns,state.rows,state.missingColumn);
  return parkingNeighbors(blank,state.columns,state.rows).find(index=>graph.get(swapKey(key,blank,index))===distance-1)??null;
}
export function parkingReducer(state,action) {
  if(action.type==='move'&&state.phase==='playing'&&parkingCanMove(state,action.index)) {
    const board=[...state.board],blank=board.indexOf(null);
    [board[blank],board[action.index]]=[board[action.index],null];
    return {...state,board,moves:state.moves+1,phase:'moving'};
  }
  if(action.type==='settled'&&state.phase==='moving')return {...state,phase:parkingSolved(state.board,state.columns)?'ready':'playing',turn:state.playMode==='together'?1-state.turn:0};
  if(action.type==='bell'&&state.phase==='ready')return {...state,phase:'celebrating'};
  if(action.type==='celebrated'&&state.phase==='celebrating')return {...state,phase:'finished'};
  if(action.type==='new'&&action.puzzle)return action.puzzle;
  return state;
}
