// «Контрольные по математике»: the topic is a full screen of its own (index.jsx), so the engine only
// hands it one task saying which mode it opens in: the constructor («Конструктор контрольных») or
// «Решить контрольную» (the list of tests, a tap opens one for solving — no editor). The examples
// themselves are made per block (blocks.js).
export function generateTasks(mode) {
  return [{ type: mode?.type === "solve" ? "math_tests_solve" : "math_tests_constructor", id: "math_tests" }];
}
