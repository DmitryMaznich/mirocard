import { useEffect, useState } from 'react';
import { useAppStore } from '@/core/store';
import { getDb, kv } from '@/core/db';
import { api } from '@/core/api';
import {
  getPlannerShopCustomData, getPlannerShopBought, getPlannerPutawayPlan, savePlannerPutawayPlan,
  getPlannerProductZoneOverrides, savePlannerProductZoneOverrides, getPlannerZoneCustomizations,
} from '@/core/groupStore';
import { buildPutawayQueue, getRequiredZones } from './putawayUtils.js';
import { ZONES, getEffectiveZones } from './putawayLocations.js';
import { savePendingZonePhoto, markPendingZoneSkipped, getResolvedZoneIds, getZoneReferencePhoto, saveZoneReferencePhoto } from './plannerPhotos.js';
import PhotoCaptureCard from './PhotoCaptureCard.jsx';
import ZonePickerSheet from './ZonePickerSheet.jsx';
import PinGateModal from '@/shared/components/PinGateModal';
import { BackArrowIcon } from '@/shared/components/ArrowIcons';
import './planner.css';

// Loads (and re-loads when `version` bumps) one zone's permanent reference
// photo. Same load-blob/create-object-URL/revoke-on-cleanup shape as
// HomeScreen.jsx's CycleHistoryPhotoThumb — kept local here since nothing
// outside this screen needs it.
function ZonePhoto({ studentId, zoneId, version, className, fallback }) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    let objectUrl = null;
    let cancelled = false;
    getZoneReferencePhoto(studentId, zoneId).then((blob) => {
      if (cancelled || !blob) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [studentId, zoneId, version]);

  if (!url) return fallback;
  return <img src={url} className={className} alt="" />;
}

export default function PlannerPutawayScreen() {
  const setScreen = useAppStore((s) => s.setScreen);
  const studentId = useAppStore((s) => s.activeStudentId);
  const adultPinHash = useAppStore((s) => s.settings.adultPinHash);
  const patchSettings = useAppStore((s) => s.patchSettings);

  const [loading, setLoading] = useState(true);
  const [queue, setQueue] = useState([]);
  const [putawayPlan, setPutawayPlan] = useState({});
  const [doneCount, setDoneCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [wrongZoneId, setWrongZoneId] = useState(null);
  const [photographedZones, setPhotographedZones] = useState([]);
  const [zonesLoaded, setZonesLoaded] = useState(false);
  const [zonePhotoVersions, setZonePhotoVersions] = useState({});
  const [editingZoneId, setEditingZoneId] = useState(null);
  const [overrides, setOverrides] = useState({});
  const [effectiveZones, setEffectiveZones] = useState(ZONES);
  const [zoneFixGateOpen, setZoneFixGateOpen] = useState(false);
  const [zonePickerOpen, setZonePickerOpen] = useState(false);

  useEffect(() => {
    if (!studentId) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      const [customData, bought, plan, zoneOverrides, zoneCustomizations] = await Promise.all([
        getPlannerShopCustomData(studentId),
        getPlannerShopBought(studentId),
        getPlannerPutawayPlan(studentId),
        getPlannerProductZoneOverrides(studentId),
        getPlannerZoneCustomizations(studentId),
      ]);
      if (cancelled) return;
      const safePlan = plan ?? {};
      const safeOverrides = zoneOverrides ?? {};
      const builtQueue = customData ? buildPutawayQueue(customData, bought ?? {}, safePlan, safeOverrides) : [];
      setQueue(builtQueue);
      setPutawayPlan(safePlan);
      setOverrides(safeOverrides);
      setEffectiveZones(getEffectiveZones(zoneCustomizations));
      setDoneCount(Object.keys(safePlan).length);
      setTotalCount(Object.keys(safePlan).length + builtQueue.length);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [studentId]);

  useEffect(() => {
    if (loading || queue.length > 0 || !studentId) return;
    let cancelled = false;
    getResolvedZoneIds(studentId).then((ids) => {
      if (!cancelled) { setPhotographedZones(ids); setZonesLoaded(true); }
    });
    return () => { cancelled = true; };
  }, [loading, queue.length, studentId]);

  const current = queue[0];
  const requiredZones = getRequiredZones(putawayPlan);
  const missingZones = requiredZones.filter((id) => !photographedZones.includes(id));
  const zoneToShoot = missingZones[0] ?? null;
  const zoneMeta = zoneToShoot ? ZONES.find((z) => z.id === zoneToShoot) : null;

  function handlePick(zoneId) {
    if (!current) return;
    if (zoneId !== current.zoneId) {
      setWrongZoneId(zoneId);
      setTimeout(() => setWrongZoneId(null), 300);
      setWrongCount((n) => n + 1);
      return;
    }
    const nextPlan = { ...putawayPlan, [current.key]: current.zoneId };
    setPutawayPlan(nextPlan);
    savePlannerPutawayPlan(studentId, nextPlan).catch(() => {});
    setQueue((q) => q.slice(1));
    setDoneCount((n) => n + 1);
    setWrongCount(0);
    setWrongZoneId(null);
  }

  async function saveZoneOverride(productName, zoneId) {
    const norm = productName.trim().toLowerCase();
    const next = { ...overrides, [norm]: zoneId };
    setOverrides(next);
    await savePlannerProductZoneOverrides(studentId, next);
  }

  function handleZoneFixSelect(zoneId) {
    if (!current) return;
    saveZoneOverride(current.product, zoneId).catch(() => {});
    setQueue((q) => q.map((item, i) => (i === 0 ? { ...item, zoneId } : item)));
    setZonePickerOpen(false);
  }

  async function handleSetPin(hash) {
    patchSettings({ adultPinHash: hash });
    const db = await getDb();
    await kv.set(db, "settings", { ...useAppStore.getState().settings, adultPinHash: hash });
    api.patch("/account/settings", { adultPinHash: hash }).catch(() => {});
  }

  function handleZonePhotoConfirm(zoneId) {
    return async (blob) => {
      await saveZoneReferencePhoto(studentId, zoneId, blob);
      setZonePhotoVersions((prev) => ({ ...prev, [zoneId]: (prev[zoneId] ?? 0) + 1 }));
      setEditingZoneId(null);
    };
  }

  if (loading) return <div className="screen screen-center">Загрузка…</div>;

  return (
    <div className="screen planner-screen putaway-screen">
      <div className="planner-header">
        <button className="planner-header__back" onClick={() => setScreen('home')}><BackArrowIcon size={22} /></button>
        <h1 className="planner-header__title">Раскладка</h1>
      </div>

      {!current ? (
        totalCount === 0 ? (
          <div className="putaway-empty">Пока нечего раскладывать — сначала отметь купленные продукты в «В магазине».</div>
        ) : !zonesLoaded ? (
          <div className="putaway-body screen-center">Загрузка…</div>
        ) : zoneToShoot ? (
          <div className="putaway-body">
            <div className="putaway-progress">Фото {photographedZones.length + 1} из {requiredZones.length}</div>
            <PhotoCaptureCard
              key={zoneToShoot}
              title={`Сфотографируй: ${zoneMeta.label}`}
              hint="Покажи, что продукты разложены по местам"
              maxDim={1280}
              quality={0.75}
              onConfirm={async (blob) => {
                await savePendingZonePhoto(studentId, zoneToShoot, blob);
                setPhotographedZones((prev) => [...prev, zoneToShoot]);
              }}
              onSkip={async () => {
                await markPendingZoneSkipped(studentId, zoneToShoot);
                setPhotographedZones((prev) => [...prev, zoneToShoot]);
              }}
              skipLabel="Пропустить фото"
            />
            <div className="putaway-dots">
              {requiredZones.map((id) => (
                <span key={id} className={`putaway-dot${photographedZones.includes(id) ? ' putaway-dot--done' : ''}`} />
              ))}
            </div>
          </div>
        ) : (
          <div className="putaway-complete">
            <div className="putaway-complete__icon">🎉</div>
            <div className="putaway-complete__title">Всё разложено!</div>
            <div className="putaway-complete__hint">{totalCount} продуктов на своих местах</div>
            <button type="button" className="putaway-complete__done-btn" onClick={() => setScreen('home')}>
              На главный
            </button>
          </div>
        )
      ) : (
        <div className="putaway-body">
          <button
            type="button"
            className="putaway-zone-fix-fab"
            onClick={() => setZoneFixGateOpen(true)}
            aria-label="Исправить место для товара"
          >
            ⚙️
          </button>

          <div className="putaway-progress">Продукт {doneCount + 1} из {totalCount}</div>

          {current.zoneId === null ? (
            <div className="putaway-orphan">
              <div className="putaway-card">
                <div className="putaway-card__icon">❓</div>
                <div className="putaway-card__name">{current.product}</div>
              </div>
              <div className="putaway-orphan__hint">Нужна помощь взрослого — выбери место для этого продукта</div>
              <button type="button" className="putaway-orphan__fix-btn" onClick={() => setZoneFixGateOpen(true)}>
                Выбрать место
              </button>
            </div>
          ) : (
            <>
              <div className="putaway-card">
                <ZonePhoto
                  studentId={studentId}
                  zoneId={current.zoneId}
                  version={zonePhotoVersions[current.zoneId] ?? 0}
                  className="putaway-card__photo"
                  fallback={<div className="putaway-card__icon">{ZONES.find((z) => z.id === current.zoneId)?.icon}</div>}
                />
                <div className="putaway-card__name">{current.product}</div>
              </div>

              <div className="putaway-zones">
                {effectiveZones.map((zone) => (
                  <button
                    key={zone.id}
                    className={`putaway-zone${wrongZoneId === zone.id ? ' putaway-zone--wrong' : ''}${wrongCount >= 2 && zone.id === current.zoneId ? ' putaway-zone--hint' : ''}`}
                    onClick={() => handlePick(zone.id)}
                  >
                    <div className="putaway-zone__media">
                      <span
                        className="putaway-zone__camera-badge"
                        onClick={(e) => { e.stopPropagation(); setEditingZoneId(zone.id); }}
                        aria-label={`Сфотографировать: ${zone.label}`}
                      >
                        📷
                      </span>
                      <ZonePhoto
                        studentId={studentId}
                        zoneId={zone.id}
                        version={zonePhotoVersions[zone.id] ?? 0}
                        className="putaway-zone__photo"
                        fallback={<span className="putaway-zone__icon">{zone.icon}</span>}
                      />
                    </div>
                    <span className="putaway-zone__label">{zone.label}</span>
                  </button>
                ))}
              </div>

              <div className="putaway-hint">
                {wrongCount >= 2 ? 'Вот сюда — попробуй эту зону' : wrongZoneId ? 'Не совсем — попробуй другое место' : ''}
              </div>
            </>
          )}

          <div className="putaway-dots">
            {Array.from({ length: totalCount }).map((_, i) => (
              <span key={i} className={`putaway-dot${i < doneCount ? ' putaway-dot--done' : ''}`} />
            ))}
          </div>
        </div>
      )}

      {editingZoneId && (
        <div className="portions-sheet-backdrop" onClick={() => setEditingZoneId(null)}>
          <div className="portions-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="portions-sheet__handle" />
            <PhotoCaptureCard
              key={editingZoneId}
              title={`Сфотографируй: ${ZONES.find((z) => z.id === editingZoneId).label}`}
              hint="Так ученик быстрее узнает своё место"
              maxDim={1280}
              quality={0.75}
              onConfirm={handleZonePhotoConfirm(editingZoneId)}
            />
          </div>
        </div>
      )}

      {zoneFixGateOpen && (
        <PinGateModal
          pinHash={adultPinHash}
          onSuccess={() => { setZoneFixGateOpen(false); setZonePickerOpen(true); }}
          onSetPin={handleSetPin}
          onCancel={() => setZoneFixGateOpen(false)}
        />
      )}
      {zonePickerOpen && current && (
        <ZonePickerSheet
          zones={effectiveZones}
          currentZoneId={current.zoneId}
          title={`Место для «${current.product}»`}
          onSelect={handleZoneFixSelect}
          onClose={() => setZonePickerOpen(false)}
        />
      )}
    </div>
  );
}
