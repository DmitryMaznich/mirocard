import "./parking.css";
const ART='/game-art/parking-v1/parking.webp';
export function ParkingSprite({color,garage=false}) {
  return <svg viewBox={`${color*384} ${garage?384:0} 384 384`} className={garage?'parking-garage-art':'parking-car-art'} aria-hidden="true"><image href={ART} width="1152" height="768" /></svg>;
}
export function ParkingPreview() {
  return <span className="parking-preview" aria-hidden="true"><ParkingSprite color={1} /><ParkingSprite color={1} garage /></span>;
}
export function ParkingBell() {
  return <svg viewBox="0 0 110 105" aria-hidden="true"><ellipse cx="55" cy="91" rx="44" ry="7" fill="#20324e" opacity=".12" /><path d="M17 81c0-21 6-40 24-45h28c18 5 24 24 24 45z" fill="#ffcb65" stroke="#b67b29" strokeWidth="3" /><ellipse cx="55" cy="82" rx="39" ry="9" fill="#dba34d" /><path d="M26 75c2-16 8-27 19-30" fill="none" stroke="#fff1bc" strokeWidth="7" strokeLinecap="round" /><rect x="49" y="20" width="12" height="23" rx="5" fill="#926635" /><ellipse cx="55" cy="20" rx="17" ry="8" fill="#334960" /><path d="M24 26l-7-8m69 8 7-8M55 7V1" fill="none" stroke="#d99b36" strokeWidth="4" strokeLinecap="round" /></svg>;
}
