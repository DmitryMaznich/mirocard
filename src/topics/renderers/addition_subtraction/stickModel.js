export const STICK_GAP_SLOTS = 2;
export const STICK_DRAG_THRESHOLD = 10;

function toPositiveInt(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getOperation(task) {
  return task.operation === "subtract" ? "subtract" : "add";
}

export function getStickBeadCount(task) {
  const rawCount = toPositiveInt(task.railSize ?? task.maxNumber, 20);
  return rawCount <= 10 ? 10 : 20;
}

export function getStickDimensions(task) {
  const beadCount = getStickBeadCount(task);
  const gapSlots = STICK_GAP_SLOTS;

  return {
    beadCount,
    gapSlots,
    totalSlots: beadCount + gapSlots,
  };
}

export function getStickSideCount(task, workCount) {
  const beadCount = getStickBeadCount(task);
  return clamp(beadCount - workCount, 0, beadCount);
}

export function isStickComplete(task, workCount) {
  return workCount === task.result;
}

export function buildStickSlots(task, workCount = task.start) {
  const dimensions = getStickDimensions(task);
  const safeWorkCount = clamp(workCount, 0, dimensions.beadCount);
  const sideCount = dimensions.beadCount - safeWorkCount;
  const slots = [];

  for (let index = 0; index < safeWorkCount; index += 1) {
    slots.push({
      id: `work-${index}`,
      zone: "work",
      zoneIndex: index,
      globalIndex: slots.length,
      beadIndex: index,
      occupied: true,
    });
  }

  for (let index = 0; index < dimensions.gapSlots; index += 1) {
    slots.push({
      id: `gap-${index}`,
      zone: "gap",
      zoneIndex: index,
      globalIndex: slots.length,
      beadIndex: null,
      occupied: false,
    });
  }

  for (let index = 0; index < sideCount; index += 1) {
    slots.push({
      id: `side-${index}`,
      zone: "side",
      zoneIndex: index,
      globalIndex: slots.length,
      beadIndex: safeWorkCount + index,
      occupied: true,
    });
  }

  return slots;
}

export function getStickSlotIndexAtClientX(clientX, rect, totalSlots) {
  if (!rect || !Number.isFinite(rect.width) || rect.width <= 0 || totalSlots <= 0) {
    return null;
  }

  const slotWidth = rect.width / totalSlots;
  const localX = clamp(clientX - rect.left, 0, Math.max(0, rect.width - 0.001));

  return clamp(Math.floor(localX / slotWidth), 0, totalSlots - 1);
}

export function getStickSlotAtClientX(clientX, rect, slots) {
  const index = getStickSlotIndexAtClientX(clientX, rect, slots.length);
  return index == null ? null : slots[index];
}

export function getStickBeadColor(task, beadIndex) {
  const beadCount = getStickBeadCount(task);
  if (beadCount <= 10) return "green";
  return beadIndex < 10 ? "green" : "orange";
}

function noop(reason = "noop") {
  return { kind: "noop", reason };
}

function mistake(reason) {
  return { kind: "mistake", reason };
}

function move(task, nextWorkCount, movedCount) {
  return {
    kind: "move",
    nextWorkCount,
    movedCount,
    complete: isStickComplete(task, nextWorkCount),
  };
}

function getMovedCount(sourceSlot, originWorkCount) {
  if (sourceSlot.zone === "side") {
    return sourceSlot.zoneIndex + 1;
  }
  if (sourceSlot.zone === "work") {
    return originWorkCount - sourceSlot.zoneIndex;
  }
  return 0;
}

export function evaluateStickMove(task, originWorkCount, sourceSlot, deltaX = 0, threshold = STICK_DRAG_THRESHOLD) {
  if (!sourceSlot || sourceSlot.zone === "gap") {
    return noop("missing-slot");
  }

  if (Math.abs(deltaX) < threshold) {
    return noop("tap");
  }

  const operation = getOperation(task);
  const direction = deltaX < 0 ? "left" : "right";
  const correctDirection = operation === "add" ? "left" : "right";

  if (direction !== correctDirection) {
    return mistake("wrong-direction");
  }

  if (operation === "add") {
    if (sourceSlot.zone !== "side") {
      return noop("already-in-work-zone");
    }

    const movedCount = getMovedCount(sourceSlot, originWorkCount);
    const nextWorkCount = originWorkCount + movedCount;

    if (nextWorkCount > task.result) {
      return mistake("overshoot");
    }

    return move(task, nextWorkCount, movedCount);
  }

  if (sourceSlot.zone !== "work") {
    return noop("already-outside-work-zone");
  }

  const movedCount = getMovedCount(sourceSlot, originWorkCount);
  const nextWorkCount = originWorkCount - movedCount;

  if (nextWorkCount < task.result) {
    return mistake("overshoot");
  }

  return move(task, nextWorkCount, movedCount);
}
