// 5-structure: fill the right hand first (1-5), then overflow to the left (6-10 = 5 + 1-5).
// This matches how people naturally count and makes subtraction within 1-5 a single-hand operation.
export const FINGER_MAP = {
  0:  { right: 0, left: 0 },
  1:  { right: 1, left: 0 },
  2:  { right: 2, left: 0 },
  3:  { right: 3, left: 0 },
  4:  { right: 4, left: 0 },
  5:  { right: 5, left: 0 },
  6:  { right: 5, left: 1 },
  7:  { right: 5, left: 2 },
  8:  { right: 5, left: 3 },
  9:  { right: 5, left: 4 },
  10: { right: 5, left: 5 },
};

export function getFingerConfig(n) {
  return FINGER_MAP[n] ?? { right: 0, left: 0 };
}

export function getRemoveMode(a, b) {
  const { right, left } = getFingerConfig(a);
  if (b === left)  return { removeMode: "hand", removeHand: "left" };
  if (b === right) return { removeMode: "hand", removeHand: "right" };
  return { removeMode: "fold" };
}
