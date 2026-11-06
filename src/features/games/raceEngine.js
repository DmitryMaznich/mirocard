export const FINISH = 19;

export function createRace() {
  return { positions: [0, 0], dice: [null, null], round: 1, phase: "input", answer: null, mistake: false, step: 0, result: null };
}

export function comparisonAnswer(dice) {
  if (!dice.every(n => Number.isInteger(n) && n >= 1 && n <= 6)) return null;
  return dice[0] === dice[1] ? "equal" : dice[0] > dice[1] ? "child" : "adult";
}

export function raceReducer(state, action) {
  if (action.type === "reset") return createRace();
  if (action.type === "dice" && state.phase === "input") {
    if (![0, 1].includes(action.player) || !Number.isInteger(action.value) || action.value < 1 || action.value > 6) return state;
    const dice = [...state.dice];
    dice[action.player] = action.value;
    return { ...state, dice, answer: null, mistake: false };
  }
  if (action.type === "compare" && state.phase === "input") {
    const answer = comparisonAnswer(state.dice);
    if (!answer || !["child", "adult", "equal"].includes(action.answer)) return state;
    const correct = action.answer === answer;
    return { ...state, answer: action.answer, mistake: !correct, phase: correct ? "moving" : "input", step: 0 };
  }
  if (action.type !== "tick" || state.phase !== "moving") return state;
  const step = state.step + 1;
  const positions = state.positions.map((position, i) => Math.min(FINISH, position + (step <= state.dice[i] ? 1 : 0)));
  // Resolve only after BOTH throws have been played, regardless of who crossed first.
  if (step >= Math.max(...state.dice)) {
    const childFinished = positions[0] >= FINISH;
    const adultFinished = positions[1] >= FINISH;
    if (childFinished || adultFinished) {
      return { ...state, positions, step, phase: "finished", result: childFinished && adultFinished ? "tie" : childFinished ? "child" : "adult" };
    }
    return { ...state, positions, step, round: state.round + 1, phase: "input", dice: [null, null], answer: null, mistake: false };
  }
  return { ...state, positions, step };
}
