// «Контрольные по математике»: the whole topic is one full-screen constructor (index.jsx), so the
// engine only hands it a single task. The examples themselves are made per block (blocks.js).
export function generateTasks() {
  return [{ type: "math_tests_constructor", id: "math_tests" }];
}
