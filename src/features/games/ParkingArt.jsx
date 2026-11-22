import "./parking.css";
const ART='/game-art/parking-v1/parking.webp';
export function ParkingBuilding({title,lanes,onClosed}) {
  return <div className="parking-building">
    <div className="parking-roof"><h1>{title}</h1></div>
    <div className="parking-garages">
      {lanes.map(({color,label,symbol},column)=><div key={color} className="parking-garage" data-color={color}
        role="img" aria-label={label}>
        <div className="parking-doorway">
          <div className="parking-shutter" onAnimationEnd={column===0?event=>{
            if(event.animationName==='parking-close-gate')onClosed();
          }:undefined}>
            <span aria-hidden="true">{symbol}</span>
          </div>
        </div>
      </div>)}
    </div>
  </div>;
}

export function ParkingSprite({color,garage=false}) {
  return <svg viewBox={`${color*384} ${garage?384:0} 384 384`} className={garage?'parking-garage-art':'parking-car-art'} aria-hidden="true"><image href={ART} width="1152" height="768" /></svg>;
}
export function ParkingPreview() {
  return <span className="parking-preview" aria-hidden="true"><ParkingSprite color={1} /><ParkingSprite color={1} garage /></span>;
}
export function ParkingBell() {
  const bell='/game-art/parking-v1/bell.webp';
  return <span className="parking-bell-art" aria-hidden="true">
    <img className="parking-bell-body" src={bell} alt="" draggable="false" />
    <img className="parking-bell-plunger" src={bell} alt="" draggable="false" />
  </span>;
}
