import { TUG_MAX_DISTANCE } from './raceEngine';

export const TUG_PULL_MS = 1080;
export const TUG_TRIUMPH_MS = 3000;
export const TUG_ART_SIZE = { width: 960, height: 540 };
// Large scene assets stay outside the single-file app shell and load once
// when the game is first shown. The versioned URLs can be cached independently.
const SOURCES = {garden:'/game-art/tug-v1/garden.webp',rope:'/game-art/tug-v1/rope.webp',people:'/game-art/tug-v1/people.webp',female:'/game-art/tug-v1/people-female.webp',celebration:'/game-art/tug-v1/celebration.webp'};
let loading;
let cached;
export function loadedTugArt() { return cached; }
export function loadTugArt() {
  if (!loading) loading = Promise.all(Object.entries(SOURCES).map(([key, src]) => new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve([key, image]);
    image.onerror = () => reject(new Error('Unable to load tug artwork'));
    image.src = src;
  }))).then(entries => { cached = Object.fromEntries(entries); return cached; }).catch(error => { loading = undefined; throw error; });
  return loading;
}
const BOY = [{hx:268,hy:166},{hx:268,hy:174},{hx:261,hy:176},{hx:224,hy:177},{hx:250,hy:176},{hx:258,hy:174}];
const MAN = [{hx:105,hy:181},{hx:121,hy:181},{hx:123,hy:179},{hx:130,hy:184},{hx:92,hy:181},{hx:105,hy:180}];
const GIRL = [{hx:263,hy:168},{hx:259,hy:174},{hx:263,hy:174},{hx:224,hy:178},{hx:253,hy:173},{hx:265,hy:174}];
const WOMAN = [{hx:100,hy:181},{hx:105,hy:181},{hx:108,hy:181},{hx:120,hy:183},{hx:91,hy:181},{hx:109,hy:181}];
const HEADS = {
  boy:[165,163,161,139,140,145], man:[194,210,217,208,204,213],
  girl:[154,151,154,147,142,151], woman:[195,197,202,198,196,201],
};
const HIPS = {boy:[165,178,181,189,202,180],man:[195,204,206,200,215,222],girl:[165,178,181,189,202,180],woman:[195,204,206,200,215,222]};
export const tugEase = t => { const p=Math.max(0,Math.min(1,t)); return p*p*(3-2*p); };
function phases(progress, winner) {
  const sequence = winner ? [0,1,2,3,2,5,0] : [0,1,2,4,2,5,0];
  const step = Math.min(6, Math.max(0,progress/.86*6));
  const index = Math.min(5,Math.floor(step));
  return {from:sequence[index],to:sequence[index+1],mix:tugEase(step-index)};
}
function bodyCurve(type, anchors, frame, dy) {
  const head=HEADS[type][frame]-anchors[frame].hx, hip=HIPS[type][frame]-anchors[frame].hx;
  const nodes=[[-210,head],[-100,head],[-50,head*.8],[0,0],[65,hip],[180,hip],[215,hip]];
  for(let i=1;i<nodes.length;i++) if(dy<=nodes[i][0]) { const t=tugEase((dy-nodes[i-1][0])/(nodes[i][0]-nodes[i-1][0])); return nodes[i-1][1]*(1-t)+nodes[i][1]*t; }
  return hip;
}
function person(ctx, art, type, player, progress, direction, offset) {
  if (!['boy','girl','man','woman'].includes(type)) type=player ? 'man' : 'boy';
  const adult=type==='man'||type==='woman', female=type==='girl'||type==='woman';
  const anchors=type==='boy'?BOY:type==='girl'?GIRL:type==='man'?MAN:WOMAN;
  const sheet=female?art.female:art.people, cell=sheet.width/6;
  const phase=direction ? phases(progress, direction===(player===0?-1:1)) : {from:0,to:0,mix:0};
  const frame=phase.mix<.5?phase.from:phase.to, anchor=anchors[frame];
  // Mirror about the grip, so every character can play on either side.
  const mirror=(player===0 ? adult : !adult) ? -1 : 1;
  const scale=adult ? .96 : .93;
  ctx.save();ctx.translate((player===0?340:590)+offset,279);ctx.scale(mirror,1);
  for(let sy=0;sy<cell;sy+=2) {
    const height=Math.min(2,cell-sy),dy=sy+height/2-anchor.hy;
    const target=bodyCurve(type,anchors,phase.from,dy)*(1-phase.mix)+bodyCurve(type,anchors,phase.to,dy)*phase.mix;
    const shift=target-bodyCurve(type,anchors,frame,dy);
    ctx.drawImage(sheet,frame*cell,(adult?1:0)*cell+sy,cell,height,-anchor.hx*scale+shift*scale,(sy-anchor.hy)*scale,cell*scale,height*scale+.25);
  }
  ctx.restore();
}

export function tugTriumphFrame(elapsed=0,reducedMotion=false) {
  const t=Math.max(0,Math.min(TUG_TRIUMPH_MS,elapsed))/1000;
  if(reducedMotion)return {frame:1,jump:0,release:1,stand:1};
  let frame=0,jump=0;
  if(t>=.42&&t<.72)frame=1;
  else if(t>=.72&&t<1.18){frame=2;jump=Math.sin((t-.72)/.46*Math.PI)*16;}
  else if(t>=1.18&&t<1.38)frame=3;
  else if(t>=1.38&&t<1.7)frame=1;
  else if(t>=1.7&&t<2.15){frame=2;jump=Math.sin((t-1.7)/.45*Math.PI)*8;}
  else if(t>=2.15&&t<2.4)frame=3;
  else if(t>=2.4)frame=1;
  return {frame,jump,release:tugEase((t-.12)/.5),stand:tugEase((t-.18)/.3)};
}

function celebratingPerson(ctx,art,type,player,offset,triumph) {
  if(!HEADS[type])type=player?'man':'boy';
  const row=Math.max(0,['boy','girl','man','woman'].indexOf(type));
  const adult=row>=2,cell=art.celebration.width/4;
  const baseline=[289,278,279,277][row],scale=adult?1.4:1.3;
  const grip=(player===0?340:590)+offset;
  const anchors=row===0?BOY:row===1?GIRL:row===2?MAN:WOMAN;
  const oldScale=adult?.96:.93;
  const mirror=(player===0?adult:!adult)?-1:1;
  const startX=grip+mirror*(HEADS[type]?.[0]-anchors[0].hx)*oldScale;
  const settledX=Math.max(175,Math.min(785,startX));
  const cx=startX+(settledX-startX)*triumph.stand;
  // Foot registration keeps the landing on the same ground; the jump pose
  // also contains bent knees and lifted feet, rather than stretching a body.
  ctx.drawImage(art.celebration,triumph.frame*cell,row*cell,cell,cell,cx-158*scale,449-baseline*scale-triumph.jump,cell*scale,cell*scale);
}

export function drawTug(ctx, art, {position=0,characters=['boy','man'],progress=0,direction=0,result=null,celebrationTime=0,reducedMotion=false}) {
  const offset=position/TUG_MAX_DISTANCE*115;
  ctx.clearRect(0,0,960,540);ctx.drawImage(art.garden,0,0,960,540);
  const rw=art.rope.width,rh=art.rope.height,width=830,scale=width/rw,x=468+offset-width/2;
  const tension=direction ? Math.sin(Math.PI*Math.min(1,progress/.86)) : 0;
  const winner=result==='child'?0:result==='adult'?1:null;
  const triumph=winner===null?null:tugTriumphFrame(celebrationTime,reducedMotion);
  const heldU=winner===0?((590+offset)-x)/width:((340+offset)-x)/width;
  for(let sx=0;sx<rw;sx+=10) {
    const sw=Math.min(10,rw-sx),u=(sx+sw/2)/rw;
    const drop=triumph?triumph.release*110*(winner===0?1-tugEase(u/heldU):tugEase((u-heldU)/(1-heldU))):0;
    ctx.drawImage(art.rope,sx,0,sw,rh,x+sx*scale,279-300/2172*width+Math.sin(u*Math.PI)*(3-tension*2)+drop,sw*scale+.3,rh*scale);
  }
  for(let player=0;player<2;player++) {
    if(player===winner&&(reducedMotion||celebrationTime>=180))celebratingPerson(ctx,art,characters[player],player,offset,triumph);
    else person(ctx,art,characters[player],player,progress,direction,offset);
  }
  if(result==='child'||result==='adult') {
    const x=result==='child'?210+offset:730+offset;
    ctx.save();ctx.fillStyle='#ffd36a';ctx.strokeStyle='#aa6f18';ctx.lineWidth=2;
    for(const [dx,dy] of [[-28,0],[0,-15],[28,0]]) {ctx.beginPath();ctx.moveTo(x+dx,75+dy-9);ctx.lineTo(x+dx+3,75+dy-3);ctx.lineTo(x+dx+9,75+dy);ctx.lineTo(x+dx+3,75+dy+3);ctx.lineTo(x+dx,75+dy+9);ctx.lineTo(x+dx-3,75+dy+3);ctx.lineTo(x+dx-9,75+dy);ctx.lineTo(x+dx-3,75+dy-3);ctx.closePath();ctx.fill();ctx.stroke();}
    ctx.restore();
  }
}
