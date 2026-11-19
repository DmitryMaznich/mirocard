export const FINISH = 19;
// A boundary, not a throw limit. Even the largest dice difference needs
// another turn to win from the centre.
export const TUG_MAX_DISTANCE = 6;

export function createRace(finish = FINISH, capacity = finish, deferResult = false, firstToFinish = false) {
  return { finish, capacity, deferResult, firstToFinish, positions: [0, 0], dice: [null, null], round: 1, phase: "rolling", answer: null, mistake: false, step: 0, result: null };
}

export function createTugOfWar(countMoves = false) {
  return { ...createRace(), ropePosition: 0, completedRounds: 0, countMoves, countAnswer: null };
}

export function tugPullDirection(dice) {
  return Math.sign(dice[1] - dice[0]);
}

export function tugDistance(dice) {
  return Math.abs(dice[0] - dice[1]);
}

export function comparisonAnswer(dice) {
  if (!dice.every(n => Number.isInteger(n) && n >= 1 && n <= 6)) return null;
  return comparePlayerValues(dice);
}

function comparePlayerValues([child, adult]) {
  return child === adult ? "equal" : child > adult ? "child" : "adult";
}

export function raceReducer(state, action) {
  const isTug = state.ropePosition !== undefined;
  if (action.type === "reset") return isTug
    ? createTugOfWar(state.countMoves)
    : createRace(state.finish, state.capacity, state.deferResult, state.firstToFinish);
  if (action.type === "configureTug" && isTug && state.phase === "rolling" && state.completedRounds === 0) return { ...state, countMoves: Boolean(action.countMoves) };
  if (action.type === "nextThrow" && state.phase === "between") return { ...state, round: state.round + (isTug ? 1 : 0), phase: "rolling", dice: [null, null], answer: null, mistake: false, ...(isTug ? {countAnswer: null} : {}) };
  if (action.type === "paired" && isTug && state.phase === "pairing") return {...state,phase:tugDistance(state.dice) ? "moving" : "arriving"};
  if (action.type === "ready" && state.phase === "rolling") return { ...state, phase: "settling" };
  if (action.type === "settled" && state.phase === "settling") return { ...state, phase: "input" };
  if (action.type === "arrived" && state.phase === "arriving") {
    if (isTug) {
      const completedRounds = state.completedRounds + 1;
      const result = Math.abs(state.ropePosition) >= TUG_MAX_DISTANCE
        ? state.ropePosition < 0 ? "child" : "adult" : null;
      return {...state,completedRounds,result,phase:result ? "finished" : "between"};
    }
    if (state.result) return { ...state, phase: "finished" };
    return { ...state, round: state.round + 1, phase: "between" };
  }
  if (action.type === "dice" && state.phase === "input") {
    if (![0, 1].includes(action.player) || !Number.isInteger(action.value) || action.value < 1 || action.value > 6) return state;
    const dice = [...state.dice];
    dice[action.player] = action.value;
    return { ...state, dice, answer: null, mistake: false };
  }
  if (action.type === "count" && isTug && state.phase === "counting") {
    if (!Number.isInteger(action.answer) || action.answer < 1 || action.answer > 5) return state;
    const correct = action.answer === tugDistance(state.dice);
    return {...state,countAnswer:action.answer,mistake:!correct,phase:correct ? "pairing" : "counting"};
  }
  if (action.type === "compare" && isTug && state.phase === "input") {
    const answer = comparisonAnswer(state.dice);
    if (!answer || !["child", "adult", "equal"].includes(action.answer)) return state;
    const correct = action.answer === answer;
    return {...state,answer:action.answer,mistake:!correct,step:0,
      phase:correct ? state.countMoves && tugDistance(state.dice) ? "counting" : "pairing" : "input"};
  }
  if (action.type === "compare" && !isTug && state.phase === "input") {
    const answer = comparisonAnswer(state.dice);
    if (!answer || !["child", "adult", "equal"].includes(action.answer)) return state;
    const correct = action.answer === answer;
    return { ...state, answer: action.answer, mistake: !correct, phase: correct ? "moving" : "input", step: 0 };
  }
  if (action.type !== "tick" || state.phase !== "moving") return state;
  const step = state.step + 1;
  if (isTug) {
    const ropePosition = Math.max(-TUG_MAX_DISTANCE, Math.min(TUG_MAX_DISTANCE, state.ropePosition + tugPullDirection(state.dice)));
    return {...state,ropePosition,step,phase:Math.abs(ropePosition) >= TUG_MAX_DISTANCE || step >= tugDistance(state.dice) ? "arriving" : "moving"};
  }
  const finish = state.finish ?? FINISH;
  const capacity = state.capacity ?? finish;
  const positions = state.positions.map((position, i) => Math.min(capacity, position + (step <= state.dice[i] ? 1 : 0)));
  // Water stops at the first overflow; cars and buildings resolve the whole round.
  if (state.firstToFinish && positions.some(position=>position>=finish)) {
    const result=positions.every(position=>position>=finish) ? "tie" : positions[0]>=finish ? "child" : "adult";
    return {...state,positions,step,result,phase:state.deferResult ? "arriving" : "finished"};
  }
  if (positions.every((position,i) => step >= state.dice[i] || position >= capacity)) {
    const childFinished = positions[0] >= finish;
    const adultFinished = positions[1] >= finish;
    if (childFinished || adultFinished) {
      return { ...state, positions, step, phase: state.deferResult ? "arriving" : "finished", result: childFinished && adultFinished ? "tie" : childFinished ? "child" : "adult" };
    }
    // Let the final CSS step finish before offering the next throw.
    return { ...state, positions, step, phase: "arriving" };
  }
  return { ...state, positions, step };
}
