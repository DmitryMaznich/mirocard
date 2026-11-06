const WATER_CHARACTERS = [
  {id:"boy",label:"Мальчик"},{id:"girl",label:"Девочка"},
  {id:"man",label:"Мужчина"},{id:"woman",label:"Женщина"},
];

export function CharacterFace({type,color="#e88373"}) {
  const long=type==="girl" || type==="woman";
  return <svg viewBox="0 0 60 60" aria-hidden="true">
    <circle cx="30" cy="30" r="29" fill="#fff6e8" />
    {long && <path d="M12 24q0-21 18-20q18-1 18 20v24H12z" fill="#77503a" />}
    <path d="M10 60q0-22 20-22q20 0 20 22" fill={color} />
    <ellipse cx="30" cy="25" rx="16" ry="18" fill="#edbc8e" />
    <path d="M14 21q-4-20 16-18q20-2 17 19l-9-9q-10 9-24 8" fill="#77503a" />
    <ellipse cx="24" cy="25" rx="2" ry="3" fill="#29364a" /><ellipse cx="36" cy="25" rx="2" ry="3" fill="#29364a" />
    {type==="man" && <path d="M16 30q14 20 28 0q0 17-14 17q-14 0-14-17" fill="#82573b" />}
    <path d="M25 34q5 5 10 0" stroke={type==="man" ? "#fff0cb" : "#af6d52"} strokeWidth="2" fill="none" strokeLinecap="round" />
  </svg>;
}

export default function WaterCharacters({values,onChange}) {
  return <div className="water-character-pickers">
    {values.map((selected,player)=><fieldset key={player} className="water-character-picker"><legend>{player===0 ? "Персонаж ученика" : "Персонаж второго игрока"}</legend>
      <div>{WATER_CHARACTERS.map(({id,label})=><button key={id} type="button" aria-pressed={selected===id} onClick={()=>onChange(values.map((value,i)=>i===player ? id : value))}><CharacterFace type={id} color={player===0 ? "#e88373" : "#55a9a5"} /><span>{label}</span></button>)}</div>
    </fieldset>)}
  </div>;
}
