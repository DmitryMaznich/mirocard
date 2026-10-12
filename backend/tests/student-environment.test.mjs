import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initDb } from '../lib/db.mjs';
import { createAccount, upsertStudent, upsertStudentAdults, upsertStudentMyPeople, migrateStudentPeopleData } from '../lib/account-repository.mjs';

function setup() {
  const db=initDb(':memory:');
  const account=createAccount(db,{email:'env@test.example',passwordHash:'hash',displayName:'Demo'});
  upsertStudent(db,account.id,{id:'s',name:'Миша',closeAdults:[{id:'mum',name:'Мама',photo:'data:image/png;base64,YWJj'}],updatedAt:'2026-10-12T10:00:00Z'});
  return {db,account};
}
const row=(db)=>db.prepare('SELECT * FROM students WHERE id=?').get('s');
test('startup migration is idempotent and keeps durable photo references',()=>{
  const {db}=setup();
  migrateStudentPeopleData(db);const before=row(db);migrateStudentPeopleData(db);
  assert.deepEqual(row(db),before);
  const people=JSON.parse(before.my_people);
  assert.equal(people.length,1);assert.equal(people[0].id,'adult_mum');assert.match(people[0].photos[0],/^\/api\/photos\//);
  db.close();
});
test('canonical updates regenerate the old projection and survive old clients',()=>{
  const {db,account}=setup();const [mum]=JSON.parse(row(db).my_people);
  upsertStudentMyPeople(db,account.id,{studentId:'s',people:[{...mum,name:'Анна',useInChat:false,updatedAt:'2026-10-14'}],updatedAt:'2026-10-14'});
  upsertStudentAdults(db,account.id,{studentId:'s',closeAdults:[],updatedAt:'2026-10-13'});
  assert.equal(JSON.parse(row(db).my_people)[0].name,'Анна');
  assert.equal(JSON.parse(row(db).close_adults)[0].name,'Мама');
  // An old album editor knows nothing about the new usage flags.
  upsertStudentMyPeople(db,account.id,{studentId:'s',people:[{id:mum.id,name:'Анна',photos:mum.photos,updatedAt:'2026-10-15'}],updatedAt:'2026-10-15'});
  assert.equal(JSON.parse(row(db).my_people)[0].useInSentences,true);
  assert.equal(JSON.parse(row(db).my_people)[0].useInChat,false);
  db.close();
});
test('deleted canonical cards cannot be revived by a later legacy or album operation',()=>{
  const {db,account}=setup();const [mum]=JSON.parse(row(db).my_people);
  upsertStudentMyPeople(db,account.id,{studentId:'s',people:[{...mum,deletedAt:'2026-10-14',updatedAt:'2026-10-14'}],updatedAt:'2026-10-14'});
  upsertStudentAdults(db,account.id,{studentId:'s',closeAdults:[{id:'mum',name:'Мама'}],updatedAt:'2026-10-15'});
  upsertStudentMyPeople(db,account.id,{studentId:'s',people:[{...mum,updatedAt:'2026-10-16'}],updatedAt:'2026-10-16'});
  migrateStudentPeopleData(db);
  assert.equal(JSON.parse(row(db).my_people)[0].deletedAt,'2026-10-14');
  assert.deepEqual(JSON.parse(row(db).close_adults),[]);
  db.close();
});
test('two devices add different people without wiping each other',()=>{
  const {db,account}=setup();
  upsertStudentMyPeople(db,account.id,{studentId:'s',people:[{id:'dad',name:'Папа',type:'person',photos:[],useInSentences:true,updatedAt:'2026-10-14'}],updatedAt:'2026-10-14'});
  upsertStudentMyPeople(db,account.id,{studentId:'s',people:[{id:'cat',name:'Барсик',type:'pet',photos:[],updatedAt:'2026-10-15'}],updatedAt:'2026-10-15'});
  assert.equal(JSON.parse(row(db).my_people).length,3);
  assert.equal(JSON.parse(row(db).close_adults).length,2);
  db.close();
});
