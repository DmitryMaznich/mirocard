export const FINISH = 19;
export const TUG_FINISH = 15;

export function createRace(finish = FINISH, capacity = finish, deferResult = false, firstToFinish = false) {
  return { finish, capacity, deferResult, firstToFinish, positions: [0, 0], dice: [null, null], round: 1, phase: "rolling", answer: null, mistake: false, step: 0, result: null };
}

export function createTugOfWar() {
  return { ...createRace(TUG_FINISH), ropePosition: 0, pullScores: [0, 0] };
}

export function tugPullDirection(dice, stepsDone) {
  const strongerDirection = Math.sign(dice[1] - dice[0]);
  return stepsDone < Math.min(...dice) ? -strongerDirection : strongerDirection;
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
    ? createTugOfWar()
    : createRace(state.finish, state.capacity, state.deferResult, state.firstToFinish);
  if (action.type === "nextThrow" && state.phase === "between") return { ...state, phase: "rolling", dice: [null, null], answer: null, mistake: false };
  if (action.type === "ready" && state.phase === "rolling") return { ...state, phase: "settling" };
  if (action.type === "settled" && state.phase === "settling") return { ...state, phase: "input" };
  if (action.type === "arrived" && state.phase === "arriving") {
    if (isTug) return { ...state, phase: "comparing" };
    if (state.result) return { ...state, phase: "finished" };
    return { ...state, round: state.round + 1, phase: "between" };
  }
  if (action.type === "dice" && state.phase === "input") {
    if (![0, 1].includes(action.player) || !Number.isInteger(action.value) || action.value < 1 || action.value > 6) return state;
    const dice = [...state.dice];
    dice[action.player] = action.value;
    if (isTug && comparisonAnswer(dice) !== null) {
      return { ...state, dice, answer: null, mistake: false, phase: "moving", step: 0 };
    }
    return { ...state, dice, answer: null, mistake: false };
  }
  if (action.type === "compare" && isTug && state.phase === "comparing") {
    if (!["child", "adult", "equal"].includes(action.answer)) return state;
    const correct = action.answer === comparePlayerValues(state.pullScores);
    const next = { ...state, answer: action.answer, mistake: !correct };
    if (!correct) return next;
    if (state.result) return { ...next, phase: "finished" };
    return { ...next, round: state.round + 1, phase: "between" };
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
    const direction = tugPullDirection(state.dice, state.step);
    const ropePosition = state.ropePosition + direction;
    const [childScore, adultScore] = state.pullScores;
    const pullScores = [childScore + Math.max(0, -direction), adultScore + Math.max(0, direction)];
    const complete = direction === 0 || step >= state.dice[0] + state.dice[1];
    const result = complete && Math.abs(ropePosition) >= TUG_FINISH
      ? (ropePosition < 0 ? "child" : "adult")
      : null;
    return { ...state, ropePosition, pullScores, step, result, phase: complete ? "arriving" : "moving" };
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
