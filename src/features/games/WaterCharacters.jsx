import boyPortrait from "./art/boy-portrait.webp?inline";
import girlPortrait from "./art/girl-portrait.webp?inline";
import manPortrait from "./art/man-portrait.webp?inline";
import womanPortrait from "./art/woman-portrait.webp?inline";

const PORTRAITS={boy:boyPortrait,girl:girlPortrait,man:manPortrait,woman:womanPortrait};

const WATER_CHARACTERS = [
  {id:"boy",label:"Мальчик"},{id:"girl",label:"Девочка"},
  {id:"man",label:"Мужчина"},{id:"woman",label:"Женщина"},
];

export function CharacterFace({type,color="#e88373"}) {
  return <svg viewBox="0 0 112 112" aria-hidden="true" className="water-character-portrait">
    <rect width="112" height="112" rx="56" fill={`${color}18`} />
    <image href={PORTRAITS[type] ?? PORTRAITS.boy} width="112" height="112" />
  </svg>;
}

export default function WaterCharacters({values,onChange}) {
  return <div className="water-character-pickers">
    {values.map((selected,player)=><fieldset key={player} className="water-character-picker"><legend>{player===0 ? "Персонаж ученика" : "Персонаж второго игрока"}</legend>
      <div>{WATER_CHARACTERS.map(({id,label})=><button key={id} type="button" aria-pressed={selected===id} onClick={()=>onChange(values.map((value,i)=>i===player ? id : value))}><CharacterFace type={id} color={player===0 ? "#e88373" : "#55a9a5"} /><span>{label}</span></button>)}</div>
    </fieldset>)}
  </div>;
}
