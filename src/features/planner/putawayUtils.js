import { customDataToSteps, CATEGORY_ICONS } from './plannerShoppingUtils.js';
import { getZoneForProduct } from './putawayLocations.js';

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
      queue.push({ key, category, product, zoneId, categoryIcon: CATEGORY_ICONS[category] ?? '📦' });
    });
  }
  return queue;
}
