export const PARKING_LEVELS = Object.freeze({
  first: { columns: 2, rows: 2, distance: 1 },
  practice: { columns: 2, rows: 3, distance: 3 },
  big: { columns: 3, rows: 3, distance: 12, maxDistance: 16, minMisplaced: 6 },
  expert: { columns: 4, rows: 4, distance: 18, maxDistance: 32, minMisplaced: 8 },
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
// The largest board using BFS has only 5,040 arrangements (3+3+2 cars).
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
// Hex cell indices trace the vacancy from a sorted board to a mixed one.
// Each start needs at least 18 horizontal moves and has a route of at most 32 moves.
const EXPERT_PATHS = [
  '456732104567bfedc8456abfed9a', 'fedc89abfedc89567321045621',
  '21048cdea98cdefba9567ba9548956', '32104510489abfedc89abfed9abfea621',
  'cdefba984567321045673210456', '451237659abfed984012376548cd9512',
  '67ba98456a98401237baefba95489dc', '65489abfed9ab73210489ab76210',
  '4567ba6732104598cdea956a98cde', '89abfeab732104510489ab76aedc89a',
  '210456732104567321567bfed9abfe', '4567ba9defb7321048cdea984567ba',
];

function createExpertLayout(random) {
  const [goalBlank,...steps]=Array.from(sample(EXPERT_PATHS,random),cell=>Number.parseInt(cell,16));
  const paletteOffset=sample([0,1,2,3],random);
  const palette=Array.from({length:4},(_,i)=>(i+paletteOffset)%4);
  let blank=goalBlank;
  let start=Array.from({length:16},(_,i)=>i===blank?'_':String(i%4)).join('');
  const route=[];
  for(const index of steps) {
    route.push(start);
    start=swapKey(start,blank,index);
    blank=index;
  }
  return {start,route:route.reverse(),missingColumn:goalBlank%4,palette};
}

function createSmallLayout({columns,rows,distance,maxDistance=distance,minMisplaced=0},random) {
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
  return {start:sample(candidates,random),missingColumn,palette};
}

export function createParking(level='first',random=Math.random,playMode='solo') {
  const selected=Object.hasOwn(PARKING_LEVELS,level)?level:'first';
  const rules=PARKING_LEVELS[selected];
  const {columns,rows}=rules;
  const {start,...layout}=selected==='expert'?createExpertLayout(random):createSmallLayout(rules,random);
  const counts=Array(columns).fill(0);
  const board=start.split('').map(color=>color==='_'?null:{color:Number(color),id:`car-${color}-${counts[Number(color)]++}`});
  return {level:selected,playMode:playMode==='together'?'together':'solo',columns,rows,...layout,palette:[...layout.palette],board,turn:0,phase:'playing',moves:0};
}
export function parkingCanMove(state,index) {
  return Number.isInteger(index)&&index>=0&&index<state.board.length&&state.board[index]!==null&&parkingNeighbors(state.board.indexOf(null),state.columns,state.rows).includes(index);
}
export function parkingDistance(state) {
  // Expert rounds keep a verified route instead of indexing the full board graph.
  if(state.route)return state.route.length;
  return graphFor(state.columns,state.rows,state.missingColumn).get(keyOf(state.board));
}
export function parkingHint(state) {
  if(state.route)return state.route[0]?.indexOf('_')??null;
  const distance=parkingDistance(state);
  if(!distance)return null;
  const key=keyOf(state.board),blank=key.indexOf('_'),graph=graphFor(state.columns,state.rows,state.missingColumn);
  return parkingNeighbors(blank,state.columns,state.rows).find(index=>graph.get(swapKey(key,blank,index))===distance-1)??null;
}
function updateExpertRoute(state,board) {
  if(parkingSolved(board,state.columns))return [];
  const joinedAt=state.route.indexOf(keyOf(board));
  // Rejoin if possible. Otherwise the previous state is one legal move away.
  return joinedAt>=0?state.route.slice(joinedAt+1):[keyOf(state.board),...state.route];
}

export function parkingReducer(state,action) {
  if(action.type==='move'&&state.phase==='playing'&&parkingCanMove(state,action.index)) {
    const board=[...state.board],blank=board.indexOf(null);
    [board[blank],board[action.index]]=[board[action.index],null];
    const next={...state,board,moves:state.moves+1,phase:'moving'};
    if(state.route)next.route=updateExpertRoute(state,board);
    return next;
  }
  if(action.type==='settled'&&state.phase==='moving')return {...state,phase:parkingSolved(state.board,state.columns)?'ready':'playing',turn:state.playMode==='together'?1-state.turn:0};
  if(action.type==='bell'&&state.phase==='ready')return {...state,phase:'celebrating'};
  if(action.type==='celebrated'&&state.phase==='celebrating')return {...state,phase:'finished'};
  if(action.type==='new'&&action.puzzle)return action.puzzle;
  return state;
}
