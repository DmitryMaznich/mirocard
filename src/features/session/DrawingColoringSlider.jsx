import {useId} from 'react';
import './DrawingColoringSlider.css';

export default function DrawingColoringSlider({kind,definition,params,onChange}) {
  const id=useId(),fillId=useId().replace(/[^a-zA-Z0-9]/g,'');
  const pen=kind==='penWidth',tolerance=kind==='outsideTolerance';
  const automatic=params.inputMode==='touch'?26:params.inputMode==='passive_pen'?16:12;
  const stored=params[kind]??definition.default;
  const raw=pen&&stored==='auto'?automatic:Number(stored);
  const value=Number.isFinite(raw)?Math.max(definition.min,Math.min(definition.max,raw)):Number(definition.default);
  const unit=kind==='fillTarget'?'%':'px';
  const position=(value-definition.min)/(definition.max-definition.min)*100;
  const label=definition.label.ru;
  return <div className="param-row coloring-slider" data-setting={kind}>
    <div className="coloring-slider__heading"><label className="param-label" htmlFor={id}>{label}</label><output htmlFor={id} aria-live="off">{value}<span>{unit}</span></output></div>
    <div className="coloring-slider__body">
      <div className="coloring-slider__control"><input id={id} type="range" min={definition.min} max={definition.max} step={definition.step??1} value={value}
        aria-valuetext={`${value}${unit==='%'?' процентов':' пикселей'}`} aria-describedby={`${id}-hint`}
        style={{'--coloring-range-position':`${position}%`}} onChange={event=>onChange(Number(event.target.value))}/>
        <div className="coloring-slider__limits" aria-hidden="true"><span>{definition.min}{unit==='%'?'%':''}</span><span>{definition.max}{unit==='%'?'%':' px'}</span></div>
      </div>
      <svg className="coloring-slider__preview" viewBox="0 0 240 100" aria-hidden="true">
        {pen?<><circle cx="42" cy="50" r={value/2} fill="#315b86"/><path d="M88 65C112 10 168 88 212 36" fill="none" stroke="#315b86" strokeWidth={value} strokeLinecap="round"/></>
          :tolerance?<><rect x="20" y="12" width="108" height="68" rx="6" fill="#e1f0e8"/>
            <rect x="128" y="12" width={value} height="68" fill="#f4c77b"/>
            <path d="M128 12V80" stroke="#426b5c" strokeWidth="2"/>
            <path d={`M${128+value} 12V80`} stroke="#af7620" strokeWidth="1.5" strokeDasharray="3 3"/>
            <path d={`M60 52H${Math.max(60,126+value)}`} stroke="#315b86" strokeWidth="4" strokeLinecap="round"/>
            <text x="60" y="96" textAnchor="middle">Внутри</text><text x="174" y="96" textAnchor="middle">Допуск</text></>
          :<><defs><clipPath id={fillId}><rect x="80" y="10" width="80" height="80" rx="8"/></clipPath></defs>
            <rect x="80" y="10" width="80" height="80" rx="8" fill="#edf3f0"/>
            <rect x="80" y={90-value*.8} width="80" height={value*.8} fill="#66aacd" clipPath={`url(#${fillId})`}/>
            <rect x="80" y="10" width="80" height="80" rx="8" fill="none" stroke="#315b86" strokeWidth="2"/>
            <text x="120" y="56" textAnchor="middle" className="coloring-slider__percent">{value}%</text></>}
      </svg>
    </div>
    <p id={`${id}-hint`} className="coloring-slider__hint">{pen?'Образец показывает реальную толщину пера.':tolerance?'Цветная полоса — допустимое расстояние за границей фигуры.':'Столько внутренней площади нужно закрасить для завершения.'}</p>
  </div>;
}
