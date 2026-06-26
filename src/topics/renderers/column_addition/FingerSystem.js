export const FINGER_MAP = {
  0:  { right: 0, left: 0 },
  1:  { right: 1, left: 0 },
  2:  { right: 1, left: 1 },
  3:  { right: 2, left: 1 },
  4:  { right: 2, left: 2 },
  5:  { right: 3, left: 2 },
  6:  { right: 3, left: 3 },
  7:  { right: 4, left: 3 },
  8:  { right: 4, left: 4 },
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
