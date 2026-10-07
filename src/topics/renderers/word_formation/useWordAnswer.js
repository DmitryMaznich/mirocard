import { useRef, useState } from "react";

// Lock immediately, before the next React render: a double tap is one answer.
export function useWordAnswer(onCorrect, onIncorrect, conceptId, cardId) {
  const locked = useRef(false);
  const [answer, setAnswer] = useState(null);
  function select(option, index) {
    if (locked.current) return;
    locked.current = true;
    const status = option.isTarget ? "correct" : "wrong";
    setAnswer({ status, index });
    (option.isTarget ? onCorrect : onIncorrect)?.(conceptId, cardId);
  }
  return { answer, select };
}
