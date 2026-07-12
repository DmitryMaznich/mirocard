/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useRef, useEffect } from "react";

const TimerContext = createContext(null);

export function TimerProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [configMinutes, setConfigMinutes] = useState(0);
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [timerRequest, setTimerRequest] = useState(null);
  const sessionStart = useRef(null);

  function requestTimer(minutes) {
    setTimerRequest({ minutes, nonce: Date.now() + Math.random() });
    setIsOpen(true);
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
  }

  return (
    <TimerContext.Provider value={{
      isOpen, setIsOpen,
      timeLeft, setTimeLeft,
      isRunning, setIsRunning,
      configMinutes, setConfigMinutes,
      sessionSeconds,
      timerRequest, requestTimer,
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
