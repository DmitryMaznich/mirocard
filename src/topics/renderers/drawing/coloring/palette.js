export const PALETTE = [
  {color:'#ef6363',label:'Красный'},
  {color:'#edc94b',label:'Жёлтый'},
  {color:'#68b77d',label:'Зелёный'},
  {color:'#66aacd',label:'Голубой'},
  {color:'#9b7bd1',label:'Фиолетовый'},
];
export const DEFAULT_COLOR='#66aacd';
export function inkColor(value) {return PALETTE.some(item=>item.color===value)?value:DEFAULT_COLOR;}
const choiceKey=student=>`drawing-color-choice:${student??'local'}`;
export function readColorChoice(student) {
  try{return inkColor(localStorage.getItem(choiceKey(student)));}catch{return DEFAULT_COLOR;}
}
export function chooseColor(snapshot,student,color) {
  const selected=inkColor(color);
  if(snapshot)snapshot.progress.color=selected;
  try{localStorage.setItem(choiceKey(student),selected);}catch{ /* Optional preference. */ }
  return selected;
}
