import { useEffect, useState } from 'react';
import { useAppStore } from '@/core/store';
import { getPlannerShopCustomData, getPlannerShopBought, getPlannerPutawayPlan, savePlannerPutawayPlan } from '@/core/groupStore';
import { buildPutawayQueue, getRequiredZones } from './putawayUtils.js';
import { ZONES } from './putawayLocations.js';
import { getPendingZonePhotoIds, savePendingZonePhoto } from './plannerPhotos.js';
import PhotoCaptureCard from './PhotoCaptureCard.jsx';
import { BackArrowIcon } from '@/shared/components/ArrowIcons';
import './planner.css';

export default function PlannerPutawayScreen() {
  const setScreen = useAppStore((s) => s.setScreen);
  const studentId = useAppStore((s) => s.activeStudentId);

  const [loading, setLoading] = useState(true);
  const [queue, setQueue] = useState([]);
  const [putawayPlan, setPutawayPlan] = useState({});
  const [doneCount, setDoneCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [wrongZoneId, setWrongZoneId] = useState(null);
  const [photographedZones, setPhotographedZones] = useState([]);
  const [zonesLoaded, setZonesLoaded] = useState(false);

  useEffect(() => {
    if (!studentId) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      const [customData, bought, plan] = await Promise.all([
        getPlannerShopCustomData(studentId),
        getPlannerShopBought(studentId),
        getPlannerPutawayPlan(studentId),
      ]);
      if (cancelled) return;
      const safePlan = plan ?? {};
      const builtQueue = customData ? buildPutawayQueue(customData, bought ?? {}, safePlan) : [];
      setQueue(builtQueue);
      setPutawayPlan(safePlan);
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
    getPendingZonePhotoIds(studentId).then((ids) => {
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

  if (loading) return <div className="screen screen-center">Загрузка…</div>;

  return (
    <div className="screen planner-screen">
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
          </div>
        )
      ) : (
        <div className="putaway-body">
          <div className="putaway-progress">Продукт {doneCount + 1} из {totalCount}</div>

          <div className="putaway-card">
            <div className="putaway-card__icon">{current.categoryIcon}</div>
            <div className="putaway-card__name">{current.product}</div>
          </div>

          <div className="putaway-zones">
            {ZONES.map((zone) => (
              <button
                key={zone.id}
                className={`putaway-zone${wrongZoneId === zone.id ? ' putaway-zone--wrong' : ''}${wrongCount >= 2 && zone.id === current.zoneId ? ' putaway-zone--hint' : ''}`}
                onClick={() => handlePick(zone.id)}
              >
                <span className="putaway-zone__icon">{zone.icon}</span>
                <span className="putaway-zone__label">{zone.label}</span>
              </button>
            ))}
          </div>

          <div className="putaway-hint">
            {wrongCount >= 2 ? 'Вот сюда — попробуй эту зону' : wrongZoneId ? 'Не совсем — попробуй другое место' : ''}
          </div>

          <div className="putaway-dots">
            {Array.from({ length: totalCount }).map((_, i) => (
              <span key={i} className={`putaway-dot${i < doneCount ? ' putaway-dot--done' : ''}`} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
