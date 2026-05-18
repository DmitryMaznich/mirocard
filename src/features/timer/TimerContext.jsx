/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState } from "react";

const TimerContext = createContext(null);

export function TimerProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isRunning, setIsRunning] = useState(false);

  return (
    <TimerContext.Provider value={{ isOpen, setIsOpen, timeLeft, setTimeLeft, isRunning, setIsRunning }}>
      {children}
    </TimerContext.Provider>
  );
}

export function useTimer() {
  return useContext(TimerContext);
}
