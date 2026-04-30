function parse(version) {
  const [major = 0, minor = 0, patch = 0] = String(version).split(".").map(Number);
  return { major, minor, patch };
}

function compare(a, b) {
  const pa = parse(a);
  const pb = parse(b);
  if (pa.major !== pb.major) return pa.major < pb.major ? -1 : 1;
  if (pa.minor !== pb.minor) return pa.minor < pb.minor ? -1 : 1;
  if (pa.patch !== pb.patch) return pa.patch < pb.patch ? -1 : 1;
  return 0;
}

export const semver = {
  lt:  (a, b) => compare(a, b) < 0,
  lte: (a, b) => compare(a, b) <= 0,
  gt:  (a, b) => compare(a, b) > 0,
  gte: (a, b) => compare(a, b) >= 0,
  eq:  (a, b) => compare(a, b) === 0,
};
