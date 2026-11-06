/* global window, document, innerWidth */
// Run against npm run dev. Uses fictional photos and an isolated account;
// API responses are intercepted, so it never writes to a real account.
import { chromium } from '@playwright/test';
import fs from 'node:fs';
const output = process.env.PEOPLE_QA_OUTPUT ?? 'output/my-people-v2';
fs.mkdirSync(output, { recursive: true });
(async()=>{
const browser=await chromium.launch({...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : { channel: 'chrome' }),args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:390,height:844}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const docs={};
await page.route('**/api/**',async route=>{
 const url=new URL(route.request().url());
 if(url.pathname.endsWith('/account/kv')) return route.fulfill({json:{kv:Object.entries(docs).filter(([k])=>k.startsWith(url.searchParams.get('prefix')||'')).map(([key,value])=>({key,value}))}});
 if(url.pathname.endsWith('/sync')) {for(const op of route.request().postDataJSON()?.operations||[]) if(op.type==='kv.upsert')docs[op.data.key]=op.data.value;return route.fulfill({json:{ok:true}});}
 return route.fulfill({json:{ok:true,version:'1.0.2818',sessions:[],students:[],settings:{},topics:[],plan:null}});
});
await page.goto(process.env.PEOPLE_QA_URL ?? 'http://localhost:8080/');
await page.waitForFunction(()=>window.__store?.getState().screen==='login');
const images=['04e05ac64519d99a.jpg','05d9baf4a84eef78.jpg','3453cb8c16324673.jpg','867f9507fe939f4b.jpg','a5855a041da65d63.jpg','bec48be845e774e2.jpg'].map(f=>'data:image/jpeg;base64,'+fs.readFileSync('docs/mockups/my-people-2026-11-04/assets/'+f).toString('base64'));
await page.evaluate(images=>{
 const student={id:'qa-kid',name:'Мирон',lessonFlow:{advance:'tap',delaySeconds:1},myPeople:['Анна','Иван','Саша','Ольга','Маша','Барсик'].map((name,i)=>({id:'p'+i,type:i===5?'pet':'person',name,relation:['мама','папа','подруга','учительница','сестра','кот'][i],contexts:[i<2?'family':'friends'],photos:[images[i]],enabled:true}))};
 const s=window.__store.getState();s.setAccount({id:'qa-account',displayName:'Тест'});s.setStudents([student]);s.setActiveStudentId(student.id);s.setActiveTopicId('my_people');s.patchSettings({adultPinHash:null});s.setScreen('modes');
},images);
await page.getByRole('button',{name:'Занятия по плану',exact:true}).click();
await page.getByRole('button',{name:'Для взрослого',exact:true}).click();
await page.getByRole('button',{name:'Все параметры',exact:true}).click();
await page.getByRole('button',{name:'6 фото · 5 отвлекающих',exact:true}).click();
await page.getByRole('button',{name:'Пропустить',exact:true}).click();
await page.getByRole('button',{name:'4',exact:true}).click();
await page.screenshot({path:output+'/'+'settings-390.png',fullPage:true});
await page.getByRole('button',{name:'Подготовить ребёнку',exact:true}).click();
await page.getByRole('button',{name:'Начать',exact:true}).waitFor();
await page.screenshot({path:output+'/'+'home-390.png'});
await page.getByRole('button',{name:'Начать',exact:true}).click();
await page.waitForTimeout(2000);

await page.screenshot({path:output+'/'+'debug-session.png'});
await page.locator('.pl-choice__hit:not([disabled])').first().waitFor();
console.log('choices',await page.locator('.pl-choice__hit').count());
await page.screenshot({path:output+'/'+'select-six-390.png'});
for(let i=0;i<15;i++){
 if(await page.getByRole('heading',{name:'Готово!',exact:true}).count())break;
 const task=await page.evaluate(()=>window.__store.getState().activeSessionSnapshot?.sessionState?.tasks[window.__store.getState().activeSessionSnapshot?.sessionState?.taskIndex]);
 if(!task){await page.waitForTimeout(150);continue;}
 const idx=task.choices.findIndex(c=>c.personId===task.targetPersonId);
 await page.locator('.pl-choice__hit').nth(idx).click();
 await page.locator('.session-renderer-wrap--tappable').click({position:{x:5,y:5}});
 await page.waitForTimeout(100);
}
await page.getByRole('heading',{name:'Готово!',exact:true}).waitFor();
await page.getByRole('button',{name:'Результат для взрослого',exact:true}).click();
await page.getByRole('heading',{name:'Результат занятия',exact:true}).waitFor();
await page.screenshot({path:output+'/'+'result-390.png',fullPage:true});

console.log('saved',await page.evaluate(()=>window.__store.getState().sessions.at(-1)?.statistics?.myPeople?.trials?.map(t=>({kind:t.kind,outcome:t.outcome}))));
await page.getByRole('button',{name:'К теме',exact:true}).click();
await page.getByRole('button',{name:'Для взрослого',exact:true}).click();
await page.getByRole('button',{name:'Со взрослым',exact:true}).click();
await page.getByRole('button',{name:'Назвать самому',exact:true}).click();
await page.getByRole('button',{name:'Все параметры',exact:true}).click();
await page.getByRole('button',{name:'4',exact:true}).click();
await page.getByRole('button',{name:'Начать вместе',exact:true}).click();
await page.getByRole('button',{name:'Полностью сам',exact:true}).waitFor({state:'visible'});
await page.waitForFunction(()=>!document.querySelector('.pl-controls button')?.disabled);
if(await page.locator('.pl-controls button').count()!==4)throw Error('adult controls');
if((await page.locator('.pl-controls').innerText()).includes('Ответ:'))throw Error('answer leaked');
await page.screenshot({path:output+'/'+'recall-adult-390.png'});
await page.getByRole('button',{name:'Подсказка',exact:true}).click();
if(!await page.getByRole('button',{name:'Полностью сам',exact:true}).isDisabled())throw Error('independent after hint');
await page.evaluate(()=>{const s=window.__store.getState();s.setScreen('modes');});
await page.getByRole('button',{name:'Для взрослого',exact:true}).click();
await page.getByRole('button',{name:'Продолжить занятие со взрослым',exact:true}).click();
await page.waitForFunction(()=>!document.querySelector('.pl-controls button')?.disabled);
if(!await page.getByRole('button',{name:'Полностью сам',exact:true}).isDisabled())throw Error('hint lost on recovery');
await page.getByRole('button',{name:'Подсказка',exact:true}).click();
await page.waitForTimeout(200);

await page.setViewportSize({width:320,height:640});
await page.waitForTimeout(100);
await page.screenshot({path:output+'/'+'recall-hint-320.png'});
const bounds=await page.locator('.pl-controls').boundingBox();if(bounds.y+bounds.height>640)throw Error('controls offscreen');
for(let i=0;i<14;i++){
 await page.waitForFunction(()=>[...document.querySelectorAll('h1')].some(h=>h.textContent==='Готово!') || [...document.querySelectorAll('.pl-controls button')].some(b=>b.textContent==='С подсказкой' && !b.disabled));
 if(await page.getByRole('heading',{name:'Готово!',exact:true}).count())break;
 const grade=page.getByRole('button',{name:'С подсказкой',exact:true});
 await grade.click();
 await page.locator('.session-renderer-wrap--tappable').click({position:{x:5,y:5}});
 await page.waitForTimeout(70);
}
await page.getByRole('heading',{name:'Готово!',exact:true}).waitFor();
await page.getByRole('button',{name:'Домой',exact:true}).click();
await page.getByRole('button',{name:'Для взрослого',exact:true}).click();
await page.getByRole('button',{name:'Назвать самому',exact:true}).click();
await page.getByRole('button',{name:'Подготовить ребёнку',exact:true}).click();
await page.getByRole('button',{name:'Начать',exact:true}).click();
await page.getByRole('button',{name:'Послушать ответ',exact:true}).waitFor();
await page.waitForFunction(()=>!document.querySelector('.pl-controls button')?.disabled);
if(await page.getByRole('button',{name:'Полностью сам',exact:true}).count())throw Error('self grading');
await page.getByRole('button',{name:'Послушать ответ',exact:true}).click();
await page.waitForTimeout(200);
await page.screenshot({path:output+'/'+'practice-320.png'});
for(const goal of ['Имена','Кто он мне'])for(const context of ['Самостоятельно','Со взрослым'])for(const activity of ['Выбрать фото','Назвать самому']){
 await page.evaluate(()=>window.__store.getState().setScreen('modes'));
 await page.getByRole('button',{name:'Для взрослого',exact:true}).click();
 await page.getByRole('button',{name:goal,exact:true}).click();
 await page.getByRole('button',{name:context,exact:true}).click();
 await page.getByRole('button',{name:activity,exact:true}).click();
 await page.getByRole('button',{name:'Все параметры',exact:true}).click();
 if(activity==='Выбрать фото')await page.getByRole('button',{name:'Пропустить',exact:true}).click();
 await page.getByRole('button',{name:'Выключена',exact:true}).click();
 await page.getByRole('button',{name:context==='Самостоятельно'?'Подготовить ребёнку':'Начать вместе',exact:true}).click();
 if(context==='Самостоятельно')await page.getByRole('button',{name:'Начать',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('.pl-controls button') && !document.querySelector('.pl-controls button').disabled);
 const checks=await page.evaluate(()=>({choices:document.querySelectorAll('.pl-choice__hit').length,controls:[...document.querySelectorAll('.pl-controls button')].map(b=>b.textContent),speaker:document.querySelector('.pl-speaker')!==null}));
 if(activity==='Выбрать фото' && checks.choices<2)throw Error('missing choices');
 if(activity==='Назвать самому' && context==='Со взрослым' && checks.controls.length!==4)throw Error('adult panel');
 if(activity==='Назвать самому' && context==='Самостоятельно' && checks.controls.includes('Полностью сам'))throw Error('practice scored');
 if(checks.speaker)throw Error('voice toggle');
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
 if(overflow)throw Error('horizontal overflow');
 console.log('PASS',goal,context,activity);
}
await page.evaluate(()=>window.__store.getState().setScreen('modes'));
await page.getByRole('button',{name:'Для взрослого',exact:true}).click();
await page.getByRole('button',{name:'Имена',exact:true}).click();
await page.getByRole('button',{name:'Самостоятельно',exact:true}).click();
await page.getByRole('button',{name:'Выбрать фото',exact:true}).click();
await page.getByRole('button',{name:'Семья',exact:true}).click();
await page.getByRole('button',{name:'Все параметры',exact:true}).click();
await page.getByRole('button',{name:'6 фото · 5 отвлекающих',exact:true}).click();
const targets=page.locator('fieldset').filter({has:page.locator('legend',{hasText:'Кого учим'})});
if(await targets.locator('input:checked').count()!==2)throw Error('family targets not filtered');
await page.screenshot({path:output+'/category-family-320.png',fullPage:true});
await page.getByRole('button',{name:'Подготовить ребёнку',exact:true}).click();
await page.getByRole('button',{name:'Начать',exact:true}).click();
await page.waitForFunction(()=>document.querySelector('.pl-choice__hit:not([disabled])'));
const selected=await page.evaluate(()=>{const s=window.__store.getState();return {category:s.myPeopleLaunchPlan.category,ids:s.myPeopleLaunchPlan.targetPersonIds};});
if(selected.category!=='family'||selected.ids.join(',')!=='p0,p1')throw Error('category not saved in launch');
if(await page.locator('.pl-choice__hit').count()!==6)throw Error('category narrowed distractors');
await page.evaluate(()=>window.__store.getState().setScreen('modes'));
await page.getByRole('button',{name:'Для взрослого',exact:true}).click();
await page.getByRole('button',{name:'Школа',exact:true}).click();
if(!await page.getByRole('button',{name:'Подготовить ребёнку',exact:true}).isDisabled())throw Error('empty category silently replaced');
console.log('PASS category selection, saved plan, independent distractors and empty category');
// The ordinary mode settings must expose the category as well as the v2 hub.
await page.evaluate(()=>{
 const s=window.__store.getState();
 s.setStudents(s.students.map(student=>({...student,myPeople:student.myPeople.map((person,i)=>({...person,introducedAxes:['name','relation'],contexts:[i<2?'family':i<4?'school':'friends']}))})));
 s.upsertStudentTopicLink('qa-kid','my_people',{videoRewardEnabled:false,params:{}});
});
for(const id of ['who_is_this','show_me','match_same','label_photos']){
 await page.evaluate(id=>{const s=window.__store.getState();s.setActiveTopicId('my_people');s.setActiveModeId(id);s.setMyPeopleLaunchPlan(null);s.clearActiveSessionSnapshot();s.setSessionReturnScreen(null);s.setScreen('params');},id);
 await page.getByText('Категория людей',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Школа',exact:true}).click();
 if(id==='match_same')await page.getByRole('button',{name:'Одинаковое фото',exact:true}).click();
 if(id==='label_photos')await page.getByRole('button',{name:'Имена',exact:true}).click();
 await page.screenshot({path:output+'/mode-'+id+'-category.png',fullPage:true});
 await page.getByRole('button',{name:'Начать занятие',exact:true}).click();
 await page.waitForFunction(()=>window.__store.getState().activeSessionSnapshot?.sessionState?.tasks?.length>0);
 const result=await page.evaluate(()=>{const ss=window.__store.getState().activeSessionSnapshot.sessionState;return {circle:ss.statistics.conditions.params.circle,ids:ss.tasks.flatMap(t=>t.personId?[t.personId]:(t.entries??[]).map(e=>e.personId))};});
 if(result.circle!=='school'||result.ids.some(id=>!['p2','p3'].includes(id)))throw Error('ordinary mode ignored category '+id);
 console.log('PASS ordinary mode category settings and generated tasks',id);
}
console.log('errors',errors);
if(errors.length)throw Error('browser errors');
await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
