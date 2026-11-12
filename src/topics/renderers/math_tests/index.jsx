import "./math_tests.css";
import { useCallback, useEffect, useRef, useState } from "react";
import Home from "./Home";
import Editor from "./Editor";
import SolveView from "./SolveView";
import { loadTests, loadLocalTests, saveTest, deleteTest, newTest, testFromLibrary, normalizeTest } from "./store.js";
import { newId, newSeed } from "./blocks.js";

const HISTORY_MAX = 80;
const TYPING_MERGE_MS = 1200;

// «Контрольные по математике» (math_tests): a full screen of its own, like «Печатные буквы»
// (App's ParamsRoute → PrintLettersScreen, which passes accountKv). Home («Мои контрольные» and
// «Готовые листы») → the editor (blocks on a notebook sheet) → «Решать на экране» (keypad, check
// all at once, video prize). Every change is saved at once (device + account); undo/redo live in
// the editor session. Docs: docs/math-tests.md.
// Two modes (deck 0.2.0): `task.type` "math_tests_constructor" — the constructor (home → editor →
// «Решать на экране»); "math_tests_solve" — «Решить контрольную»: the list of tests, a tap opens one
// straight for solving, no editor. Every «Проверить» is reported to the host as a lesson
// (`onSessionResult`, PrintLettersScreen → the student's history and «Продолжить» on the home screen).
export default function MathTestsRenderer({ task, accountKv, onBack, onSessionResult }) {
  const solving = task?.type === "math_tests_solve";
  const solveStartedAt = useRef(null);
  const [tests, setTests] = useState(() => loadLocalTests().filter((t) => !t.deleted).map(normalizeTest).sort((a, b) => b.updatedAt - a.updatedAt));
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState("home"); // home | edit | solve
  const [test, setTest] = useState(null);
  const history = useRef({ past: [], future: [], lastTyping: 0 });
  const [, bump] = useState(0);
  const saveTimer = useRef(null);

  useEffect(() => {
    let alive = true;
    loadTests(accountKv).then((list) => { if (alive) { setTests(list); setLoading(false); } });
    return () => { alive = false; };
  }, [accountKv]);

  const persist = useCallback((t) => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const saved = saveTest(t, accountKv);
      setTests((list) => [saved, ...list.filter((x) => x.id !== saved.id)]);
    }, 400);
  }, [accountKv]);
  useEffect(() => () => clearTimeout(saveTimer.current), []);

  function openTest(t, startScreen = "edit") {
    history.current = { past: [], future: [], lastTyping: 0 };
    solveStartedAt.current = Date.now();
    setTest(t);
    setScreen(startScreen);
  }
  function create(t) {
    const saved = saveTest(t, accountKv);
    setTests((list) => [saved, ...list]);
    openTest(saved);
  }

  const change = useCallback((updater, { typing = false } = {}) => {
    setTest((prev) => {
      const next = normalizeTest(updater(prev));
      const h = history.current;
      const now = Date.now();
      if (!(typing && now - h.lastTyping < TYPING_MERGE_MS)) {
        h.past.push(prev);
        if (h.past.length > HISTORY_MAX) h.past.shift();
      }
      h.lastTyping = typing ? now : 0;
      h.future = [];
      persist(next);
      return next;
    });
    bump((n) => n + 1);
  }, [persist]);
  const undo = () => {
    const h = history.current;
    if (!h.past.length) return;
    setTest((cur) => { h.future.push(cur); const prev = h.past.pop(); persist(prev); return prev; });
    bump((n) => n + 1);
  };
  const redo = () => {
    const h = history.current;
    if (!h.future.length) return;
    setTest((cur) => { h.past.push(cur); const next = h.future.pop(); persist(next); return next; });
    bump((n) => n + 1);
  };

  useEffect(() => {
    if (screen !== "edit") return undefined;
    const onKey = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.target instanceof HTMLElement && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
      if (e.key.toLowerCase() === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      else if (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey)) { e.preventDefault(); redo(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (screen === "solve" && test) {
    return (
      <SolveView
        test={test}
        onBack={() => { if (solving) { setScreen("home"); setTest(null); } else setScreen("edit"); }}
        onResult={(r) => {
          onSessionResult?.({ ...r, startedAt: solveStartedAt.current ?? r.at, testId: test.id, testTitle: test.title });
          solveStartedAt.current = Date.now();
          // a ready sheet solved in «Решить контрольную» is not one of «Мои контрольные»: nothing to save
          if (!tests.some((x) => x.id === test.id)) return;
          const next = { ...test, lastResult: r };
          setTest(next);
          const saved = saveTest(next, accountKv);
          setTests((list) => [saved, ...list.filter((x) => x.id !== saved.id)]);
        }}
      />
    );
  }
  if (screen === "edit" && test) {
    return (
      <Editor
        test={test}
        onChange={change}
        onUndo={undo}
        onRedo={redo}
        canUndo={history.current.past.length > 0}
        canRedo={history.current.future.length > 0}
        onBack={() => { setScreen("home"); setTest(null); }}
        onSolve={() => { solveStartedAt.current = Date.now(); setScreen("solve"); }}
      />
    );
  }
  return (
    <Home
      tests={tests}
      loading={loading}
      solving={solving}
      onBack={onBack}
      onNew={() => create(newTest())}
      onOpen={(t) => openTest(t, solving ? "solve" : "edit")}
      onFromLibrary={(entry) => (solving ? openTest(testFromLibrary(entry), "solve") : create(testFromLibrary(entry)))}
      onDuplicate={(t) => {
        const copy = normalizeTest({ ...t, id: newId("t"), title: `${t.title} (копия)`, blocks: t.blocks.map((b) => ({ ...b, id: newId(), seed: newSeed() })), lastResult: null, updatedAt: Date.now() });
        const saved = saveTest(copy, accountKv);
        setTests((list) => [saved, ...list]);
      }}
      onDelete={(t) => { deleteTest(t.id, accountKv); setTests((list) => list.filter((x) => x.id !== t.id)); }}
    />
  );
}
