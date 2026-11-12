import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import RewardVideoModal from "@/shared/components/RewardVideoModal";
import {
  allowedChanges,
  buildWorksheet,
  COUNT_MAX,
  COUNT_MIN,
  defaultSection,
  itemCorrect,
  MAX_NUMBERS,
  normalizeConfig,
  normalizeSection,
  SECTION_INFO,
  SECTION_TYPES,
} from "./sections";
import "./worksheet.css";

// «Контрольная работа» (operation_worksheet): build → solve on screen → result,
// with an A4 PDF (sheet + answers page) from the builder or the result.
// The last test is remembered on the device and in the account.

const LOCAL_KEY = "mirocard:addition_subtraction:worksheet";
const KV_KEY = "addition_subtraction:worksheet:last";

function loadLocal() {
  try { return JSON.parse(window.localStorage.getItem(LOCAL_KEY) ?? "null"); } catch { return null; }
}
function saveLocal(doc) {
  try { window.localStorage.setItem(LOCAL_KEY, JSON.stringify(doc)); } catch { /* private mode: still works */ }
}

const SIGN = { add: "+", subtract: "−" };

export function SectionBadge({ type, size = "md" }) {
  const cls = `ws-badge ws-badge--${type} ws-badge--${size}`;
  if (type === "one") return <span className={cls} aria-hidden="true">3<b className="ws-plus">+</b>2</span>;
  if (type === "multi") return <span className={cls} aria-hidden="true">5<b className="ws-plus">+</b>2<b className="ws-minus">−</b>1</span>;
  if (type === "missing") return <span className={cls} aria-hidden="true">3<b className="ws-plus">+</b><i className="ws-badge__box" /></span>;
  if (type === "sign") return <span className={cls} aria-hidden="true">6<i className="ws-badge__box" />2</span>;
  return (
    <span className={cls} aria-hidden="true">
      <svg viewBox="0 0 40 22" width="34" height="20"><circle cx="7" cy="11" r="6" fill="#fff" stroke="#263131" strokeWidth="1.6" /><path d="M14 11h11M22 8l3 3-3 3" fill="none" stroke="#1f7a6f" strokeWidth="2" /><circle cx="32" cy="11" r="6" fill="#fff6d6" stroke="#e9c46a" strokeWidth="1.6" /></svg>
    </span>
  );
}

function sectionSummary(s) {
  const parts = [`${s.count} ${plural(s.count, "задание", "задания", "заданий")}`, `до ${s.maxNumber}`];
  if (s.type !== "sign") parts.push(s.ops === "add" ? "только +" : s.ops === "subtract" ? "только −" : "+ и −");
  if (s.type === "multi" || s.type === "chain") parts.push(`${s.steps} ${plural(s.steps, "действие", "действия", "действий")}`);
  if (s.type === "missing") parts.push(s.unknown === "left" ? "слева" : s.unknown === "right" ? "справа" : "вперемешку");
  return parts.join(" · ");
}

function plural(n, one, few, many) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

function Chips({ label, options, value, onChange }) {
  return (
    <div className="ws-field">
      <span className="ws-field__label">{label}</span>
      <div className="ws-chips" role="group" aria-label={label}>
        {options.map((o) => (
          <button key={String(o.value)} type="button" className={`ws-chip${value === o.value ? " ws-chip--on" : ""}${o.tone ? ` ws-chip--${o.tone}` : ""}`} aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function SectionEditor({ section, onChange }) {
  const set = (patch) => onChange(normalizeSection({ ...section, ...patch }));
  return (
    <div className="ws-editor">
      <div className="ws-field">
        <span className="ws-field__label">Сколько заданий</span>
        <div className="ws-stepper">
          <button type="button" aria-label="Меньше" disabled={section.count <= COUNT_MIN} onClick={() => set({ count: section.count - 1 })}>−</button>
          <span className="ws-stepper__value">{section.count}</span>
          <button type="button" aria-label="Больше" disabled={section.count >= COUNT_MAX} onClick={() => set({ count: section.count + 1 })}>+</button>
        </div>
      </div>
      <Chips label="Числа" value={section.maxNumber} onChange={(v) => set({ maxNumber: v })} options={MAX_NUMBERS.map((v) => ({ value: v, label: `до ${v}` }))} />
      <Chips label="Изменение" value={section.changeMax} onChange={(v) => set({ changeMax: v })} options={allowedChanges(section.maxNumber).map((v) => ({ value: v, label: v === 99 ? "любое" : String(v) }))} />
      {section.type !== "sign" && (
        <Chips label="Действия" value={section.ops} onChange={(v) => set({ ops: v })} options={[{ value: "add", label: "только +", tone: "plus" }, { value: "subtract", label: "только −", tone: "minus" }, { value: "both", label: "+ и −" }]} />
      )}
      {(section.type === "multi" || section.type === "chain") && (
        <Chips label={section.type === "chain" ? "Шагов в цепочке" : "Количество действий"} value={section.steps} onChange={(v) => set({ steps: v })} options={[2, 3, 4].map((v) => ({ value: v, label: String(v) }))} />
      )}
      {section.type === "missing" && (
        <Chips label="Где неизвестное" value={section.unknown} onChange={(v) => set({ unknown: v })} options={[{ value: "right", label: "справа" }, { value: "left", label: "слева" }, { value: "mixed", label: "вперемешку" }]} />
      )}
      <Chips label="Ноль" value={section.includeZero} onChange={(v) => set({ includeZero: v })} options={[{ value: false, label: "без нуля" }, { value: true, label: "с нулём" }]} />
    </div>
  );
}

// One row: numbers, signs and the boxes. `values[i]` is what the child put in box i.
export function SheetItem({ item, values = [], focus = null, onFocus, review = false }) {
  const isChain = item.tokens.some((t) => t.t === "arrow");
  return (
    <span className={`ws-item${isChain ? " ws-item--chain" : ""}`}>
      {item.tokens.map((tok, k) => {
        if (tok.t === "num") return <span key={k} className={`ws-num${isChain ? " ws-num--ring" : ""}`}>{tok.v}</span>;
        if (tok.t === "op") return <span key={k} className={`ws-op ws-op--${tok.op}`}>{SIGN[tok.op]}</span>;
        if (tok.t === "eq") return <span key={k} className="ws-eq">=</span>;
        if (tok.t === "arrow") {
          return (
            <span key={k} className="ws-arrow" aria-label={`${SIGN[tok.op]}${tok.d}`}>
              <span className={`ws-arrow__label ws-op--${tok.op}`}>{SIGN[tok.op]}{tok.d}</span>
              <svg viewBox="0 0 30 10" width="30" height="10" aria-hidden="true"><path d="M1 5h26M23 1.5L27 5l-4 3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
          );
        }
        const raw = values[tok.i];
        const shown = raw == null || raw === "" ? "" : tok.kind === "sign" ? SIGN[raw] : String(raw);
        const expected = item.answers[tok.i];
        const right = review && raw === expected;
        const wrong = review && !right;
        const cls = [
          "ws-blank",
          isChain ? "ws-blank--ring" : "",
          tok.kind === "sign" ? "ws-blank--sign" : "",
          focus === tok.i ? "ws-blank--focus" : "",
          right ? "ws-blank--right" : "",
          wrong ? "ws-blank--wrong" : "",
        ].filter(Boolean).join(" ");
        const box = (
          <button key={k} type="button" className={cls} onClick={() => onFocus?.(tok.i)} disabled={!onFocus} aria-label={shown ? `Ответ ${shown}` : "Пустая клетка"}>
            {wrong ? <s>{shown}</s> : shown}
          </button>
        );
        if (!wrong) return box;
        // Review: the child's answer struck out in its box, the right one beside it.
        return (
          <span key={k} className="ws-fix">
            {box}
            <span className="ws-fix__right" aria-label={`Верно: ${tok.kind === "sign" ? SIGN[expected] : expected}`}>{tok.kind === "sign" ? SIGN[expected] : expected}</span>
          </span>
        );
      })}
    </span>
  );
}

function usePdf(sheet) {
  const [job, setJob] = useState(null);
  const name = `${sheet.title} ${new Date().toLocaleDateString("ru-RU")}.pdf`.replace(/[\\/:*?"<>|]+/g, " ");
  useEffect(() => { setJob(null); }, [sheet]);
  const download = (blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };
  async function make() {
    let handle = null;
    if (typeof window.showSaveFilePicker === "function") {
      try {
        handle = await window.showSaveFilePicker({ suggestedName: name, types: [{ description: "PDF", accept: { "application/pdf": [".pdf"] } }] });
      } catch (e) {
        if (e?.name === "AbortError") return;
      }
    }
    setJob({ status: "making" });
    try {
      const { makeWorksheetPdf } = await import("./worksheetPdf");
      const blob = await makeWorksheetPdf(sheet);
      if (handle) {
        const w = await handle.createWritable();
        await w.write(blob); await w.close();
        setJob({ status: "saved", blob });
      } else {
        setJob({ status: "ready", blob });
      }
    } catch (e) {
      console.error("Контрольная PDF", e);
      setJob({ status: "error" });
    }
  }
  // The share sheet needs its own tap (one started seconds after the first tap is refused on iPad).
  async function save() {
    const file = new File([job.blob], name, { type: "application/pdf" });
    try {
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: name });
      else download(job.blob);
      setJob({ status: "saved", blob: job.blob });
    } catch (e) {
      if (e?.name === "AbortError") return;
      download(job.blob);
      setJob({ status: "saved", blob: job.blob });
    }
  }
  return { job, make, save };
}

function PdfButton({ pdf, label = "Лист А4 (PDF)" }) {
  const { job, make, save } = pdf;
  if (job?.status === "ready") return <button type="button" className="ws-btn ws-btn--secondary" onClick={save}>Сохранить PDF</button>;
  return (
    <button type="button" className="ws-btn ws-btn--secondary" onClick={make} disabled={job?.status === "making"}>
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M7 3h7l5 5v13H7z M14 3v5h5 M10 14l2 2 2-2 M12 10v6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      {job?.status === "making" ? "Готовлю PDF…" : job?.status === "saved" ? "PDF сохранён" : job?.status === "error" ? "Не получилось — ещё раз" : label}
    </button>
  );
}

function Builder({ config, setConfig, sheet, onStart }) {
  const [open, setOpen] = useState(0);
  const [adding, setAdding] = useState(false);
  const pdf = usePdf(sheet);
  const sections = config.sections;
  const update = (i, s) => setConfig({ ...config, sections: sections.map((x, k) => (k === i ? s : x)) });
  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= sections.length) return;
    const next = [...sections];
    [next[i], next[j]] = [next[j], next[i]];
    setConfig({ ...config, sections: next });
    setOpen(j);
  };
  const remove = (i) => {
    setConfig({ ...config, sections: sections.filter((_, k) => k !== i) });
    setOpen(-1);
  };
  const add = (type) => {
    setConfig({ ...config, sections: [...sections, defaultSection(type)] });
    setOpen(sections.length);
    setAdding(false);
  };

  return (
    <div className="ws-screen ws-screen--build">
      <div className="ws-build">
        <label className="ws-title-field">
          <span className="ws-title-field__label">Название</span>
          <input id="ws-title" value={config.title} maxLength={60} onChange={(e) => setConfig({ ...config, title: e.target.value })} />
        </label>

        <div className="ws-build__head">
          <h2>Разделы</h2>
          <span>{sheet.total} {plural(sheet.total, "задание", "задания", "заданий")}</span>
        </div>

        <ol className="ws-sections">
          {sections.map((s, i) => (
            <li key={i} className={`ws-section${open === i ? " ws-section--open" : ""}`}>
              <div className="ws-section__row">
                <button type="button" className="ws-section__toggle" onClick={() => setOpen(open === i ? -1 : i)} aria-expanded={open === i}>
                  <span className="ws-section__no">{i + 1}</span>
                  <SectionBadge type={s.type} />
                  <span className="ws-section__text">
                    <b>{SECTION_INFO[s.type].title}</b>
                    <span>{sectionSummary(s)}</span>
                  </span>
                </button>
                <div className="ws-section__tools">
                  <button type="button" aria-label="Выше" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                  <button type="button" aria-label="Ниже" disabled={i === sections.length - 1} onClick={() => move(i, 1)}>↓</button>
                  <button type="button" aria-label="Удалить раздел" className="ws-section__del" disabled={sections.length === 1} onClick={() => remove(i)}>✕</button>
                </div>
              </div>
              {open === i && (
                <>
                  <SectionEditor section={s} onChange={(next) => update(i, next)} />
                  <div className="ws-preview" aria-label="Так будет выглядеть">
                    {sheet.sections[i]?.items.slice(0, 2).map((item, k) => <SheetItem key={k} item={item} />)}
                  </div>
                </>
              )}
            </li>
          ))}
        </ol>

        {adding ? (
          <div className="ws-add">
            <div className="ws-add__head">
              <b>Добавить раздел</b>
              <button type="button" aria-label="Закрыть" onClick={() => setAdding(false)}>✕</button>
            </div>
            {SECTION_TYPES.map((type) => (
              <button key={type} type="button" className="ws-add__item" onClick={() => add(type)}>
                <SectionBadge type={type} />
                <span className="ws-section__text"><b>{SECTION_INFO[type].title}</b><span>{SECTION_INFO[type].instruction}</span></span>
              </button>
            ))}
          </div>
        ) : (
          <button type="button" className="ws-add-btn" onClick={() => setAdding(true)}>+ Добавить раздел</button>
        )}
      </div>

      <div className="ws-actions">
        <button type="button" className="ws-btn ws-btn--ghost" onClick={() => setConfig({ ...config, seed: config.seed + 1 })}>Новые примеры</button>
        <PdfButton pdf={pdf} />
        <button type="button" className="ws-btn ws-btn--primary" onClick={onStart}>Решать на экране</button>
      </div>
    </div>
  );
}

function Keypad({ kind, onKey, onBackspace, onNext }) {
  if (kind === "sign") {
    return (
      <div className="ws-keypad ws-keypad--sign">
        <button type="button" className="operation-audio-key ws-key--plus" onClick={() => onKey("add")}>+</button>
        <button type="button" className="operation-audio-key ws-key--minus" onClick={() => onKey("subtract")}>−</button>
        <button type="button" className="operation-audio-key operation-audio-key--action" aria-label="Стереть" onClick={onBackspace}>⌫</button>
        <button type="button" className="operation-audio-key" aria-label="Следующая клетка" onClick={onNext}>→</button>
      </div>
    );
  }
  return (
    <div className="ws-keypad">
      <div className="operation-audio-keypad__grid">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((d) => (
          <button key={d} type="button" className="operation-audio-key" onClick={() => onKey(d)}>{d}</button>
        ))}
      </div>
      <div className="ws-keypad__controls">
        <button type="button" className="operation-audio-key operation-audio-key--action" aria-label="Стереть" onClick={onBackspace}>⌫</button>
        <button type="button" className="operation-audio-key" aria-label="Следующая клетка" onClick={onNext}>→</button>
      </div>
    </div>
  );
}

function Solve({ sheet, answers, setAnswers, onBack, onFinish }) {
  const [sectionIdx, setSectionIdx] = useState(0);
  const [focus, setFocus] = useState({ item: 0, blank: 0 });
  const listRef = useRef(null);
  const section = sheet.sections[sectionIdx];
  const blanksOf = (item) => item.tokens.filter((t) => t.t === "blank");
  const current = section.items[focus.item];
  const focusTok = current ? blanksOf(current).find((t) => t.i === focus.blank) : null;
  const maxDigits = String(section.maxNumber).length;

  useEffect(() => {
    listRef.current?.querySelector(".ws-blank--focus")?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  }, [focus, sectionIdx]);

  const valuesOf = (s, i) => answers[s]?.[i] ?? [];
  const setValue = (value) => {
    setAnswers((prev) => {
      const sec = [...(prev[sectionIdx] ?? [])];
      const vals = [...(sec[focus.item] ?? [])];
      vals[focus.blank] = value;
      sec[focus.item] = vals;
      return { ...prev, [sectionIdx]: sec };
    });
  };
  const next = () => {
    const blanks = blanksOf(current);
    const pos = blanks.findIndex((t) => t.i === focus.blank);
    if (pos + 1 < blanks.length) setFocus({ item: focus.item, blank: blanks[pos + 1].i });
    else if (focus.item + 1 < section.items.length) setFocus({ item: focus.item + 1, blank: blanksOf(section.items[focus.item + 1])[0].i });
  };
  const onKey = (k) => {
    if (!focusTok) return;
    if (focusTok.kind === "sign") { setValue(k); next(); return; }
    const raw = valuesOf(sectionIdx, focus.item)[focus.blank];
    const text = raw == null ? "" : String(raw);
    if (text.length >= maxDigits) return;
    setValue(Number(text + k));
  };
  const backspace = () => {
    const raw = valuesOf(sectionIdx, focus.item)[focus.blank];
    if (raw == null || raw === "") return;
    if (focusTok?.kind === "sign") { setValue(null); return; }
    const text = String(raw).slice(0, -1);
    setValue(text === "" ? null : Number(text));
  };
  const goSection = (i) => {
    setSectionIdx(i);
    setFocus({ item: 0, blank: blanksOf(sheet.sections[i].items[0])[0].i });
  };
  const filled = (s) => s.items.every((item, k) => blanksOf(item).every((t) => valuesOf(sheet.sections.indexOf(s), k)[t.i] != null));
  const isLast = sectionIdx === sheet.sections.length - 1;

  return (
    <div className="ws-screen ws-screen--solve">
      <div className="ws-progress" aria-label={`Раздел ${sectionIdx + 1} из ${sheet.sections.length}`}>
        {sheet.sections.map((s, i) => (
          <span key={i} style={{ flexGrow: s.items.length }} className={`ws-progress__bar${i < sectionIdx ? " ws-progress__bar--done" : i === sectionIdx ? " ws-progress__bar--now" : ""}`} />
        ))}
      </div>
      <div className="ws-solve__head">
        <SectionBadge type={section.type} size="lg" />
        <div>
          <span className="ws-solve__step">Раздел {sectionIdx + 1} из {sheet.sections.length}</span>
          <h2 className="ws-solve__title">{section.instruction}</h2>
        </div>
      </div>
      <ol className="ws-solve__list" ref={listRef}>
        {section.items.map((item, k) => (
          <li key={k} className={`ws-solve__row${focus.item === k ? " ws-solve__row--focus" : ""}`}>
            <span className="ws-solve__no">{k + 1}</span>
            <SheetItem item={item} values={valuesOf(sectionIdx, k)} focus={focus.item === k ? focus.blank : null} onFocus={(blank) => setFocus({ item: k, blank })} />
          </li>
        ))}
      </ol>
      <div className="ws-solve__bottom">
        <Keypad kind={focusTok?.kind ?? "num"} onKey={onKey} onBackspace={backspace} onNext={next} />
        <div className="ws-solve__nav">
          <button type="button" className="ws-btn ws-btn--ghost" onClick={() => (sectionIdx === 0 ? onBack() : goSection(sectionIdx - 1))}>{sectionIdx === 0 ? "← Настройки" : "← Назад"}</button>
          {isLast ? (
            <button type="button" className="ws-btn ws-btn--primary" onClick={onFinish}>{sheet.sections.every(filled) ? "Проверить" : "Проверить (есть пустые)"}</button>
          ) : (
            <button type="button" className="ws-btn ws-btn--primary" onClick={() => goSection(sectionIdx + 1)}>Дальше →</button>
          )}
        </div>
      </div>
    </div>
  );
}

function Results({ sheet, answers, onAgain, onDone }) {
  const pdf = usePdf(sheet);
  const per = sheet.sections.map((s, si) => {
    const right = s.items.filter((item, k) => itemCorrect(item, answers[si]?.[k] ?? [])).length;
    return { section: s, si, right, total: s.items.length };
  });
  const score = per.reduce((n, p) => n + p.right, 0);
  const mistakes = per.flatMap(({ section, si }) => section.items
    .map((item, k) => ({ item, k, si, values: answers[si]?.[k] ?? [] }))
    .filter((m) => !itemCorrect(m.item, m.values)));
  const weakest = per.filter((p) => p.right < p.total).sort((a, b) => a.right / a.total - b.right / b.total)[0];

  return (
    <div className="ws-screen ws-screen--results">
      <div className="ws-results">
        <div className="ws-results__score">
          <span className="ws-results__title">{sheet.title}</span>
          <div className="ws-results__big">{score} <span>из {sheet.total}</span></div>
        </div>
        <ul className="ws-results__sections">
          {per.map(({ section, si, right, total }) => (
            <li key={si} className={right < total ? "ws-results__sec--miss" : ""}>
              <SectionBadge type={section.type} size="sm" />
              <span className="ws-section__text"><b>{section.title}</b><span>{right === total ? "все верно" : `ошибок: ${total - right}`}</span></span>
              <b className="ws-results__frac">{right}/{total}</b>
            </li>
          ))}
        </ul>
        {mistakes.length > 0 && (
          <div className="ws-results__mistakes">
            <span className="ws-results__label">Ошибки</span>
            {mistakes.map((m) => (
              <div key={`${m.si}-${m.k}`} className="ws-results__mistake">
                <span className="ws-solve__no">{m.si + 1}.{m.k + 1}</span>
                <SheetItem item={m.item} values={m.values} review />
              </div>
            ))}
            {weakest && <p className="ws-results__tip">Стоит повторить режим «{weakest.section.title}».</p>}
          </div>
        )}
      </div>
      <div className="ws-actions">
        <PdfButton pdf={pdf} label="Лист с ответами (PDF)" />
        <button type="button" className="ws-btn ws-btn--ghost" onClick={onAgain}>Новая контрольная</button>
        <button type="button" className="ws-btn ws-btn--primary" onClick={onDone}>Готово</button>
      </div>
    </div>
  );
}

export default function WorksheetMode({ task, onCorrect, student, accountKv }) {
  const [config, setConfigState] = useState(() => normalizeConfig(loadLocal()?.config));
  const [phase, setPhase] = useState("build");
  const [answers, setAnswers] = useState({});
  const [showReward, setShowReward] = useState(false);
  const sheet = useMemo(() => buildWorksheet(config), [config]);

  // The account's copy wins when it is newer than the device's.
  useEffect(() => {
    let alive = true;
    accountKv?.list?.(KV_KEY).then((rows) => {
      const doc = rows?.find((r) => r.key === KV_KEY)?.value;
      const local = loadLocal();
      if (alive && doc?.config && (!local || (doc.savedAt ?? 0) > (local.savedAt ?? 0))) {
        setConfigState(normalizeConfig(doc.config));
        saveLocal(doc);
      }
    }).catch(() => { /* offline or signed out: the device's copy */ });
    return () => { alive = false; };
  }, [accountKv]);

  const setConfig = useCallback((next) => {
    const c = normalizeConfig(next);
    setConfigState(c);
    const doc = { config: c, savedAt: Date.now() };
    saveLocal(doc);
    try { accountKv?.put?.(KV_KEY, doc); } catch { /* queued later */ }
  }, [accountKv]);

  const finish = useCallback(() => {
    setShowReward(false);
    onCorrect?.(task.conceptId, task.cardId);
  }, [onCorrect, task.conceptId, task.cardId]);

  if (showReward) {
    return <RewardVideoModal rewardVideos={student?.rewardVideos ?? []} studentId={student?.id} onDismiss={finish} />;
  }
  if (phase === "solve") {
    return <Solve sheet={sheet} answers={answers} setAnswers={setAnswers} onBack={() => setPhase("build")} onFinish={() => setPhase("results")} />;
  }
  if (phase === "results") {
    return (
      <Results
        sheet={sheet}
        answers={answers}
        onAgain={() => { setAnswers({}); setConfig({ ...config, seed: config.seed + 1 }); setPhase("build"); }}
        onDone={() => setShowReward(true)}
      />
    );
  }
  return <Builder config={config} setConfig={setConfig} sheet={sheet} onStart={() => { setAnswers({}); setPhase("solve"); }} />;
}
