import { useEffect, useState } from "react";
import { useAppStore } from "@/core/store";
import { getPlannerZoneCustomizations, savePlannerZoneCustomizations } from "@/core/groupStore";
import { ZONES, getEffectiveZones } from "@/features/planner/putawayLocations";

const ADD_ZONE_ICONS = ['📦', '🧺', '🚪', '🛁', '🪣', '🧊', '🗄️', '🧴', '🍬', '🪟'];

export default function ZoneSettingsSection() {
  const studentId = useAppStore((s) => s.activeStudentId);
  const [customizations, setCustomizations] = useState({ renamed: {}, added: [] });
  const [loaded, setLoaded] = useState(false);
  const [editingZoneId, setEditingZoneId] = useState(null);
  const [editingVal, setEditingVal] = useState('');
  const [addingZone, setAddingZone] = useState(false);
  const [newZoneLabel, setNewZoneLabel] = useState('');
  const [newZoneIcon, setNewZoneIcon] = useState(ADD_ZONE_ICONS[0]);

  useEffect(() => {
    if (!studentId) { setLoaded(false); return; }
    let cancelled = false;
    getPlannerZoneCustomizations(studentId).then((data) => {
      if (!cancelled) { setCustomizations(data); setLoaded(true); }
    });
    return () => { cancelled = true; };
  }, [studentId]);

  function persist(next) {
    setCustomizations(next);
    savePlannerZoneCustomizations(studentId, next).catch(() => {});
  }

  function saveRename() {
    const label = editingVal.trim();
    if (label) {
      persist({ ...customizations, renamed: { ...customizations.renamed, [editingZoneId]: label } });
    }
    setEditingZoneId(null);
  }

  function addZone() {
    const label = newZoneLabel.trim();
    if (!label) return;
    const id = `custom_${Date.now()}`;
    persist({ ...customizations, added: [...customizations.added, { id, label, icon: newZoneIcon }] });
    setAddingZone(false);
    setNewZoneLabel('');
    setNewZoneIcon(ADD_ZONE_ICONS[0]);
  }

  function removeZone(zoneId) {
    persist({ ...customizations, added: customizations.added.filter((z) => z.id !== zoneId) });
  }

  if (!studentId || !loaded) return null;

  const zones = getEffectiveZones(customizations);
  const baseIds = new Set(ZONES.map((z) => z.id));

  return (
    <div className="settings-section">
      <div className="settings-section-title">Зоны хранения</div>
      {zones.map((zone) => (
        <div key={zone.id} className="settings-row settings-row--zone">
          <span className="settings-zone-icon">{zone.icon}</span>
          {editingZoneId === zone.id ? (
            <input
              className="settings-zone-name-input"
              autoFocus
              value={editingVal}
              onChange={(e) => setEditingVal(e.target.value)}
              onBlur={saveRename}
              onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
            />
          ) : (
            <span
              className="settings-row__label settings-zone-name"
              onClick={() => { setEditingZoneId(zone.id); setEditingVal(zone.label); }}
            >
              {zone.label}
            </span>
          )}
          {!baseIds.has(zone.id) && (
            <button className="settings-zone-del-btn" onClick={() => removeZone(zone.id)} aria-label="Удалить зону">×</button>
          )}
        </div>
      ))}

      {addingZone ? (
        <div className="settings-row settings-row--add-zone">
          <div className="settings-zone-icon-picker">
            {ADD_ZONE_ICONS.map((icon) => (
              <button
                key={icon}
                type="button"
                className={`settings-zone-icon-option${newZoneIcon === icon ? ' settings-zone-icon-option--active' : ''}`}
                onClick={() => setNewZoneIcon(icon)}
              >
                {icon}
              </button>
            ))}
          </div>
          <input
            className="settings-zone-name-input"
            autoFocus
            value={newZoneLabel}
            onChange={(e) => setNewZoneLabel(e.target.value)}
            placeholder="Название зоны"
            onKeyDown={(e) => e.key === 'Enter' && addZone()}
          />
          <button className="link-btn" onClick={addZone}>Добавить</button>
        </div>
      ) : (
        <div className="settings-row">
          <button className="link-btn" onClick={() => setAddingZone(true)}>+ Добавить зону</button>
        </div>
      )}
    </div>
  );
}
