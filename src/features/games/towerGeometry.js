export const MAX_FLOORS = 20;
export const SCENE = { width: 1200, height: 540, ground: 480, floorHeight: 16, towerWidth: 124, jibY: 42, cableTop: 58, slingHeight: 20, clearance: 24 };
export const BUILD_STEP_MS = 1500;
export const TOWER_CENTERS = [380, 820];
export const floorY = floor => SCENE.ground - floor * SCENE.floorHeight;
export const balconySide = floor => floor % 2 ? null : floor % 4 === 2 ? "left" : "right";
const lerp = (a,b,t) => a + (b-a) * t;
const ease = t => t * t * (3 - 2 * t);

// All coordinates, including the last-floor clearance, use the same SVG scale.
export function constructionPose(floor, progress, player) {
  const p = Math.max(0, Math.min(1, progress));
  const pickupX = player === 0 ? 230 : 970;
  const targetX = TOWER_CENTERS[player];
  const targetY = floorY(floor);
  const pickupY = floorY(1);
  const liftY = targetY - SCENE.clearance;
  let moduleX = pickupX, moduleY;
  if (p < .18) moduleY = lerp(pickupY, liftY, ease(p / .18));
  else if (p < .42) { moduleX = lerp(pickupX, targetX, ease((p-.18)/.24)); moduleY = liftY; }
  else if (p < .66) { moduleX = targetX; moduleY = lerp(liftY, targetY, ease((p-.42)/.24)); }
  else { moduleX = targetX; moduleY = targetY; }
  let hookX = moduleX, hookY = moduleY - SCENE.slingHeight;
  if (p >= .66 && p < .76) hookY = lerp(targetY, liftY, ease((p-.66)/.1)) - SCENE.slingHeight;
  else if (p >= .76 && p < .9) { hookX = lerp(targetX, pickupX, ease((p-.76)/.14)); hookY = liftY - SCENE.slingHeight; }
  else if (p >= .9) { hookX = pickupX; hookY = lerp(liftY, pickupY, ease((p-.9)/.1)) - SCENE.slingHeight; }
  return { moduleX, moduleY, hookX, hookY, attached: p < .66, landed: p >= .66 };
}
