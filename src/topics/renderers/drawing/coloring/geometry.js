export const FIGURES = ['circle', 'oval', 'rounded_square', 'rounded_rectangle', 'square', 'rectangle', 'triangle', 'trapezoid', 'pentagon', 'hexagon', 'egg', 'drop', 'leaf', 'heart', 'cloud', 'star', 'straight_path', 'wavy_path'];
export const TITLES = ['Круг', 'Овал', 'Скруглённый квадрат', 'Скруглённый прямоугольник', 'Квадрат', 'Прямоугольник', 'Треугольник', 'Трапеция', 'Пятиугольник', 'Шестиугольник', 'Яйцо', 'Капля', 'Лист', 'Сердце', 'Облако', 'Звезда', 'Прямая дорожка', 'Волнистая дорожка'];
export function randomSource(seed) {
  let value = seed >>> 0;
  return () => { value += 0x6D2B79F5; let t = value; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const point = (x, y) => ({ x, y });
const sample = (fn, count = 96) => Array.from({ length: count }, (_, i) => fn(i * Math.PI * 2 / count));
const polygon = n => sample(t => point(Math.cos(t - Math.PI / 2), Math.sin(t - Math.PI / 2)), n);

// All boundaries are simple closed polygons, including round-ended ribbons.
export function figureOutline(kind, random = () => .5) {
  switch (kind) {
    case 'square': case 'rectangle': return [point(-1,-1),point(1,-1),point(1,1),point(-1,1)];
    case 'triangle': return polygon(3);
    case 'trapezoid': return [point(-.65,-1),point(.65,-1),point(1,1),point(-1,1)];
    case 'pentagon': return polygon(5);
    case 'hexagon': return polygon(6);
    case 'rounded_square': case 'rounded_rectangle': return sample(t => point(Math.sign(Math.cos(t))*Math.abs(Math.cos(t))**.35,Math.sign(Math.sin(t))*Math.abs(Math.sin(t))**.35));
    case 'egg': return sample(t => point(Math.cos(t)*(1+.19*Math.sin(t)),Math.sin(t)));
    case 'drop': return sample(t => point(Math.cos(t)*(.68+.3*Math.sin(t)),Math.sin(t)));
    case 'leaf': return sample(t => point(Math.cos(t),.56*Math.sin(t)*(.65+.35*Math.abs(Math.sin(t)))));
    case 'heart': return sample(t => point(Math.sin(t)**3, -(13*Math.cos(t)-5*Math.cos(2*t)-2*Math.cos(3*t)-Math.cos(4*t))/17));
    case 'cloud': return sample(t => { const r=1+.12*Math.cos(5*t);return point(r*Math.cos(t),r*Math.sin(t)); });
    case 'star': return sample(t => { const r=.83+.17*Math.cos(5*t);return point(r*Math.sin(t),-r*Math.cos(t)); });
    case 'straight_path': case 'wavy_path': {
      const radius=.14+random()*.07, waves=1+Math.floor(random()*2), amplitude=kind==='wavy_path'?(waves===2?.08:.22):0;
      const center = x => amplitude*Math.sin((x+1)*Math.PI*waves);
      const slope = x => amplitude*Math.PI*waves*Math.cos((x+1)*Math.PI*waves);
      const offset = (x, side) => { const a=Math.atan(slope(x));return point(x-side*radius*Math.sin(a),center(x)+side*radius*Math.cos(a)); };
      const top=Array.from({length:65},(_,i)=>offset(-1+i/32,1));
      const endAngle=Math.atan(slope(1));
      const end=Array.from({length:17},(_,i)=>{const a=endAngle+Math.PI/2-i*Math.PI/16;return point(1+radius*Math.cos(a),center(1)+radius*Math.sin(a));});
      const bottom=Array.from({length:65},(_,i)=>offset(1-i/32,-1));
      const startAngle=Math.atan(slope(-1));
      const start=Array.from({length:17},(_,i)=>{const a=startAngle-Math.PI/2-i*Math.PI/16;return point(-1+radius*Math.cos(a),center(-1)+radius*Math.sin(a));});
      return [...top,...end,...bottom,...start];
    }
    default: return sample(t => point(Math.cos(t),Math.sin(t)));
  }
}
export function bounds(points) {
  const xs=points.map(p=>p.x),ys=points.map(p=>p.y);
  const x=Math.min(...xs),y=Math.min(...ys);
  return {x,y,width:Math.max(...xs)-x,height:Math.max(...ys)-y};
}
export function distanceToSegment(p,a,b) {
  const dx=b.x-a.x,dy=b.y-a.y;
  const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));
  return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);
}
export function contourDistance(p, points) {
  let result=Infinity;
  for(let i=0;i<points.length;i++)result=Math.min(result,distanceToSegment(p,points[i],points[(i+1)%points.length]));
  return result;
}
export function inside(p,points) {
  let result=false;
  for(let i=0,j=points.length-1;i<points.length;j=i++) {
    const a=points[i],b=points[j];
    if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)result=!result;
  }
  return result;
}
export function resample(points, spacing=4) {
  return points.flatMap((p,i)=>{const q=points[(i+1)%points.length],n=Math.max(1,Math.ceil(Math.hypot(q.x-p.x,q.y-p.y)/spacing));return Array.from({length:n},(_,j)=>point(p.x+(q.x-p.x)*j/n,p.y+(q.y-p.y)*j/n));});
}

// Pack actual random sizes, rather than choosing a fixed number of cells.
export function generateSheet(seed, width, height, input='pen', set='mixed') {
  const random=randomSource(seed), gap=input==='touch'?38:26, shapes=[];
  const pool=set==='paths'?FIGURES.filter(k=>k.endsWith('_path')):set==='basic'?FIGURES.slice(0,8):FIGURES;
  const minimum=input==='touch'?155:110;
  let x=gap,y=gap,rowHeight=0;
  for(let tries=0;tries<60;tries++) {
    const kind=pool[Math.floor(random()*pool.length)],path=kind.endsWith('_path');
    const size=Math.min(minimum+random()*100,Math.max(60,width-2*gap),Math.max(60,height-2*gap));
    const angle=random()*Math.PI*2,aspect=['oval','rectangle','rounded_rectangle','leaf','cloud'].includes(kind)?.6+random()*.18:1;
    const raw=figureOutline(kind,random).map(p=>point(p.x*Math.cos(angle)-p.y*aspect*Math.sin(angle),p.x*Math.sin(angle)+p.y*aspect*Math.cos(angle))),box=bounds(raw);
    const longest=path?size*(1.5+random()*.6):size;
    const scale=Math.min(longest/Math.max(box.width,box.height),(width-2*gap)/box.width,(height-2*gap)/box.height);
    const w=box.width*scale,h=box.height*scale;
    if(x+w>width-gap){x=gap;y+=rowHeight+gap;rowHeight=0;}
    if(y+h>height-gap)break;
    const points=raw.map(p=>point(x+(p.x-box.x)/box.width*w,y+(p.y-box.y)/box.height*h));
    shapes.push({kind,title:TITLES[FIGURES.indexOf(kind)],points});
    x+=w+gap;rowHeight=Math.max(rowHeight,h);
  }
  return {version:1,width,height,shapes};
}
