import { SHAPE_KINDS, SHAPE_TITLES, PRACTICE_SETS } from './firstLines/shapes.js';
const wideKinds=new Set(['short_line','wave','zigzag','fence','arc']);
function addWideMovements(tasks,mode,params){
  if(!mode.wideMovements)return tasks;
  const selected=new Set();
  for(let start=0;start<tasks.length;start+=5){
    const candidates=tasks.slice(start,start+5).filter(t=>wideKinds.has(t.exerciseKind));
    if(candidates.length)selected.add(candidates[Math.floor(Math.random()*candidates.length)].number);
  }
  const available=tasks.filter(t=>wideKinds.has(t.exerciseKind)&&!selected.has(t.number));
  while(selected.size<3&&available.length){const i=Math.floor(Math.random()*available.length);selected.add(available.splice(i,1)[0].number);}
  const width=Number.isFinite(globalThis.innerWidth)&&globalThis.innerWidth>0?globalThis.innerWidth:1024;
  const height=Number.isFinite(globalThis.innerHeight)&&globalThis.innerHeight>0?globalThis.innerHeight:768;
  const finger=params.inputMode==='touch',pad=finger?41:30;
  const usableWidth=Math.max(80,width-2*pad),usableHeight=Math.max(24,height-(height<500?150:210)-2*pad);
  return tasks.map(t=>{
    if(!selected.has(t.number))return t;
    const minimum=finger?76:params.inputMode==='passive_pen'?56:40;
    const targetHeight=t.exerciseKind==='short_line'?0:Math.min(usableHeight,Math.max(minimum,usableWidth*(.18+Math.random()*.08)));
    const tilt=Math.min(10,Math.atan2(Math.max(0,usableHeight-targetHeight),usableWidth)*90/Math.PI);
    const angle=Math.round(((Math.random()-.5)*2*tilt+(Math.random()<.5?0:180))*10)/10;
    return {...t,variant:{...t.variant,schema:7,wideHeight:Math.max(.04,Math.min(1.2,targetHeight/usableWidth)),size:1,positionX:.5,
      angle:(angle+540)%360-180}};
  });
}
function generateScreenTasks(mode,card,params) {
  const aliases = new Set(['vertical_line','diagonal_up','diagonal_down']);
  const normalize = kinds => [...new Set(kinds.map(k=>aliases.has(k)?'short_line':k))];
  const supported=mode.params?.exercises?.values??SHAPE_KINDS;
  const all=SHAPE_KINDS.filter(k=>!aliases.has(k)&&supported.includes(k));
  const selected=params.preciseSelection&&Array.isArray(params.exercises)&&params.exercises.length?normalize(params.exercises).filter(k=>all.includes(k)):null;
  const pool=PRACTICE_SETS[params.practiceSet]??all;
  const requested=selected??normalize(mode.adaptiveSheet&&params.practiceSet==='lines'?[...pool,'wave','zigzag','fence']:pool).filter(k=>all.includes(k));
  const kinds=requested.length?requested:all;let bag=[],previous;
  const tasks=Array.from({length:15},(_,index)=>{
    if(!bag.length){bag=[...kinds];for(let i=bag.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[bag[i],bag[j]]=[bag[j],bag[i]];}if(bag.length>1&&bag.at(-1)===previous)[bag[0],bag[bag.length-1]]=[bag.at(-1),bag[0]];}
    const exerciseKind=bag.pop();previous=exerciseKind;
    return {type:'drawing_first_line',id:`first_lines:${index}`,cardId:card.id,conceptId:card.conceptId,number:index+1,
      exerciseKind,title:exerciseKind==='short_line'?'Прямая':SHAPE_TITLES[exerciseKind],sheetPage:Math.floor(index/4),sheetSlot:index%4,breakBefore:false,...(mode.adaptiveSheet?{autoSheet:true}:{}),
      variant:{schema:mode.solidVolumes&&exerciseKind==='parallelepiped'?6:mode.adaptiveSheet?5:4,seed:Math.floor(Math.random()*4294967296),scale:1,aspect:1,angle:Math.round((Math.random()*360-180)*10)/10||0,
        size:Math.random(),positionX:Math.random(),positionY:Math.random()}};
  });
  return addWideMovements(tasks.map((task,i)=>({...task,sheetKinds:tasks.slice(Math.floor(i/4)*4,Math.floor(i/4)*4+4).map(t=>t.exerciseKind)})),mode,params);
}
// Lesson data is delivered by the topic ZIP, never imported by the app engine.
export function generateTasks(mode, cards, _sessionSize, params = {}) {
  if (mode?.type === 'drawing_first_lines') {
    const card = (Array.isArray(cards) ? cards : []).find(card => card.firstLines?.kind === 'short_line');
    if (!card) return [];
    if (mode.screenPractice === true) return generateScreenTasks(mode,card,params);
    // App and downloaded topic update separately. An older ZIP must keep tasks it can render.
    if (!mode.params?.practiceSet) {
      const supported = mode.params?.exercises?.values?.filter(kind => SHAPE_KINDS.includes(kind)) ?? ['short_line'];
      const requested = Array.isArray(params.exercises) ? params.exercises : ['short_line'];
      const selected = requested.length ? supported.filter(kind => requested.includes(kind)) : supported;
      const kinds = selected.length ? selected : ['short_line'];
      return Array.from({ length: 15 }, (_, index) => ({
        type: 'drawing_first_line', id: `first_lines:${index}`, cardId: card.id, conceptId: card.conceptId, number: index + 1,
        exerciseKind: kinds[index % kinds.length], title: SHAPE_TITLES[kinds[index % kinds.length]],
        sheetPage: Math.floor(index / 4), sheetSlot: index % 4,
        sheetKinds: Array.from({ length: Math.min(4, 15 - Math.floor(index / 4) * 4) }, (_, slot) => kinds[(Math.floor(index / 4) * 4 + slot) % kinds.length]),
        breakBefore: index > 0 && index % (params.workSurface === 'sheet' ? 4 : 5) === 0,
      }));
    }
    // An explicit focused selection is optional. The normal lesson uses a shuffled bag.
    const requested = params.preciseSelection && Array.isArray(params.exercises) ? params.exercises : null;
    const pool = requested ? (requested.length ? SHAPE_KINDS.filter(kind => requested.includes(kind)) : SHAPE_KINDS)
      : PRACTICE_SETS[params.practiceSet] ?? PRACTICE_SETS.mixed;
    const supported=mode.params?.exercises?.values??SHAPE_KINDS;
    const available=pool.filter(k=>supported.includes(k));
    const kinds = available.length ? available : supported;
    let bag = [], previous = null;
    const nextKind = () => {
      if (!bag.length) {
        bag = [...kinds];
        for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]]; }
        if (bag.length > 1 && bag.at(-1) === previous) [bag[0], bag[bag.length - 1]] = [bag.at(-1), bag[0]];
      }
      previous = bag.pop(); return previous;
    };
    const tasks = Array.from({ length: 15 }, (_, index) => {
      const exerciseKind = nextKind();
      // Generated once and stored with the session. Reload/rotation never rerolls a figure.
      const scale = Math.round((.62 + Math.random() * .43) * 100) / 100;
      const angle = ['arc', 'semicircle', 'wave', 'zigzag', 'zigzag_arc', 'arc_zigzag', 'zigzag_arc_zigzag'].includes(exerciseKind) ? [0, 90, 180, -90][Math.floor(Math.random() * 4)]
        : ['short_line','vertical_line','diagonal_up','diagonal_down','tilted_oval','rhombus'].includes(exerciseKind) ? Math.round((Math.random() - .5) * 30) : 0;
      return { type: 'drawing_first_line', id: `first_lines:${index}`, cardId: card.id, conceptId: card.conceptId, number: index + 1,
        exerciseKind, title: SHAPE_TITLES[exerciseKind], variant: { scale, angle: angle || 0, aspect: ['oval','tilted_oval','rectangle'].includes(exerciseKind) ? Math.round((.9 + Math.random() * .18) * 100) / 100 : 1 },
        sheetPage: Math.floor(index / 4), sheetSlot: index % 4,
        breakBefore: index > 0 && index % (params.workSurface === 'sheet' ? 4 : 5) === 0 };
    });
    return tasks.map((task, index) => ({ ...task, sheetKinds: tasks.slice(Math.floor(index / 4) * 4, Math.floor(index / 4) * 4 + 4).map(t => t.exerciseKind) }));
  }
  return (Array.isArray(cards) ? cards : []).filter(card => card.lesson?.steps?.length).map(card => ({
    type: "drawing_lesson",
    id: `drawing:${card.id}`,
    cardId: card.id,
    conceptId: card.conceptId ?? card.id,
    lesson: card.lesson,
  }));
}
