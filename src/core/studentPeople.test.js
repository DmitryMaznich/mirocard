import { describe, it, expect } from 'vitest';
import { studentPeople, migrateStudentPeople, peopleFor, applyLegacyAdults, mergePeopleCards, resolvePerson } from '../../shared/student-people.mjs';
import { generateTasks } from '@/topics/renderers/sentence_puzzle/engine';
import { mergeMyPeople } from './bootstrap';

const ts = '2026-10-12T10:00:00Z';
const legacy = { id: 's', closeAdults: [{ id: 'mum', name: 'Мама', photo: '/api/photos/mum' }], closeAdultsUpdatedAt: ts };
describe('unified student environment', () => {
  it('migrates offline records once and preserves the old subject/contact ids', () => {
    const migrated = migrateStudentPeople(legacy);
    expect(studentPeople(migrated)).toEqual(migrated.myPeople);
    expect(peopleFor(migrated, 'sentences')).toEqual([{ id: 'mum', personId: 'adult_mum', name: 'Мама', photo: '/api/photos/mum' }]);
    expect(peopleFor(migrated, 'chat')).toHaveLength(1);
  });
  it('does not conflate two grandmothers with the same name', () => {
    expect(studentPeople({ closeAdults: [{ id: 'a', name: 'Бабушка' }, { id: 'b', name: 'Бабушка' }] })).toHaveLength(2);
  });
  it('links only a unique matching photo and identity without losing learning metadata', () => {
    const student = { ...legacy, myPeople: [{ id: 'anna', name: 'Анна', relation: 'мама', photos: ['/api/photos/mum', '/api/photos/other'], introducedAxes: ['name'], contexts: ['family', 'home'] }] };
    const [person] = studentPeople(student);
    expect(person.id).toBe('anna');
    expect(person.photos).toHaveLength(2);
    expect(person.introducedAxes).toEqual(['name']);
    expect(studentPeople({ ...student, myPeople: [person] })).toHaveLength(1);
  });
  it('does not restore deleted legacy cards during subsequent bootstrap', () => {
    const [person] = studentPeople(legacy);
    expect(peopleFor({ ...legacy, myPeople: [{ ...person, deletedAt: '2026-10-13' }] }, 'sentences')).toEqual([]);
  });
  it('keeps topic selection separate and excludes pets from human sentence/contact cards', () => {
    const student = { myPeople: [
      { id: 'a', name: 'Анна', relation: 'мама', photos: ['a'], useInSentences: true, useInChat: false, enabled: false },
      { id: 'b', name: 'Борис', photos: ['b'], useInSentences: false, useInChat: true },
      { id: 'cat', name: 'Барсик', type: 'pet', useInSentences: true, useInChat: true },
    ] };
    expect(peopleFor(student, 'sentences').map(p => p.name)).toEqual(['мама']);
    expect(peopleFor(student, 'chat').map(p => p.name)).toEqual(['Борис']);
  });
  it('preserves a canonical edit when an older legacy list arrives', () => {
    const person = { ...studentPeople(legacy)[0], name: 'Анна', updatedAt: '2026-10-14', useInChat: false };
    expect(applyLegacyAdults({ myPeople: [person] }, [], '2026-10-13')[0]).toEqual(person);
  });
  it('retains fields and tombstones when an old album editor writes a partial record', () => {
    const [person] = studentPeople(legacy);
    expect(mergeMyPeople([person], [{ id: person.id, name: 'Новое имя', updatedAt: '2026-10-14' }])[0].useInSentences).toBe(true);
    expect(mergeMyPeople([{ ...person, deletedAt: '2026-10-13' }], [{ ...person, updatedAt: '2026-10-14' }])[0].deletedAt).toBe('2026-10-13');
    expect(mergeMyPeople([{ ...person, updatedAt: '2026-10-14' }], [{ ...person, deletedAt: '2026-10-13' }])[0].deletedAt).toBe('2026-10-13');
  });
  it('merges duplicates without trimming photos or breaking date references', () => {
    const people = [{ id: 'a', type: 'person', name: 'Анна', photos: ['1','2','3','4','5'], contexts: ['family'], introducedAxes: ['name'] },
      { id: 'adult_mum', type: 'person', name: 'Мама', legacyAdultId: 'mum', photos: ['6'], contexts: ['home'], introducedAxes: ['relation'], useInSentences: true }];
    const merged = mergePeopleCards(people, 'adult_mum', 'a', ts);
    expect(resolvePerson(merged, 'adult_mum').id).toBe('a');
    expect(resolvePerson(merged, 'a').photos).toHaveLength(6);
    expect(resolvePerson(merged, 'a').introducedAxes).toEqual(['name','relation']);
    expect(studentPeople({ myPeople: merged, closeAdults: legacy.closeAdults })).toHaveLength(2);
  });
  it('uses personal subjects in listening mode without playing a mismatched stock recording', () => {
    const topic = { cards: [{ id:'s', type:'subject', label:'Мальчик' }, { id:'v', type:'verb', label:'ест' }], sentences:[{ subject:'s', verb:'v', audio:'boy-eats.mp3' }] };
    const [task] = generateTasks({ type:'listen_build' }, topic, { structure:'simple' }, legacy);
    expect(task.target.subject.label).toBe('Мама');
    expect(task.audioPath).toBeNull();
    expect(generateTasks({type:'listen_build'},topic,{structure:'simple'}, {})[0].audioPath).toBe('boy-eats.mp3');
  });
});
