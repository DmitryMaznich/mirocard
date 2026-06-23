import { useState, useEffect, useCallback, useRef } from "react";

// ─── Pure logic (exported for tests) ──────────────────────────────────────────

export function resolveNextTurnIndex(turns, currentIndex, chosenNext) {
  if (chosenNext) {
    const idx = turns.findIndex((t) => t.id === chosenNext);
    return idx >= 0 ? idx : currentIndex + 1;
  }
  return currentIndex + 1;
}

export function applyChoice(state, choice, turns) {
  const currentTurn  = turns[state.turnIndex];
  const isAnyCorrect = currentTurn.anyIsCorrect === true;
  const isCorrect    = isAnyCorrect || choice.correct === true;

  if (!isCorrect) {
    return {
      ...state,
      score: { ...state.score, total: state.score.total + 1 },
      disabledChoices: new Set([...state.disabledChoices, choice.text]),
      showHint: true,
      isAdvancing: false,
    };
  }

  const nextIdx = resolveNextTurnIndex(turns, state.turnIndex, choice.next);
  return {
    ...state,
    score: { correct: state.score.correct + 1, total: state.score.total + 1 },
    disabledChoices: new Set(),
    showHint: false,
    turnIndex: nextIdx,
    isAdvancing: true,
    isComplete: nextIdx >= turns.length,
    pendingReaction: isAnyCorrect
      ? (currentTurn.reactionOnSend ?? null)
      : (currentTurn.reactionOnCorrect ?? null),
    lastChoiceText: choice.text,
  };
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useConversation(script) {
  const turns   = script?.turns ?? [];
  const contact = script?.contact ?? null;

  const [messages, setMessages]               = useState([]);
  const [turnIndex, setTurnIndex]             = useState(0);
  const [isTyping, setIsTyping]               = useState(true);
  const [isComplete, setIsComplete]           = useState(false);
  const [score, setScore]                     = useState({ correct: 0, total: 0 });
  const [disabledChoices, setDisabledChoices] = useState(new Set());
  const [showHint, setShowHint]               = useState(false);
  const [awaitingChoice, setAwaitingChoice]   = useState(false);
  const timerRef = useRef(null);

  const addMsg = useCallback((msg) => {
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), timestamp: new Date(), ...msg },
    ]);
  }, []);

  // Start contact typing whenever turn advances
  useEffect(() => {
    if (isComplete || turns.length === 0) return;
    const turn = turns[turnIndex];
    if (!turn) return;

    setIsTyping(true);
    setAwaitingChoice(false);
    timerRef.current = setTimeout(() => {
      addMsg({ from: "contact", text: turn.text });
      setIsTyping(false);
      setAwaitingChoice(true);
    }, 850);

    return () => clearTimeout(timerRef.current);
  }, [turnIndex, isComplete]); // eslint-disable-line react-hooks/exhaustive-deps

  const sendChoice = useCallback((choice) => {
    if (!awaitingChoice) return;
    const turn = turns[turnIndex];
    if (!turn) return;

    const logicState = { turnIndex, score, disabledChoices, showHint };
    const next = applyChoice(logicState, choice, turns);

    setScore(next.score);

    if (!next.isAdvancing) {
      setDisabledChoices(next.disabledChoices);
      setShowHint(true);
      return;
    }

    addMsg({ from: "child", text: next.lastChoiceText, isCorrect: true });
    setDisabledChoices(new Set());
    setShowHint(false);
    setAwaitingChoice(false);

    const afterReaction = () => {
      if (next.isComplete) {
        setIsComplete(true);
      } else {
        setTurnIndex(next.turnIndex);
      }
    };

    if (next.pendingReaction) {
      setIsTyping(true);
      timerRef.current = setTimeout(() => {
        addMsg({ from: "contact", text: next.pendingReaction });
        setIsTyping(false);
        timerRef.current = setTimeout(afterReaction, 500);
      }, 850);
    } else {
      timerRef.current = setTimeout(afterReaction, 400);
    }
  }, [awaitingChoice, turnIndex, score, disabledChoices, showHint, turns, addMsg]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const currentTurn    = turns[turnIndex] ?? null;
  const currentChoices = awaitingChoice ? (currentTurn?.choices ?? null) : null;

  return {
    messages,
    currentChoices,
    isTyping,
    sendChoice,
    isComplete,
    score,
    disabledChoices,
    showHint,
    contact,
  };
}
