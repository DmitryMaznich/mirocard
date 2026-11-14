import {PALETTE} from './palette.js';

export default function ColorPalette({color,disabled,onChange}) {
  return <div className="coloring__palette" role="group" aria-label="Цвет карандаша">
    {PALETTE.map(item=><button key={item.color} type="button" className="coloring__color" style={{'--pencil-color':item.color}}
      aria-label={item.label} title={item.label} aria-pressed={color===item.color} disabled={disabled} onClick={()=>onChange(item.color)}>
      <svg className="coloring__pencil" viewBox="0 0 32 40" aria-hidden="true">
        <path d="M9 12 16 3l7 9v22a3 3 0 0 1-3 3h-8a3 3 0 0 1-3-3Z" fill="currentColor"/>
        <path d="m9 12 7-9 7 9Z" fill="#eddbb8"/><path d="m13 7 3-4 3 4Z" fill="currentColor"/>
        <path d="M12 16v14" stroke="white" strokeWidth="2.5" strokeLinecap="round" opacity=".5"/>
      </svg>
      {color===item.color&&<span className="coloring__color-check" aria-hidden="true">✓</span>}
    </button>)}
  </div>;
}
