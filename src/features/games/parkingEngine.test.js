import {describe,it,expect} from 'vitest';
import {createParking,parkingReducer,parkingDistance,parkingHint,parkingCanMove,parkingSolved,parkingNeighbors,PARKING_LEVELS} from './parkingEngine';
const move=(state,index)=>parkingReducer(parkingReducer(state,{type:'move',index}),{type:'settled'});

describe('cooperative parking',()=>{
  it.each(Object.keys(PARKING_LEVELS))('creates solvable %s puzzles at the intended difficulty',level=>{
    const seeds=level==='expert'?Array.from({length:12},(_,i)=>(i+.5)/12):[0,.12,.35,.55,.8,.999];
    for(const seed of seeds){
      let state=createParking(level,()=>seed);
      const ids=state.board.filter(Boolean).map(car=>car.id).sort();
      expect(new Set(ids).size).toBe(ids.length);
      expect(state.board.filter(car=>car===null)).toHaveLength(1);
      expect(parkingSolved(state.board,state.columns)).toBe(false);
      const rules=PARKING_LEVELS[level];
      expect(parkingDistance(state)).toBeGreaterThanOrEqual(rules.distance);
      expect(parkingDistance(state)).toBeLessThanOrEqual(rules.maxDistance??rules.distance);
      if(level==='big'){
        expect(state.board.filter((car,i)=>car&&car.color!==i%3).length).toBeGreaterThanOrEqual(6);
        for(let column=0;column<3;column++)expect(state.board.some((car,i)=>car&&i%3===column&&car.color!==column)).toBe(true);
      }
      if(level==='expert'){
        expect(state.palette).toHaveLength(4);
        const horizontalMoves=state.board.reduce((sum,car,i)=>sum+(car?Math.abs(car.color-i%4):0),0);
        expect(horizontalMoves).toBeGreaterThanOrEqual(rules.distance);
        for(let column=0;column<4;column++){
          expect(state.board.filter((car,i)=>car&&i%4===column&&car.color!==column).length).toBeGreaterThanOrEqual(2);
        }
      }
      for(let remaining=parkingDistance(state);remaining>0;remaining--){
        const hint=parkingHint(state);expect(parkingCanMove(state,hint)).toBe(true);
        state=move(state,hint);expect(parkingDistance(state)).toBe(remaining-1);
        expect(state.board.filter(Boolean).map(car=>car.id).sort()).toEqual(ids);
      }
      expect(state.phase).toBe('ready');expect(parkingHint(state)).toBeNull();
      expect(parkingReducer(state,{type:'bell'}).phase).toBe('celebrating');
    }
  });
  it('only moves adjacent cars, not diagonally or across a row edge',()=>{
    expect(parkingNeighbors(2,3,3)).toEqual([1,5]);
    let s=createParking('big',()=>.6);
    for(const index of [-1,9,1.5,null,s.board.indexOf(null)])expect(parkingReducer(s,{type:'move',index})).toBe(s);
    const distant=s.board.findIndex((car,index)=>car&&!parkingCanMove(s,index));
    expect(parkingReducer(s,{type:'move',index:distant})).toBe(s);
  });
  it('changes turns after a move ends and ignores double taps while moving',()=>{
    let state=createParking('practice',()=>.2,'together'),initial=state;
    state=parkingReducer(state,{type:'move',index:parkingHint(state)});
    expect(state).toMatchObject({phase:'moving',turn:0,moves:1});
    expect(parkingReducer(state,{type:'move',index:parkingHint(state)})).toBe(state);
    state=parkingReducer(state,{type:'settled'});
    expect(state).toMatchObject({phase:'playing',turn:1,moves:1});
    expect(initial.moves).toBe(0);
    state=move(state,parkingHint(state));expect(state.turn).toBe(0);
  });
  it('defaults to solo and keeps every move with the child',()=>{
    let state=createParking('practice',()=>.2);expect(state.playMode).toBe('solo');
    for(let i=0;i<3;i++){state=move(state,parkingHint(state));expect(state.turn).toBe(0);}
    expect(state.phase).toBe('ready');
    expect(createParking('first',Math.random,'unknown').playMode).toBe('solo');
  });
  it('does not complete or award a prize until a solved board is confirmed with the bell',()=>{
    let state=createParking();expect(parkingReducer(state,{type:'bell'})).toBe(state);
    state=move(state,parkingHint(state));expect(state.phase).toBe('ready');
    expect(parkingReducer(state,{type:'celebrated'})).toBe(state);
    expect(parkingReducer(state,{type:'move',index:parkingNeighbors(state.board.indexOf(null),state.columns,state.rows)[0]})).toBe(state);
    state=parkingReducer(state,{type:'bell'});expect(state.phase).toBe('celebrating');
    expect(parkingReducer(state,{type:'bell'})).toBe(state);
    state=parkingReducer(state,{type:'celebrated'});expect(state.phase).toBe('finished');
    expect(parkingReducer(state,{type:'bell'})).toBe(state);
  });
  it('offers a shorter path after unhelpful legal moves without losing cars',()=>{
    let state=createParking('big',()=>.4);
    for(let i=0;i<15&&state.phase==='playing';i++){
      const options=parkingNeighbors(state.board.indexOf(null),state.columns,state.rows);
      state=move(state,options[i%options.length]);expect(Number.isInteger(parkingDistance(state))).toBe(true);
    }
    let limit=50;while(state.phase==='playing'&&limit-->0)state=move(state,parkingHint(state));
    expect(state.phase).toBe('ready');expect(state.board.filter(Boolean)).toHaveLength(8);
  });
  it('keeps valid hints on the 4 × 4 board after moves away from the route',()=>{
    let state=createParking('expert',()=>.24,'together');
    for(let i=0;i<48&&state.phase==='playing';i++){
      const options=parkingNeighbors(state.board.indexOf(null),state.columns,state.rows);
      const other=options.filter(index=>index!==parkingHint(state));
      state=move(state,other[i%other.length]);
    }
    let remaining=parkingDistance(state);
    while(remaining>0){
      const hint=parkingHint(state);
      expect(parkingCanMove(state,hint)).toBe(true);
      state=move(state,hint);
      expect(parkingDistance(state)).toBe(--remaining);
    }
    expect(state.phase).toBe('ready');
    expect(state.board.filter(Boolean)).toHaveLength(15);
  });
});
