import { customDataToSteps } from './plannerShoppingUtils.js';
import { getZoneForProduct, ZONES } from './putawayLocations.js';

function sName(step) { return step.text.replace(/:$/, '').trim(); }
function planKey(name, ii) { return `${name}_${ii}`; }

// Builds the ordered list of bought-but-not-yet-placed items for the
// putaway screen. `bought` and `placed` are both { [planKey]: truthy } maps.
export function buildPutawayQueue(customData, bought, placed) {
  const steps = customDataToSteps(customData);
  const queue = [];
  for (const step of steps) {
    const category = sName(step);
    (step.items ?? []).forEach((product, ii) => {
      const key = planKey(category, ii);
      if (!bought[key] || placed[key]) return;
      const zoneId = getZoneForProduct(category, product);
      if (!zoneId) return;
      queue.push({ key, category, product, zoneId });
    });
  }
  return queue;
}

// Unique zone ids that actually occur in this session's putawayPlan, in the
// same deterministic order as ZONES — used to drive both the putaway-photo
// gate (PlannerPutawayScreen) and the hub's putawayDone check (HomeScreen).
export function getRequiredZones(putawayPlan) {
  const used = new Set(Object.values(putawayPlan ?? {}));
  return ZONES.map((z) => z.id).filter((id) => used.has(id));
}
