import { useEffect, useRef, useState } from "react";
import { useTimer } from "./TimerContext";
import { makeYoutubeEmbedUrl } from "@/shared/utils/format";
import { normalizeRewardVideoIds, pickStoredRewardVideoId } from "@/shared/utils/rewardVideoPicker";

function analogTimerMinuteToPoint(min, radius) {
  const clockwiseDeg = ((360 - min * 6) % 360 + 360) % 360;
  const rad = (clockwiseDeg * Math.PI) / 180;
  return { x: 100 + radius * Math.sin(rad), y: 100 - radius * Math.cos(rad) };
}

function analogTimerClockwisePoint(step, radius) {
  const clockwiseDeg = ((step * 6) % 360 + 360) % 360;
  const rad = (clockwiseDeg * Math.PI) / 180;
  return { x: 100 + radius * Math.sin(rad), y: 100 - radius * Math.cos(rad) };
}

function analogTimerSectorPath(min) {
  if (min <= 0) return "";
  const start = analogTimerMinuteToPoint(0, 82);
  const end = analogTimerMinuteToPoint(min, 82);
  return `M 100,100 L ${start.x.toFixed(1)},${start.y.toFixed(1)} A 82,82 0 ${min > 30 ? 1 : 0} 0 ${end.x.toFixed(1)},${end.y.toFixed(1)} Z`;
}

function analogTimerPointerToMinutes(clientX, clientY, svgEl) {
  const rect = svgEl.getBoundingClientRect();
  const x = (clientX - rect.left) * (200 / rect.width);
  const y = (clientY - rect.top) * (200 / rect.height);
  let clockwiseDeg = (Math.atan2(x - 100, -(y - 100)) * 180) / Math.PI;
  if (clockwiseDeg < 0) clockwiseDeg += 360;
  const rawMinutes = (360 - clockwiseDeg) / 6;

  if (rawMinutes <= 0.25 || rawMinutes >= 59.75) {
    return 0;
  }

  return Math.max(1, Math.min(59, Math.round(rawMinutes)));
}

function formatClockDuration(totalSeconds) {
  const safeTotal = Math.max(0, Math.ceil(totalSeconds));
  const minutes = Math.floor(safeTotal / 60);
  const seconds = safeTotal % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function getMinuteLabel(value) {
  const safeValue = Math.max(0, Math.floor(value));
  const lastDigit = safeValue % 10;
  const lastTwoDigits = safeValue % 100;
  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return "минут";
  if (lastDigit === 1) return "минута";
  if (lastDigit >= 2 && lastDigit <= 4) return "минуты";
  return "минут";
}

function getSecondLabel(value) {
  const safeValue = Math.max(0, Math.floor(value));
  const lastDigit = safeValue % 10;
  const lastTwoDigits = safeValue % 100;
  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return "секунд";
  if (lastDigit === 1) return "секунда";
  if (lastDigit >= 2 && lastDigit <= 4) return "секунды";
  return "секунд";
}

export default function AnalogTimer({ rewardVideos = [], clockOnly = false }) {
  const { setIsOpen, setTimeLeft, setIsRunning, setConfigMinutes, timerRequest } = useTimer();
  const [setMinutes, setSetMinutes] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [running, setRunning] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [listenMode, setListenMode] = useState(false);
  const [sensitivity, setSensitivity] = useState(4);
  const [listenState, setListenState] = useState("idle");
  const [successVideoUrl, setSuccessVideoUrl] = useState(null);
  const [finished, setFinished] = useState(false);
  const [earningsOpen, setEarningsOpen] = useState(false);
  const [centerPressed, setCenterPressed] = useState(false);
  const [rewardTotalSeconds, setRewardTotalSeconds] = useState(0);
  const [rewardSecondsLeft, setRewardSecondsLeft] = useState(0);
  const [rewardPlaybackNonce, setRewardPlaybackNonce] = useState(0);

  const intervalRef = useRef(null);
  const audioCtxRef = useRef(null);
  const svgRef = useRef(null);
  const draggingRef = useRef(false);
  const soundEnabledRef = useRef(true);
  const micStreamRef = useRef(null);
  const micRafRef = useRef(null);
  const micAnalyserRef = useRef(null);
  const noiseStartedAtRef = useRef(0);
  const lastMinuteRef = useRef(0);
  const rewardIntervalRef = useRef(null);
  const normalizedRewardVideos = normalizeRewardVideoIds(rewardVideos);

  useEffect(() => { setTimeLeft(secondsLeft); }, [secondsLeft, setTimeLeft]);
  useEffect(() => { setIsRunning(running); }, [running, setIsRunning]);
  useEffect(() => { setConfigMinutes(setMinutes); }, [setMinutes, setConfigMinutes]);

  // A recipe step asked for a specific duration (parseTimerMinutesFromText).
  // Pre-fill the dial so the child only has to press play — but never
  // clobber a countdown that's already running.
  useEffect(() => {
    if (!timerRequest || running) return;
    hardReset();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing the dial to an external request from the recipe engine, not derived local state
    setSetMinutes(Math.max(1, Math.min(59, Math.round(timerRequest.minutes))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerRequest]);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  useEffect(() => () => {
    stopMicMonitor();
    clearAllIntervals();
  }, []);

  useEffect(() => {
    if (
      listenState !== "success" ||
      !successVideoUrl ||
      rewardSecondsLeft <= 0
    ) {
      if (rewardIntervalRef.current) {
        window.clearInterval(rewardIntervalRef.current);
        rewardIntervalRef.current = null;
      }
      return undefined;
    }

    rewardIntervalRef.current = window.setInterval(() => {
      setRewardSecondsLeft((prev) => {
        if (prev <= 1) {
          if (rewardIntervalRef.current) {
            window.clearInterval(rewardIntervalRef.current);
            rewardIntervalRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (rewardIntervalRef.current) {
        window.clearInterval(rewardIntervalRef.current);
        rewardIntervalRef.current = null;
      }
    };
  }, [listenState, successVideoUrl]);

  function clearAllIntervals() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (rewardIntervalRef.current) {
      clearInterval(rewardIntervalRef.current);
      rewardIntervalRef.current = null;
    }
  }

  function getAudioCtx() {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtxRef.current;
  }

  function playTick() {
    if (!soundEnabledRef.current) return;
    try {
      const ctx = getAudioCtx();
      const sampleRate = ctx.sampleRate;
      const bufLen = Math.ceil(sampleRate * 0.014);
      const buffer = ctx.createBuffer(1, bufLen, sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufLen; i += 1) data[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const bandPass = ctx.createBiquadFilter();
      bandPass.type = "bandpass";
      bandPass.frequency.value = 2800;
      bandPass.Q.value = 0.9;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.012);
      src.connect(bandPass);
      bandPass.connect(gain);
      gain.connect(ctx.destination);
      src.start();
    } catch {
      // Audio is optional here.
    }
  }

  function playBell() {
    if (!soundEnabledRef.current) return;
    try {
      const ctx = getAudioCtx();
      [800, 1000, 1200].forEach((freq, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.value = freq;
        const vol = 0.4 - index * 0.08;
        gain.gain.setValueAtTime(vol, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2.5);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 2.5);
      });
    } catch {
      // Audio is optional here.
    }
  }

  function playBuzzer() {
    try {
      const ctx = getAudioCtx();
      [0, 0.22].forEach((offset) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "square";
        osc.frequency.setValueAtTime(600, ctx.currentTime + offset);
        osc.frequency.linearRampToValueAtTime(150, ctx.currentTime + offset + 0.2);
        gain.gain.setValueAtTime(0.7, ctx.currentTime + offset);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.22);
        osc.start(ctx.currentTime + offset);
        osc.stop(ctx.currentTime + offset + 0.25);
      });
    } catch {
      // Audio is optional here.
    }
  }

  function stopMicMonitor() {
    if (micRafRef.current) {
      cancelAnimationFrame(micRafRef.current);
      micRafRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    }
    micAnalyserRef.current = null;
    noiseStartedAtRef.current = 0;
  }

  function stopTimerWithNoise() {
    clearAllIntervals();
    setRunning(false);
    setFinished(true);
    setSecondsLeft(0);
    playBuzzer();
    setListenState("triggered");
  }

  async function startMicMonitor(nextSensitivity) {
    const thresholds = [0, 0.24, 0.15, 0.095, 0.032, 0.024, 0.018, 0.012];
    const threshold = thresholds[nextSensitivity] ?? thresholds[4];
    const noiseHoldMs = 300;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      micStreamRef.current = stream;
      const ctx = getAudioCtx();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      micAnalyserRef.current = analyser;
      const buf = new Uint8Array(analyser.fftSize);

      function checkVolume() {
        if (!micAnalyserRef.current) return;
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i += 1) {
          const v = (buf[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / buf.length);
        if (rms > threshold) {
          if (!noiseStartedAtRef.current) {
            noiseStartedAtRef.current = performance.now();
          }
          if (performance.now() - noiseStartedAtRef.current >= noiseHoldMs) {
            stopMicMonitor();
            stopTimerWithNoise();
            return;
          }
        } else {
          noiseStartedAtRef.current = 0;
        }
        micRafRef.current = requestAnimationFrame(checkVolume);
      }

      micRafRef.current = requestAnimationFrame(checkVolume);
    } catch {
      // Mic access is optional in listen mode.
    }
  }

  function resetRewardState() {
    setSuccessVideoUrl(null);
    setRewardTotalSeconds(0);
    setRewardSecondsLeft(0);
    setRewardPlaybackNonce(0);
  }

  function hardReset({ close = false } = {}) {
    stopMicMonitor();
    clearAllIntervals();
    draggingRef.current = false;
    lastMinuteRef.current = 0;
    setRunning(false);
    setFinished(false);
    setSecondsLeft(0);
    setSetMinutes(0);
    setListenState("idle");
    setCenterPressed(false);
    resetRewardState();
    if (close) {
      setTimeLeft(0);
      setIsRunning(false);
      setIsOpen(false);
    }
  }

  function startTimer() {
    if (setMinutes <= 0) return;
    setListenState("idle");
    setFinished(false);
    resetRewardState();
    setSecondsLeft(setMinutes * 60);
    setRunning(true);
    if (listenMode) startMicMonitor(sensitivity);

    intervalRef.current = setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          clearAllIntervals();
          setRunning(false);
          setFinished(true);
          playBell();

          if (listenMode) {
            stopMicMonitor();
            const rewardDurationSeconds = Math.floor((setMinutes * 60) / 15) * 15;
            setRewardTotalSeconds(rewardDurationSeconds);
            setRewardSecondsLeft(rewardDurationSeconds);
            if (normalizedRewardVideos.length > 0) {
              const videoId = pickStoredRewardVideoId(normalizedRewardVideos, "analog-timer");
              setSuccessVideoUrl(videoId);
              setRewardPlaybackNonce(Date.now());
            }
            setListenState("success");
          }
          return 0;
        }

        playTick();
        return current - 1;
      });
    }, 1000);
  }

  function stopTimer() {
    hardReset();
  }

  function handleDragStart(event) {
    if (running) return;
    draggingRef.current = true;
    lastMinuteRef.current = setMinutes;
    handleDragMove(event);
  }

  function handleDragMove(event) {
    if (!draggingRef.current || running) return;
    const svg = svgRef.current;
    if (!svg) return;
    const touch = event.touches?.[0];
    const nextMinutes = analogTimerPointerToMinutes(
      touch ? touch.clientX : event.clientX,
      touch ? touch.clientY : event.clientY,
      svg,
    );

    if (nextMinutes !== lastMinuteRef.current) {
      lastMinuteRef.current = nextMinutes;
      setSetMinutes(nextMinutes);
    }
    setFinished(false);
  }

  function handleDragEnd() {
    draggingRef.current = false;
    setCenterPressed(false);
  }

  function preventMultiTouchZoom(event) {
    if (event.cancelable && event.touches && event.touches.length > 1) {
      event.preventDefault();
    }
  }

  function blockRewardInteraction(event) {
    if (event.target instanceof Element) {
      if (event.target.closest(".analog-timer-retry-btn")) return;
      if (event.target.closest(".analog-timer-video-shell")) return;
    }
    if (event.cancelable) event.preventDefault();
    event.stopPropagation();
  }


  const exactMinutesLeft = secondsLeft / 60;
  const sectorMin = finished ? 0 : (running ? Math.max(0, exactMinutesLeft) : setMinutes);
  const displayMin = Math.ceil(sectorMin);
  const minuteWord = getMinuteLabel(displayMin);
  const leftWord = minuteWord === "минута" ? "Осталась" : "Осталось";
  const idleDisplayString = setMinutes > 0 ? `${setMinutes} ${getMinuteLabel(setMinutes)}` : "Выберите время";
  const remainingSeconds = Math.max(0, Math.ceil(secondsLeft));
  const timeDisplayString = running
    ? (
      remainingSeconds > 0 && remainingSeconds < 60
        ? `Осталось ${remainingSeconds} ${getSecondLabel(remainingSeconds)}`
        : (sectorMin > 0 ? `${leftWord} ${displayMin} ${minuteWord}` : "0 минут")
    )
    : idleDisplayString;
  const totalSilentSeconds = Math.max(0, setMinutes * 60);
  const earnedSilentSeconds = running
    ? Math.max(0, totalSilentSeconds - secondsLeft)
    : (listenState === "success" || (finished && listenState !== "triggered"))
      ? totalSilentSeconds
      : 0;
  const earnedTokens = Math.floor(earnedSilentSeconds / 15);
  const rewardStarsTotal = Math.max(0, Math.floor(rewardTotalSeconds / 15));
  const rewardStarsRemaining = rewardStarsTotal > 0
    ? Math.max(0, Math.ceil(rewardSecondsLeft / 15))
    : 0;
  const rewardProgressPercent = rewardTotalSeconds > 0
    ? Math.max(0, Math.min(100, (rewardSecondsLeft / rewardTotalSeconds) * 100))
    : 0;
  const secondHandStep = running ? ((60 - (secondsLeft % 60)) % 60) : 0;
  const secondHandPoint = analogTimerClockwisePoint(secondHandStep, 72);
  const secondHandTailPoint = analogTimerClockwisePoint(secondHandStep + 30, 12);
  const centerButtonDisabled = !running && setMinutes === 0;
  const centerButtonClassName = [
    "analog-timer-center-button",
    running ? "is-running" : "is-idle",
    centerButtonDisabled ? "is-disabled" : "",
    centerPressed ? "is-pressed" : "",
  ].filter(Boolean).join(" ");
  const embedUrl = successVideoUrl ? makeYoutubeEmbedUrl(successVideoUrl) : null;

  const clockSvg = (
    <svg
      ref={svgRef}
      viewBox="0 0 200 200"
      className={running ? "running" : ""}
      onMouseDown={handleDragStart}
      onMouseMove={handleDragMove}
      onMouseUp={handleDragEnd}
      onMouseLeave={handleDragEnd}
      onTouchStart={(event) => { handleDragStart(event); if (event.cancelable) event.preventDefault(); }}
      onTouchMove={(event) => { handleDragMove(event); if (event.cancelable) event.preventDefault(); }}
      onTouchEnd={handleDragEnd}
    >
      <defs>
        <radialGradient id="at-face" cx="50%" cy="42%" r="58%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#f0e5d8" />
        </radialGradient>
        <radialGradient id="at-sector" cx="100" cy="100" r="90" gradientUnits="userSpaceOnUse">
          <stop offset="15%" stopColor="rgba(228,118,76,0.58)" />
          <stop offset="100%" stopColor="rgba(182,54,20,0.92)" />
        </radialGradient>
        <radialGradient id="at-sector-listen" cx="100" cy="100" r="90" gradientUnits="userSpaceOnUse">
          <stop offset="15%" stopColor="rgba(100,168,138,0.58)" />
          <stop offset="100%" stopColor="rgba(42,112,86,0.92)" />
        </radialGradient>
      </defs>

      <circle cx="100" cy="100" r="90" fill="url(#at-face)" />
      <path d={analogTimerSectorPath(sectorMin)} fill={`url(#at-sector${listenMode && running ? "-listen" : ""})`} />

      {Array.from({ length: 60 }, (_, index) => {
        const min = index;
        const is15 = min % 15 === 0;
        const is5 = min % 5 === 0;

        if (!is5) {
          const dot = analogTimerMinuteToPoint(min, 85);
          return <circle key={min} cx={dot.x.toFixed(1)} cy={dot.y.toFixed(1)} r="1.3" fill="rgba(58,44,32,0.2)" />;
        }

        const outer = analogTimerMinuteToPoint(min, 88);
        const inner = analogTimerMinuteToPoint(min, is15 ? 70 : 79);
        const labelPos = analogTimerMinuteToPoint(min, is15 ? 58 : 66);
        return (
          <g key={min}>
            <line
              x1={outer.x.toFixed(1)} y1={outer.y.toFixed(1)}
              x2={inner.x.toFixed(1)} y2={inner.y.toFixed(1)}
              stroke={is15 ? "rgba(58,44,32,0.82)" : "rgba(58,44,32,0.46)"}
              strokeWidth={is15 ? 2.5 : 1.6}
              strokeLinecap="round"
            />
            <text
              x={labelPos.x.toFixed(1)} y={labelPos.y.toFixed(1)}
              textAnchor="middle" dominantBaseline="central"
              fill={is15 ? "rgba(58,44,32,0.8)" : "rgba(58,44,32,0.52)"}
              fontSize={is15 ? "10" : "6.5"}
              fontFamily="Nunito, sans-serif"
              fontWeight={is15 ? "800" : "700"}
            >
              {min === 0 ? "0" : min}
            </text>
          </g>
        );
      })}

      {running && (
        <g className="analog-timer-second-hand" aria-hidden="true">
          <line
            x1={secondHandTailPoint.x.toFixed(1)} y1={secondHandTailPoint.y.toFixed(1)}
            x2={secondHandPoint.x.toFixed(1)} y2={secondHandPoint.y.toFixed(1)}
            stroke="#c84b2a" strokeWidth="1.5" strokeLinecap="round"
          />
          <circle cx="100" cy="100" r="3" fill="#c84b2a" />
        </g>
      )}

      {(() => {
        const knob = analogTimerMinuteToPoint(sectorMin, 90);
        return (
          <>
            <circle cx={knob.x.toFixed(1)} cy={knob.y.toFixed(1)} r="8.5" fill="#c84b2a" />
            <circle cx={knob.x.toFixed(1)} cy={knob.y.toFixed(1)} r="3.5" fill="rgba(255,255,255,0.62)" />
          </>
        );
      })()}

      <g
        className={centerButtonClassName}
        role="button"
        aria-label={running ? "Остановить таймер" : "Запустить таймер"}
        aria-disabled={centerButtonDisabled}
        onClick={(event) => {
          event.stopPropagation();
          if (centerButtonDisabled) return;
          if (running) stopTimer();
          else startTimer();
        }}
        onMouseDown={(event) => event.stopPropagation()}
        onTouchStart={(event) => event.stopPropagation()}
        onPointerDown={(event) => {
          event.stopPropagation();
          if (!centerButtonDisabled) setCenterPressed(true);
        }}
        onPointerUp={(event) => {
          event.stopPropagation();
          setCenterPressed(false);
        }}
        onPointerLeave={(event) => {
          event.stopPropagation();
          setCenterPressed(false);
        }}
        onPointerCancel={() => setCenterPressed(false)}
      >
        <circle className="analog-timer-center-button__bg" cx="100" cy="100" r="21" />
        {running ? (
          <rect className="analog-timer-center-button__icon analog-timer-center-button__icon--stop" x="91.5" y="91.5" width="17" height="17" rx="3.5" />
        ) : (
          <path className="analog-timer-center-button__icon analog-timer-center-button__icon--play" d="M96 91.5 L114 100 L96 108.5 Z" />
        )}
      </g>
    </svg>
  );

  if (clockOnly) {
    let silenceStrip;
    if (listenState === "triggered") {
      silenceStrip = (
        <div className="cts-noise">
          <span className="cts-noise__icon">🔇</span>
          <span className="cts-noise__msg">Слышен звук!</span>
          <button className="cts-btn" onClick={() => setListenState("idle")}>Попробовать снова</button>
        </div>
      );
    } else if (listenState === "success") {
      silenceStrip = (
        <div className="cts-success">
          <div className="cts-success__stars" aria-hidden="true">
            {Array.from({ length: rewardStarsTotal }, (_, i) => (
              <span key={i} className={`cts-star${i < rewardStarsRemaining ? "" : " is-burned"}`}>⭐</span>
            ))}
          </div>
          {rewardSecondsLeft > 0 && (
            <span className="cts-success__time">{formatClockDuration(rewardSecondsLeft)}</span>
          )}
          <button className="cts-btn" onClick={() => { setListenState("idle"); resetRewardState(); }}>✕</button>
        </div>
      );
    } else if (listenMode && running) {
      silenceStrip = (
        <div className="cts-listening">
          <span className="cts-listening__emoji">🤫</span>
          <span className="cts-listening__text">Тссс...</span>
          {earnedTokens > 0 && (
            <span className="cts-listening__stars" aria-live="polite">
              {Array.from({ length: Math.min(earnedTokens, 6) }, (_, i) => <span key={i}>⭐</span>)}
            </span>
          )}
        </div>
      );
    } else {
      silenceStrip = listenMode && !running ? (
        <div className="cts-mic">
          <span className="cts-mic__label">Точнее</span>
          <input
            className="cts-mic__slider"
            type="range" min="1" max="7" step="1"
            value={sensitivity}
            onChange={(e) => setSensitivity(Number.parseInt(e.target.value, 10) || 4)}
          />
          <span className="cts-mic__label">Грубее</span>
        </div>
      ) : null;
    }

    return (
      <>
        <div className="analog-timer-clock-only-wrap">
          {(running || setMinutes > 0) && listenState !== "success" && (
            <div className="analog-timer-drag-label">
              {running ? (
                remainingSeconds < 60 ? (
                  <>
                    <span className="analog-timer-drag-label__value">{remainingSeconds}</span>
                    <span className="analog-timer-drag-label__unit">{getSecondLabel(remainingSeconds)}</span>
                  </>
                ) : (
                  <>
                    <span className="analog-timer-drag-label__value">{displayMin}</span>
                    <span className="analog-timer-drag-label__unit">{minuteWord}</span>
                  </>
                )
              ) : (
                <>
                  <span className="analog-timer-drag-label__value">{setMinutes}</span>
                  <span className="analog-timer-drag-label__unit">{getMinuteLabel(setMinutes)}</span>
                </>
              )}
            </div>
          )}
          {clockSvg}
          {!running && listenState !== "success" && (
            <button
              className={`cts-silence-toggle${listenMode ? " is-active" : ""}`}
              onClick={() => setListenMode((v) => !v)}
              aria-pressed={listenMode}
            >
              <span className="cts-silence-toggle__label">🤫 Тишина</span>
              <span className="cts-silence-toggle__track">
                <span className="cts-silence-toggle__thumb" />
              </span>
            </button>
          )}
          {listenState === "success" && (
            <div className="cts-overlay">
              {embedUrl ? (
                <>
                  <div className="cts-overlay__bar">
                    <span className="cts-overlay__title">🎬 Мультик</span>
                    <span className="cts-overlay__time">{formatClockDuration(rewardSecondsLeft)}</span>
                  </div>
                  <div className="analog-timer-video-shell" style={{ flex: 1 }}>
                    <iframe
                      key={`reward-co-${rewardPlaybackNonce}`}
                      className="analog-timer-video-frame"
                      src={embedUrl}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      title="Видео-награда"
                      tabIndex={-1}
                      referrerPolicy="strict-origin-when-cross-origin"
                    />
                    <div className="analog-timer-video-shield" />
                  </div>
                </>
              ) : (
                <div className="cts-overlay__empty">
                  <span>🎉</span>
                  <span>Молодец!</span>
                </div>
              )}
            </div>
          )}
        </div>
        <div className={`analog-timer-silence-strip${listenMode ? " is-visible" : ""}`}>
          {silenceStrip}
        </div>
      </>
    );
  }

  return (
    <div
      className="analog-timer-inner"
      onTouchStart={preventMultiTouchZoom}
      onTouchMove={preventMultiTouchZoom}
    >
      <div className="analog-timer-topbar">
        <span className="analog-timer-title">Таймер</span>
        <div className="analog-timer-topbar-actions">
          <button
            className="analog-timer-icon-btn"
            onClick={() => setSoundEnabled((value) => !value)}
            title={soundEnabled ? "Звук вкл" : "Звук выкл"}
          >
            {soundEnabled ? "🔊" : "🔇"}
          </button>
          <button className="analog-timer-icon-btn" onClick={() => hardReset({ close: true })} title="Закрыть">
            ✕
          </button>
        </div>
      </div>

      {listenState === "success" && (
        <div
          className="analog-timer-success-overlay"
          onClickCapture={blockRewardInteraction}
          onDoubleClick={blockRewardInteraction}
          onPointerDown={blockRewardInteraction}
          onPointerMove={blockRewardInteraction}
          onPointerUp={blockRewardInteraction}
          onTouchStart={blockRewardInteraction}
          onTouchMove={blockRewardInteraction}
          onTouchEnd={blockRewardInteraction}
          onWheel={blockRewardInteraction}
          onGestureStart={blockRewardInteraction}
          onGestureChange={blockRewardInteraction}
          onGestureEnd={blockRewardInteraction}
        >
          {embedUrl ? (
            <>
              <div className="analog-timer-reward-bar" aria-live="polite">
                <div className="analog-timer-reward-bar__header">
                  <span className="analog-timer-reward-bar__title">Время мультика</span>
                  <span className="analog-timer-reward-bar__time">{formatClockDuration(rewardSecondsLeft)}</span>
                </div>
                <div className="analog-timer-reward-bar__track" aria-hidden="true">
                  <div className="analog-timer-reward-bar__fill" style={{ width: `${rewardProgressPercent}%` }} />
                </div>
                <div className="analog-timer-reward-bar__stars" aria-hidden="true">
                  {Array.from({ length: rewardStarsTotal }, (_, index) => {
                    const active = index < rewardStarsRemaining;
                    return (
                      <span
                        key={`reward-star-${index}`}
                        className={`analog-timer-reward-bar__star${active ? "" : " is-burned"}`}
                      >
                        ⭐
                      </span>
                    );
                  })}
                </div>
              </div>
              <div className="analog-timer-video-shell" aria-hidden="true">
                <iframe
                  key={`analog-reward-video-${rewardPlaybackNonce}`}
                  className="analog-timer-video-frame"
                  src={embedUrl}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  title="Видео-награда"
                  tabIndex={-1}
                  referrerPolicy="strict-origin-when-cross-origin"
                />
                <div className="analog-timer-video-shield" />
              </div>
            </>
          ) : (
            <div className="analog-timer-success-empty">
              <div className="analog-timer-success-emoji">🎉</div>
              <div className="analog-timer-success-msg">Молодец! Ты справился!</div>
              <div className="analog-timer-success-note">Видео не добавлено в профиль ученика</div>
            </div>
          )}
          <button
            className="analog-timer-retry-btn"
            onClick={() => {
              setListenState("idle");
              resetRewardState();
            }}
          >
            ✕ Закрыть
          </button>
        </div>
      )}

      <div
        className="analog-timer-body"
        onTouchStart={preventMultiTouchZoom}
        onTouchMove={preventMultiTouchZoom}
      >
        {listenState === "triggered" ? (
          <div className="analog-timer-noise-screen">
            <div className="analog-timer-noise-icon">🔇</div>
            <div className="analog-timer-noise-msg">Слышен звук!<br />Попробуем ещё раз</div>
            <button className="analog-timer-retry-btn" onClick={() => setListenState("idle")}>
              Попробовать снова
            </button>
          </div>
        ) : (
          <>
            <div className="analog-timer-clock-wrap">
              {setMinutes > 0 && (
                <div className="analog-timer-drag-label">
                  <span className="analog-timer-drag-label__value">{setMinutes}</span>
                  <span className="analog-timer-drag-label__unit">{getMinuteLabel(setMinutes)}</span>
                </div>
              )}
              {clockSvg}
            </div>

            <div className="analog-timer-controls">
              <div className="analog-timer-panel">
                <div className={`analog-timer-display${!running && setMinutes === 0 ? " zero" : ""}`}>
                  {timeDisplayString}
                </div>

                {!running && (
                  <button
                    className={`analog-timer-section-toggle${listenMode ? " is-active" : ""}`}
                    onClick={() => {
                      if (!listenMode) {
                        setListenMode(true);
                        setEarningsOpen(true);
                        return;
                      }
                      setEarningsOpen((value) => !value);
                    }}
                  >
                    Играем в тишину! <span className="analog-timer-section-toggle__chevron">{listenMode ? "▾" : "▴"}</span>
                  </button>
                )}

                {listenMode && earningsOpen && (
                  <div className="analog-timer-silence-panel">
                    {running && (
                      <div className="analog-timer-earnings" aria-live="polite">
                        <div className="analog-timer-earnings__stack">
                          <div className="analog-timer-earnings__coins analog-timer-earnings__coins--stars">
                            {Array.from({ length: earnedTokens }, (_, index) => (
                              <span key={`analog-coin-${index}`} className="analog-timer-earnings__star">⭐</span>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {!running && (
                      <div className="analog-timer-listen-settings">
                        <div className="analog-timer-mic-config">
                          <div className="analog-timer-mic-config__title">Настройка микрофона</div>
                          <div className="analog-timer-sensitivity">
                            <span className="analog-timer-sensitivity__edge">Грубее</span>
                            <input
                              className="analog-timer-sensitivity__slider"
                              type="range"
                              min="1"
                              max="7"
                              step="1"
                              value={sensitivity}
                              onChange={(event) => setSensitivity(Number.parseInt(event.target.value, 10) || 4)}
                            />
                            <span className="analog-timer-sensitivity__edge">Точнее</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {listenMode && running && (
                      <div className="analog-timer-listening-indicator analog-timer-listening-indicator--active">
                        <div className="analog-timer-listening-indicator__emoji">🤫</div>
                        <div className="analog-timer-listening-indicator__text">Тссс...</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
