/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useRef, useEffect } from "react";

const TimerContext = createContext(null);

export function TimerProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [configMinutes, setConfigMinutes] = useState(0);
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [timerSuggested, setTimerSuggested] = useState(false);
  const [pendingLabel, setPendingLabel] = useState(null);
  const [activeLabel, setActiveLabel] = useState(null);
  const sessionStart = useRef(null);

  function requestTimer(label) {
    setPendingLabel(label);
    setTimerSuggested(true);
  }

  function acknowledgeTimerSuggestion() {
    setTimerSuggested(false);
  }

  useEffect(() => {
    const id = setInterval(() => {
      if (sessionStart.current !== null) {
        setSessionSeconds(Math.floor((Date.now() - sessionStart.current) / 1000));
      }
    }, 1000);
    return () => clearInterval(id);
  }, []);

  function markSessionStart() {
    if (sessionStart.current === null) {
      sessionStart.current = Date.now();
    }
  }

  function resetSession() {
    sessionStart.current = null;
    setSessionSeconds(0);
    setTimerSuggested(false);
    setPendingLabel(null);
  }

  return (
    <TimerContext.Provider value={{
      isOpen, setIsOpen,
      timeLeft, setTimeLeft,
      isRunning, setIsRunning,
      configMinutes, setConfigMinutes,
      sessionSeconds,
      timerSuggested, pendingLabel, requestTimer, acknowledgeTimerSuggestion,
      activeLabel, setActiveLabel,
      markSessionStart,
      resetSession,
    }}>
      {children}
    </TimerContext.Provider>
  );
}

export function useTimer() {
  return useContext(TimerContext);
}
