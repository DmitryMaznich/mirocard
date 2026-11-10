import { createDrawingFinale } from "./finale.js";
import { createPencilSound } from "./pencilSound.js";

// This player only knows strokes and clipped pencil regions. Lessons arrive as
// data from the topic ZIP; there is no dependency on the app store or routing.
const ns = "http://www.w3.org/2000/svg";
function element(tag, attrs, parent) {
  const node = document.createElementNS(ns, tag);
  if (tag === "path") for (const [key, value] of Object.entries({ fill: "none", stroke: "#26352d", "stroke-width": 3.5, "stroke-linecap": "round", "stroke-linejoin": "round" })) node.setAttribute(key, value);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  if (parent) parent.appendChild(node);
  return node;
}

export function createDrawingPlayer(svg, lesson, onChange = () => {}, prefix = "drawing", options = {}) {
  svg.replaceChildren();
  const colors = element("g", { "data-layer": "colors" }, svg);
  const drawing = element("g", { "data-layer": "drawing" }, svg);
  const accents = element("g", { "data-layer": "accents" }, svg);
  const pencil = element("g", { visibility: "hidden", "data-pencil": "" }, svg);
  const pencilBody = element("g", { transform: "rotate(32)" }, pencil);
  element("path", { d: "M0 0 L-5 -14 V-66 H5 V-14 Z", style: "fill:#edb95b;stroke:#514535;stroke-width:1.2" }, pencilBody);
  element("path", { d: "M-5 -14 L0 0 L5 -14 Z", style: "fill:#f1d7ad;stroke:#514535;stroke-width:1.2" }, pencilBody);
  element("path", { d: "M-1.3 -4 L0 0 L1.3 -4 Z", style: "fill:#514535;stroke:none" }, pencilBody);
  const tip = element("circle", { r: 4, fill: "#749b80", visibility: "hidden" }, svg);
  const finale = createDrawingFinale(svg, lesson);
  const steps = lesson.steps;
  const sound = options.sound ?? createPencilSound();
  sound.setEnabled(options.soundEnabled !== false);
  let index = 0, busy = false, paused = false, version = 0, speed = 1, disposed = false;
  let frameId = null, animationResolve = null;
  const emit = () => { if (!disposed) onChange({ index, busy, paused }); };
  const path = (item, step) => {
    const node = element("path", { d: typeof item === "string" ? item : item.d }, drawing);
    if (item.fill) node.dataset.fill = item.fill;
    if (step?.part) node.dataset.finishPart = step.part;
    return node;
  };
function buildRegion(part,regionIndex){
 const container=element('g',{'data-region':regionIndex},part.overlay?accents:colors);
 if(part.part)container.dataset.finishPart=part.part;
 const defs=element('defs',{},container);
 let seed=17;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
 const {fill,d}=part;const i=regionIndex;
  const clip=element('clipPath',{id:`${prefix}-pencil-clip-${i}`,clipPathUnits:'userSpaceOnUse'},defs);
  const shape=element('path',{d,'clip-rule':'evenodd','fill-rule':'evenodd'},clip);
  const group=element('g',{'clip-path':`url(#${prefix}-pencil-clip-${i})`},container);
 if(part.clip){const outerClip=element('clipPath',{id:`${prefix}-outer-clip-${i}`},defs);element('path',{d:part.clip},outerClip);container.setAttribute('clip-path',`url(#${prefix}-outer-clip-${i})`)}
  const box=shape.getBBox();
  // Scan the shape along diagonal rows. Every other row reverses direction.
  const commands=[];let row=0;
  const slope=-0.32;
  for(let y=box.y-6;y<=box.y+box.height+box.width*0.32+6;y+=4.3){
   let run=[];const runs=[];
   for(let x=box.x-3;x<=box.x+box.width+3;x+=2){
    const py=y+slope*(x-box.x),inside=shape.isPointInFill(new DOMPoint(x,py));
    if(inside)run.push([x,py]);
    else if(run.length){runs.push(run);run=[]}
   }
   if(run.length)runs.push(run);
   if(row%2)runs.reverse();
   for(let points of runs){
    if(points.length<2)continue;
    if(row%2)points=points.reverse();
    let command=`M ${points[0][0]} ${points[0][1]} `;
    for(let k=1;k<points.length;k+=3){const [x,py]=points[k];command+=`L ${x.toFixed(2)} ${(py+(random()-.5)*.65).toFixed(2)} `}
    const last=points[points.length-1];command+=`L ${last[0]} ${last[1]} `;commands.push(command);
   }
   row++;
  }
  if(!commands.length)throw new Error('Empty pencil region '+i);
  const segments=[];let total=0;
  // Each stroke is a separate path: SVG restarts dash patterns at every M.
  // Future strokes stay hidden until the pencil actually reaches them.
  for(const command of commands){
   const strokeGroup=element('g',{visibility:'hidden'},group),layers=[];
   layers.push(element('path',{d:command,style:`fill:none;stroke:${fill};stroke-width:4.8;stroke-opacity:.56;stroke-linecap:round`},strokeGroup));
   for(let n=0;n<5;n++)layers.push(element('path',{d:command,transform:`translate(${(random()-.5)*.5},${(n-2)*.73})`,style:`fill:none;stroke:${fill};stroke-width:${(.35+random()*.35).toFixed(2)};stroke-opacity:${(.38+random()*.30).toFixed(2)};stroke-linecap:round`},strokeGroup));
   const length=layers[0].getTotalLength();
   for(const line of layers){line.style.strokeDasharray=length+' '+length;line.style.strokeDashoffset=length}
   segments.push({group:strokeGroup,layers,length,start:total});total+=length;
  }
  return {segments,length:total,fill,cursor:0};
}
function revealRegion(region,distance){
 const segments=region.segments;
 while(region.cursor<segments.length-1&&distance>=segments[region.cursor].start+segments[region.cursor].length){
  const previous=segments[region.cursor];previous.group.setAttribute('visibility','visible');
  for(const line of previous.layers){line.style.strokeDashoffset=0;line.style.strokeDasharray='none'}
  region.cursor++;
 }
 const current=segments[region.cursor];
 const local=Math.max(0,Math.min(current.length,distance-current.start));
 current.group.setAttribute('visibility','visible');
 for(const line of current.layers)line.style.strokeDashoffset=current.length-local;
 const q=current.layers[0].getPointAtLength(local);
 pencil.setAttribute('transform',`translate(${q.x} ${q.y})`);
 return q;
}


  function redraw() {
    finale.stop();
    drawing.replaceChildren(); colors.replaceChildren(); accents.replaceChildren();
    for (let i = 0; i < index; i++) {
      const step = steps[i];
      if (step.kind === "stroke") for (const item of step.paths) {
        const node = path(item, step); if (node.dataset.fill) node.style.fill = node.dataset.fill;
      } else { const region = buildRegion(step, i); revealRegion(region, region.length); }
    }
    pencil.setAttribute("visibility", "hidden"); tip.setAttribute("visibility", "hidden");
  }
  function stop() {
    finale.stop();
    sound.stop();
    version++; if (frameId !== null) cancelAnimationFrame(frameId);
    frameId = null; animationResolve?.(); animationResolve = null;
    busy = false; paused = false;
  }
  function animate(duration, token, update) {
    return new Promise(resolve => {
      animationResolve = resolve;
      let elapsed = 0, last = performance.now();
      function tick(now) {
        if (disposed || token !== version) { resolve(); return; }
        if (!paused) elapsed += Math.min(64, now - last);
        last = now;
        const t = Math.min(1, elapsed / duration); update(t);
        if (t < 1) frameId = requestAnimationFrame(tick);
        else { frameId = null; animationResolve = null; resolve(); }
      }
      frameId = requestAnimationFrame(tick);
    });
  }
  async function next() {
    if (disposed || busy || index >= steps.length) return;
    finale.stop();
    sound.unlock();
    busy = true; paused = false; const token = ++version, step = steps[index], pace = speed; emit();
    if (step.kind === "stroke") {
      for (const item of step.paths) {
        if (token !== version || disposed) return;
        sound.beginStroke();
        const node = path(item, step), length = node.getTotalLength();
        node.style.strokeDasharray = length; node.style.strokeDashoffset = length;
        tip.setAttribute("visibility", "visible");
        await animate(Math.max(550, Math.min(4800, length * 6)) * pace, token, t => {
          node.style.strokeDashoffset = length * (1-t);
          const point = node.getPointAtLength(length*t); tip.setAttribute("cx", point.x); tip.setAttribute("cy", point.y);
          if (!paused) sound.move(point.x, point.y);
        });
        if (token !== version || disposed) return;
        node.style.strokeDasharray = "none"; if (node.dataset.fill) node.style.fill = node.dataset.fill;
      }
    } else {
      sound.beginStroke();
      const region = buildRegion(step, index); pencil.setAttribute("visibility", "visible");
      pencil.querySelector("path").style.fill = region.fill;
      await animate(Math.max(650, Math.min(7000, region.length * .36)) * pace, token, t => { const point = revealRegion(region, region.length*t); if (!paused) sound.move(point.x, point.y, region.cursor); });
    }
    if (token !== version || disposed) return;
    tip.setAttribute("visibility", "hidden"); pencil.setAttribute("visibility", "hidden");
    sound.stop();
    busy = false; index++; emit();
  }
  emit();
  return {
    next,
    playFinale() { return !disposed && !busy && index === steps.length ? finale.play() : false; },
    stopFinale() { finale.stop(); },
    back() { if (!disposed && !busy && index) { index--; redraw(); emit(); } },
    repeat() { if (!disposed && !busy && index) { index--; redraw(); return next(); } },
    reset() { if (!disposed) { stop(); index=0; redraw(); emit(); } },
    togglePause() { if (!disposed && busy) { paused=!paused; sound.stop(); if (!paused) sound.unlock(); emit(); } },
    setSoundEnabled(value) { sound.setEnabled(value); },
    setSpeed(value) { speed = { slow: 1.65, normal: 1, fast: .6 }[value] ?? 1; },
    dispose() { stop(); finale.dispose(); sound.dispose(); disposed=true; svg.replaceChildren(); },
  };
}
