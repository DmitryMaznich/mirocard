import './planner.css';

export default function ZonePickerSheet({ zones, currentZoneId = null, title, onSelect, onClose }) {
  return (
    <div className="portions-sheet-backdrop" onClick={onClose}>
      <div className="portions-sheet zone-picker-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="portions-sheet__handle" />
        <div className="portions-sheet__title">{title}</div>
        <div className="zone-picker-list">
          {zones.map((zone) => (
            <button
              key={zone.id}
              type="button"
              className={`zone-picker-item${zone.id === currentZoneId ? ' zone-picker-item--active' : ''}`}
              onClick={() => onSelect(zone.id)}
            >
              <span className="zone-picker-item__icon">{zone.icon}</span>
              <span className="zone-picker-item__label">{zone.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
