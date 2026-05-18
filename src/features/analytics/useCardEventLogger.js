import { useCallback, useRef } from "react";
import { computeGuessingScore, qualityToGuessingScore } from "./computeGuessingScore.js";

export function useCardEventLogger() {
  const eventsRef = useRef([]);
  const currentRef = useRef(null); // { cardId, conceptId, shownAt, taps[] }

  const onCardShown = useCallback((cardId, conceptId) => {
    currentRef.current = { cardId, conceptId, shownAt: Date.now(), taps: [] };
  }, []);

  const onTap = useCallback((optionId, isCorrect) => {
    if (!currentRef.current) return;
    const ms = Date.now() - currentRef.current.shownAt;
    currentRef.current.taps.push({ optionId, isCorrect, ms });
    if (isCorrect) {
      const { cardId, conceptId, shownAt, taps } = currentRef.current;
      const firstCorrectMs = ms;
      const attemptCount = taps.length;
      eventsRef.current.push({
        cardId,
        conceptId,
        shownAt,
        taps,
        firstCorrectMs,
        attemptCount,
        guessingScore: computeGuessingScore(attemptCount, firstCorrectMs),
      });
      currentRef.current = null;
    }
  }, []);

  const onQuality = useCallback((quality, cardId, conceptId) => {
    const shownAt = currentRef.current?.shownAt ?? Date.now();
    const firstCorrectMs = Date.now() - shownAt;
    eventsRef.current.push({
      cardId,
      conceptId,
      shownAt,
      quality,
      firstCorrectMs,
      attemptCount: 1,
      guessingScore: qualityToGuessingScore(quality),
    });
    currentRef.current = null;
  }, []);

  const getCardEvents = useCallback(() => [...eventsRef.current], []);
  const resetCardEvents = useCallback(() => { eventsRef.current = []; }, []);

  return { onCardShown, onTap, onQuality, getCardEvents, resetCardEvents };
}
