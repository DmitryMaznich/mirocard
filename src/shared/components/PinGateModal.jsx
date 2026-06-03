import { useState } from "react";
import { hashPin, verifyPin } from "@/shared/utils/pinHash";
import "./PinGateModal.css";

export default function PinGateModal({ pinHash, onSuccess, onSetPin }) {
  const isSetup = pinHash === null;

  const [stage,       setStage]       = useState("enter"); // "enter" | "confirm"
  const [digits,      setDigits]      = useState([]);
  const [firstDigits, setFirstDigits] = useState([]);
  const [shake,       setShake]       = useState(false);
  const [error,       setError]       = useState("");

  function triggerShake(msg) {
    setError(msg);
    setShake(true);
    setDigits([]);
    setTimeout(() => setShake(false), 500);
  }

  async function handleFourDigits(finalDigits) {
    const pin = finalDigits.join("");

    if (isSetup) {
      if (stage === "enter") {
        setFirstDigits(finalDigits);
        setStage("confirm");
        setDigits([]);
        setError("");
      } else {
        if (pin === firstDigits.join("")) {
          const hash = await hashPin(pin);
          onSetPin(hash);
          onSuccess();
        } else {
          triggerShake("PIN не совпадает. Начните заново.");
          setStage("enter");
          setFirstDigits([]);
        }
      }
    } else {
      const ok = await verifyPin(pin, pinHash);
      if (ok) {
        onSuccess();
      } else {
        triggerShake("Неверный PIN");
      }
    }
  }

  function pressDigit(d) {
    if (digits.length >= 4) return;
    setError("");
    const next = [...digits, d];
    setDigits(next);
    if (next.length === 4) {
      handleFourDigits(next);
    }
  }

  function pressBackspace() {
    setDigits((d) => d.slice(0, -1));
  }

  const title = isSetup
    ? (stage === "enter" ? "Придумайте PIN-код" : "Повторите PIN-код")
    : "Введите PIN-код";

  return (
    <div className="pin-gate-overlay">
      <div className="pin-gate">
        <div className="pin-gate__title">{title}</div>

        <div className={`pin-gate__dots${shake ? " pin-gate__dots--shake" : ""}`}>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={`pin-dot${digits.length > i ? " pin-dot--filled" : ""}`} />
          ))}
        </div>

        <div className="pin-gate__error">{error}</div>

        <div className="pin-pad">
          {["1","2","3","4","5","6","7","8","9"].map((d) => (
            <button key={d} className="pin-key" onClick={() => pressDigit(d)}>{d}</button>
          ))}
          <button className="pin-key pin-key--empty" tabIndex={-1} />
          <button className="pin-key" onClick={() => pressDigit("0")}>0</button>
          <button className="pin-key pin-key--back" onClick={pressBackspace}>⌫</button>
        </div>
      </div>
    </div>
  );
}
