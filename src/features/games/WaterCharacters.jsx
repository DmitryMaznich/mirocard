import {ART_SIZE,CHARACTER_ART,WATER_PEOPLE_ART} from "./waterCharacterArt";

const WATER_CHARACTERS = [
  {id:"boy",label:"Мальчик"},{id:"girl",label:"Девочка"},
  {id:"man",label:"Мужчина"},{id:"woman",label:"Женщина"},
];

export function CharacterFace({type,color="#e88373"}) {
  const [x,y,size]=(CHARACTER_ART[type] ?? CHARACTER_ART.boy).portrait;
  return <svg viewBox={`${x} ${y} ${size} ${size}`} aria-hidden="true" className="water-character-portrait">
    <rect x={x} y={y} width={size} height={size} rx={size/2} fill={`${color}18`} />
    <image href={WATER_PEOPLE_ART} width={ART_SIZE.width} height={ART_SIZE.height} />
  </svg>;
}

export default function WaterCharacters({values,onChange}) {
  return <div className="water-character-pickers">
    {values.map((selected,player)=><fieldset key={player} className="water-character-picker"><legend>{player===0 ? "Персонаж ученика" : "Персонаж второго игрока"}</legend>
      <div>{WATER_CHARACTERS.map(({id,label})=><button key={id} type="button" aria-pressed={selected===id} onClick={()=>onChange(values.map((value,i)=>i===player ? id : value))}><CharacterFace type={id} color={player===0 ? "#e88373" : "#55a9a5"} /><span>{label}</span></button>)}</div>
    </fieldset>)}
  </div>;
}
