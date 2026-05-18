/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useRef, useEffect } from "react";

const TimerContext = createContext(null);

export function TimerProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [configMinutes, setConfigMinutes] = useState(0);
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const sessionStart = useRef(Date.now());

  useEffect(() => {
    const id = setInterval(() => {
      setSessionSeconds(Math.floor((Date.now() - sessionStart.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <TimerContext.Provider value={{
      isOpen, setIsOpen,
      timeLeft, setTimeLeft,
      isRunning, setIsRunning,
      configMinutes, setConfigMinutes,
      sessionSeconds,
    }}>
      {children}
    </TimerContext.Provider>
  );
}

export function useTimer() {
  return useContext(TimerContext);
}
