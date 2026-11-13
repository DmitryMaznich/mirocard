export const storageKey = (student,session,task) => `drawing-coloring:${student??'local'}:${session}:${task}`;
export function loadColoring(key) {
  try {
    const value=JSON.parse(localStorage.getItem(key));
    if(value?.sheet?.version!==1||!value.sheet.shapes?.length||value.sheet.shapes.length>60)return null;
    if(!Number.isFinite(value.sheet.width)||!Number.isFinite(value.sheet.height)||value.sheet.width<100||value.sheet.height<100)return null;
    const p=value.progress;
    if(!Number.isInteger(p?.index)||p.index<0||p.index>value.sheet.shapes.length||p.shapes?.length!==value.sheet.shapes.length)return null;
    const validPoint=q=>Number.isFinite(q?.x)&&Number.isFinite(q?.y)&&Math.abs(q.x)<10000&&Math.abs(q.y)<10000;
    if(!value.sheet.shapes.every(s=>s.points?.length>=3&&s.points.every(validPoint)))return null;
    if(!p.shapes.every(s=>['trace','fill','done'].includes(s.phase)&&['traceHits','filled','outline','ink'].every(k=>Array.isArray(s[k]))&&[...s.outline,...s.ink].every(t=>Number.isFinite(t.width)&&t.width>0&&t.points?.every(validPoint))))return null;
    if(p.shapes.some((s,i)=>(i<p.index&&s.phase!=='done')||(i>p.index&&s.phase!=='trace')))return null;
    return {sheet:value.sheet,progress:p};
  } catch {return null;}
}
export function saveColoring(key,value) {
  try {
    const keys=Object.keys(localStorage).filter(k=>k.startsWith('drawing-coloring:')&&k!==key).sort((a,b)=>{
      const time=k=>{try{return JSON.parse(localStorage.getItem(k))?.savedAt??0;}catch{return 0;}};
      return time(a)-time(b);
    });
    while(keys.length>=11)localStorage.removeItem(keys.shift());
    const encoded=JSON.stringify({...value,savedAt:Date.now()});
    // Long, indefinite sessions can hit quota before the count limit. Evict
    // old worksheets and retry, so the current worksheet stays resumable.
    for(;;) {
      try {localStorage.setItem(key,encoded);return;}
      catch {if(!keys.length)return;localStorage.removeItem(keys.shift());}
    }
  } catch { /* The exercise remains usable without local storage. */ }
}
