import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Button from "@/shared/components/Button";
import { numberWords, pluralHundreds, pluralOnes, pluralTens } from "./placeValueLabels.js";
import { AnswerField, Keypad, useTypedAnswer } from "./FieldPad.jsx";
import { NUMBER_AUDIO_WORDS, numberAudioParts, playNumber, registerSpeech, stopSpeech } from "./numberAudio.js";
import { useSpeechGuard } from "./useSpeechGuard.js";
import "./place_value.css";
import "./group_ten.css";
import "./names.css";

// «Названия чисел» → «Послушай и выбери»: the number is spoken (the owner's
// recorded voice, numberAudio.js), the child taps it among three written
// numbers. The wrong options are the ones that sound alike — 19 / 90,
// 12 / 20, 20 / 200, 13 / 30, swapped digits, the zero in the wrong place —
// because that is what a child with weak phonemic hearing confuses. In
// «Обучение» a wrong tap plays the name of what was tapped and then the right
// one again: the two words heard back to back are the lesson.
// See docs/place-value-methodology.md, «Названия чисел».

function useScreenMode() {
  const ref = useRef(null);
  const [mode, setMode] = useState("phone");
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => {
      const { clientWidth: W, clientHeight: H } = el;
      if (W && H) setMode(W >= 900 && W > H * 1.15 ? "wide" : W < 600 ? "phone" : "tablet");
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, mode];
}

const cap = (s) => `${s[0].toUpperCase()}${s.slice(1)}`;
// «Девяносто — это 9 десятков и 0 единиц» — the places named, zeros included.
function composition(n) {
  const h = Math.floor(n / 100), t = Math.floor(n / 10) % 10, o = n % 10;
  const parts = [...(h ? [`${h} ${pluralHundreds(h)}`] : []), `${t} ${pluralTens(t)}`];
  return `${cap(numberWords(n))} — это ${parts.join(", ")} и ${o} ${pluralOnes(o)}`;
}

// A number's name word by word; in «Обучение» each word in its place colour
// («триста» green, «пятьдесят» orange, «пять» blue — the teens, one word for
// a ten and ones, stay neutral), linking the word to its column.
function spelledWords(value, colored) {
  return numberAudioParts(value).flatMap((part, i) => {
    const kind = part >= 100 ? "hundreds" : part >= 20 || part === 10 ? "tens" : part >= 11 ? "teen" : "ones";
    const word = <span key={i} className={colored ? `nn-w nn-w--${kind}` : "nn-w"}>{NUMBER_AUDIO_WORDS[part]}</span>;
    return i ? [" ", word] : [word];
  });
}

export default function NumberNamesTask(props) {
  return props.task.task === "say" ? <SayNumber {...props} /> : <HearOrRead {...props} />;
}

// The number's digits in their place colours (hundreds green, tens orange, ones blue).
const placeKinds = (n) => ["hundreds", "tens", "ones"].slice(3 - String(n).length);
function ColoredNumber({ n }) {
  const kinds = placeKinds(n);
  return [...String(n)].map((d, i) => <span key={i} className={`nn-w--${kinds[i]}`}>{d}</span>);
}

// «Посмотри и назови»: the number is written; the child says it aloud — the one
// step of the topic where the child speaks the name, not picks or types it.
// Then «Послушать, как правильно»: the owner's voice says it and the name shows
// in words. The adult judges: «Сказал верно» — next number; «Повторим» — the
// name once more, «Повтори за мной», then «Далее» (the mistake is counted).
function SayNumber({ task, onCorrect, onMistake }) {
  const n = task.number;
  const [ref, mode] = useScreenMode();
  const { guard } = useSpeechGuard();
  const [phase, setPhase] = useState("say"); // say → heard → (repeat)
  const clip = useRef(null);
  useEffect(() => () => clip.current?.stop(), []);
  const speak = () => { stopSpeech(); clip.current = playNumber(n); };
  const listen = () => { speak(); setPhase("heard"); };
  const again = () => { onMistake?.(task.conceptId, task.cardId); speak(); setPhase("repeat"); };
  return <div ref={ref} className={`pv-screen nn-screen nn-screen--${mode} nn-say`} {...guard}>
    <div className="nn-inner">
      <h2 className="sg-title">Посмотри и назови число</h2>
      <div className="nn-number"><ColoredNumber n={n} /></div>
      <div className="nn-say-words" aria-live="polite">{phase === "say" ? " " : spelledWords(n, true)}</div>
      <div className="sg-status nn-status" role="status">
        {phase === "say" ? <span className="sg-status-hint">Скажи число вслух.</span>
          : phase === "repeat" ? <span className="sg-status-note">Повтори за мной.</span> : null}
      </div>
      <div className="nn-say-actions">
        {phase === "say" && <button type="button" className="nn-say-btn" onClick={listen}>Послушать, как правильно</button>}
        {phase === "heard" && <>
          <button type="button" className="nn-say-btn nn-say-btn--ok" onClick={() => onCorrect(task.conceptId, task.cardId)}>✓ Сказал верно</button>
          <button type="button" className="nn-say-btn nn-say-btn--again" onClick={again}>Повторим</button>
        </>}
        {phase === "repeat" && <>
          <button type="button" className="nn-say-btn nn-say-btn--listen" onClick={speak}>Послушать ещё</button>
          <Button onClick={() => onCorrect(task.conceptId, task.cardId)}>Далее →</Button>
        </>}
      </div>
    </div>
  </div>;
}

function HearOrRead({ task, onCorrect, onMistake, onFlashIncorrect }) {
  const teaching = task.supportMode !== "independent";
  const writing = task.task === "write";
  // «Прочитай и выбери название»: the number is written, the options are its
  // name and the names of its look-alikes («девяносто / девятнадцать /
  // девятьсот», «триста пять / триста пятьдесят / тридцать пять») — same root,
  // so the word has to be read to its end.
  const reading = task.task === "read";
  const n = task.number;
  const typed = useTypedAnswer(4); // «3005» for 305 is a mistake to catch
  const [misses, setMisses] = useState(0);
  const [ref, mode] = useScreenMode();
  const [solved, setSolved] = useState(false);
  const [wrong, setWrong] = useState([]);
  const [note, setNote] = useState("");
  const [playing, setPlaying] = useState(false);
  const player = useRef(null);
  const { guard } = useSpeechGuard();

  const play = async (...numbers) => {
    stopSpeech();
    setPlaying(true);
    let cancelled = false;
    // The whole sequence («19» … «90», gaps included) stops on any tap.
    const stopper = { stop: () => { cancelled = true; unregister(); current?.stop(); } };
    const unregister = registerSpeech(stopper.stop);
    let current = null;
    player.current = stopper;
    for (const value of numbers) {
      if (cancelled) break;
      current = playNumber(value);
      await current.done;
      if (cancelled) break;
      await new Promise((r) => setTimeout(r, 350));
    }
    unregister();
    if (player.current === stopper) setPlaying(false);
  };
  // Speak the number as soon as the task shows; stop when it goes away.
  // (Not when reading: the name is what the child has to find.)
  useEffect(() => { if (!reading) play(n); return () => player.current?.stop(); }, [n]); // eslint-disable-line react-hooks/exhaustive-deps

  // «Послушай и напиши»: the child types the number. In «Обучение» a wrong number
  // is named and the right one played after it (as in «выбери»); a wrong count
  // of digits gets the places named («Сколько цифр нужно?»); after two misses
  // the three choices come back — the step below.
  function enter() {
    if (solved || !typed.digits) return;
    const guess = Number(typed.digits);
    if (guess === n) { typed.reset(); setSolved(true); setNote(""); player.current?.stop(); setPlaying(false); return; }
    typed.fail();
    setMisses((m) => m + 1);
    onMistake?.(task.conceptId, task.cardId); onFlashIncorrect?.();
    if (!teaching) { setNote("Послушай ещё раз."); play(n); return; }
    if (typed.digits.length !== String(n).length && n >= 10) { setNote(`${composition(n)}. Сколько цифр нужно?`); play(n); return; }
    setNote(`${guess} — это «${numberWords(guess)}». А звучало другое число. Послушай ещё раз.`);
    play(guess, n);
  }
  const showChoices = writing && teaching && misses >= 2 && !solved;
  const spelled = (value) => spelledWords(value, teaching);

  function choose(value) {
    if (solved || wrong.includes(value)) return;
    if (value === n) {
      setSolved(true); setNote("");
      player.current?.stop(); setPlaying(false);
      return;
    }
    setWrong((w) => [...w, value]);
    onMistake?.(task.conceptId, task.cardId); onFlashIncorrect?.();
    if (reading) {
      // The tapped word is read aloud and tied to its own number.
      if (teaching) { setNote(`«${numberWords(value)}» — это ${value}. Прочитай число ещё раз.`); play(value); } else setNote("Прочитай ещё раз.");
      return;
    }
    if (teaching) {
      setNote(`${value} — это «${numberWords(value)}». А звучало другое число. Послушай ещё раз.`);
      play(value, n);
    } else {
      setNote("Послушай ещё раз.");
      play(n);
    }
  }

  return <div ref={ref} className={`pv-screen nn-screen nn-screen--${mode}`} {...guard}>
    <div className="nn-inner">
      <h2 className="sg-title">{reading ? "Прочитай и выбери название" : writing ? "Послушай и напиши число" : "Послушай и выбери число"}</h2>
      {reading && <div className="nn-number">{n}</div>}
      {/* The «диктор» button of the dictation and «Слушай и посчитай» (styles
          copied into names.css): bars bounce and ripples spread while it speaks. */}
      {!reading && <div className={`nn-diktor-wrap${playing ? " nn-diktor-wrap--playing" : ""}`}>
        <span className="nn-ripple" />
        <span className="nn-ripple" />
        <span className="nn-ripple" />
        <button type="button" className={`nn-diktor${playing ? " nn-diktor--playing" : ""}`} aria-label="Послушать" disabled={playing} onClick={() => play(n)}>
          <span className="nn-bar" />
          <span className="nn-bar" />
          <span className="nn-bar" />
          <span className="nn-bar" />
        </button>
      </div>}
      {writing && <div className="nn-answer">
        <AnswerField label="Число" tone="total" big ok={solved} active={!solved} wrong={typed.wrong} value={solved ? n : typed.digits} />
      </div>}
      {(!writing || showChoices) && <>
        {showChoices && <div className="nn-choose-hint">Какое число звучит? Выбери.</div>}
        <div className={`nn-options${reading ? " nn-options--words" : ""}`}>
        {task.options.map((value) => {
          const state = solved && value === n ? " nn-option--right" : wrong.includes(value) ? " nn-option--wrong" : "";
          return <button type="button" key={value} className={`nn-option${reading ? " nn-word" : ""}${state}`} disabled={solved || wrong.includes(value)}
            onClick={() => choose(value)}>{reading ? spelled(value) : value}</button>;
        })}
        </div>
      </>}
      <div className="sg-status nn-status" role="status">
        {solved ? null
          : note ? <span className="sg-status-note">{note}</span> : null}
      </div>
      <div className="sg-slot nn-slot">
        {solved ? <Button onClick={() => onCorrect(task.conceptId, task.cardId)}>Далее →</Button>
          : writing && !showChoices ? <Keypad typed={typed} onEnter={enter} /> : null}
      </div>
    </div>
  </div>;
}
