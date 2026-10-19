import { setupText, setupLabels } from "@/shared/i18n/setupText.js";
import { getInterfaceTopicTitle } from "@/shared/i18n/topicTitles.js";
import { useUiTranslation } from "@/shared/i18n/useUiTranslation.js";
import { translateUi as tr } from "@/shared/i18n/uiLanguage.js";
import { useEffect, useMemo, useState } from "react";
import { useAppStore } from "@/core/store";
import { api } from "@/core/api";
import { flushQueue } from "@/core/syncApi";
import { aggregateStatistics } from "../../../shared/session-statistics.mjs";
import { formatDate } from "@/shared/utils/format";
import { BackArrowIcon } from "@/shared/components/ArrowIcons";
import "./statistics.css";
import { restoreHistoricalSessions } from "./restoreHistoricalSessions";

const text = value => typeof value === "string" ? value : value?.ru ?? "";
const valueLabels = () => ({ easy: tr("stats.easy"), correct: tr("stats.correct"), prompted: tr("stats.prompted"), fail: tr("stats.fail"), independent: tr("stats.independent"), after_model: tr("stats.afterModel"), none: tr("stats.noAnswer"), starter: tr("stats.starter"), reinforce: tr("stats.reinforce"), challenge: tr("stats.challenge"), medium: tr("stats.medium"), hard: tr("stats.hard"), training: tr("stats.training"), check: tr("stats.check"), trained: tr("stats.trained"), transfer: tr("stats.transfer"), model: tr("stats.model"), answer: tr("stats.answer"), phrase: tr("stats.phrase"), dots: tr("setup.dots"), more: tr("setup.more"), less: tr("setup.less") });
const paramLabels = () => ({ optionCount: tr("stats.options"), distractorLevel: tr("stats.distractorLevel"), figureDifficulty: tr("stats.figureLevel"), activityStage: tr("stats.stage"), materialSet: tr("stats.material"), introStage: tr("stats.introStage"), showImage: tr("stats.picture"), showLabels: tr("stats.labels"), showHint: tr("stats.hint"), hintMode: tr("stats.hint"), questionHint: tr("stats.questionHint"), level: tr("setup.level"), visualMode: tr("stats.support"), question: tr("stats.question"), repsPerConcept: tr("stats.repetitions"), examplesCount: tr("stats.examples") });
const labelValue = value => typeof value === "boolean" ? value ? tr("stats.yes") : tr("common.no") : Array.isArray(value) ? value.map(labelValue).join(", ") : valueLabels()[value] ?? String(value ?? "—");
const score = (correct, total) => total ? tr("stats.score", { percent: Math.round(correct / total * 100), correct, total }) : tr("stats.noAssessed");
const lessonCount = count => tr("stats.lessonCount", { count });

function SessionTiming({ session, timeZone }) {
  const { t: tr, language } = useUiTranslation();
  const at = Number.isFinite(Date.parse(session.startedAt)) ? session.startedAt : session.completedAt;
  const withTime = /[T ]\d{2}:\d{2}/.test(at);
  const date = new Intl.DateTimeFormat(language === "sl" ? "sl-SI" : "ru-RU", { day: "numeric", month: "short", year: "numeric",
    timeZone: withTime ? timeZone : "UTC", ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(new Date(at));
  const active = Number.isFinite(session.activeDurationMs) && session.activeDurationMs >= 0;
  const duration = active ? session.activeDurationMs : session.elapsedDurationMs;
  let formattedDuration = null;
  if (Number.isFinite(duration) && duration >= 0) {
    const seconds = duration > 0 ? Math.max(1, Math.round(duration / 1000)) : 0;
    formattedDuration = [seconds >= 3600 ? tr("stats.hours", { count: Math.floor(seconds / 3600) }) : null,
      seconds >= 60 && Math.floor(seconds / 60) % 60 ? tr("stats.minutes", { count: Math.floor(seconds / 60) % 60 }) : null,
      seconds % 60 || seconds === 0 ? tr("stats.seconds", { count: seconds % 60 }) : null].filter(Boolean).join(" ");
  }
  return <span><time dateTime={at}>{date}</time>{formattedDuration != null && <> · <span title={active ? tr("stats.activeDurationTitle") : tr("stats.elapsedDurationTitle")}>{formattedDuration}{!active && tr("stats.withPauses")}</span></>}</span>;
}

function Conditions({ group, topic }) {
  const { t: tr } = useUiTranslation();
  if (!group.conditions) return <p className="statistics-note">{tr("stats.conditionsMissing")}</p>;
  const definitions = topic?.modes?.find(mode => mode.id === group.modeId)?.params ?? {};
  const entries = Object.entries(group.conditions.params ?? {});
  const visible = entries.filter(([key]) => paramLabels()[key] || setupText(definitions[key]?.label));
  const displayValue = (key, value) => setupLabels(definitions[key]?.labels)?.[value] ?? (key === "distractorLevel" ? { easy: tr("stats.low"), medium: tr("stats.medium"), hard: tr("stats.high") }[value] ?? labelValue(value) : labelValue(value));
  const selectedText = topic?.texts?.find(item => item.id === group.conditions.textId);
  const material = (group.conditions.conceptIds ?? []).map(id => {
    const card = topic?.cards?.find(item => item.conceptId === id || item.id === id);
    return text(card?.label) || text(card?.title);
  }).filter(Boolean);
  return <>
    {group.conditions.historical && <p className="statistics-note">{tr("stats.historicalConditions")}</p>}
    <div className="statistics-tags">{visible.slice(0, 4).map(([key, value]) => <span key={key}>{setupText(definitions[key]?.label) || paramLabels()[key]}: {displayValue(key, value)}</span>)}
      {group.conditions.optionCounts?.length > 0 && <span>{tr("stats.actualOptions", { options: group.conditions.optionCounts.join(", ") })}</span>}
    </div>
    <details className="statistics-conditions"><summary>{tr("stats.conditions")}</summary>
      <p>{tr("stats.materialVersion", { version: group.topicVersion })} · {Array.isArray(group.conditions.conceptIds) ? tr("stats.conceptCount", { count: group.conditions.conceptIds.length }) : tr("stats.setMissing")}</p>
      {selectedText && <p>{tr("stats.text", { title: text(selectedText.title) || selectedText.id })}</p>}
      {material.length > 0 && <p>{tr("stats.materialList", { material: material.join(", ") })}</p>}
      {visible.map(([key, value]) => <div key={key}>{setupText(definitions[key]?.label) || paramLabels()[key]}: {displayValue(key, value)}</div>)}
      <p>{group.conditions.historical ? tr("stats.historicalGrouping") : tr("stats.comparisonGrouping")}{" "}{tr("stats.assistanceExplicit")}</p>
    </details>
  </>;
}

function GroupCard({ group, topic }) {
  const { t: tr } = useUiTranslation();
  const totals = group.totals;
  const mode = topic?.modes?.find(item => item.id === group.modeId);
  const trend = group.trend.filter(point => point.firstTotal > 0);
  const difficulties = Object.entries(group.concepts).filter(([, counts]) => counts.total >= 3 && counts.correct < counts.total).sort((a, b) => a[1].correct / a[1].total - b[1].correct / b[1].total).slice(0, 5);
  function conceptLabel(id) {
    const card = topic?.cards?.find(item => item.conceptId === id || item.id === id);
    return text(card?.label) || text(card?.title) || id;
  }
  return <article className="statistics-group">
    <div className="statistics-group-heading"><h2>{setupText(mode?.ui?.title) || setupText(mode?.title) || group.modeId}</h2><span>{lessonCount(totals.sessions)}</span></div>
    <Conditions group={group} topic={topic} />
    {totals.firstTotal > 0 ? <>
      <p className="statistics-score"><span>{tr("stats.firstAnswer")}</span><strong>{score(totals.firstCorrect, totals.firstTotal)}</strong></p>
      {totals.recoveredResponseSessions > 0 && <p className="statistics-note">{tr("stats.recoveredEvents", { lessons: lessonCount(totals.recoveredResponseSessions) })}</p>}
      <p className="statistics-note">{tr("stats.corrected", { count: totals.corrected })} {totals.recoveredSessions > 0 ? tr("stats.assistanceMissing") : tr("stats.assisted", { count: totals.assisted })}</p>
      <p className="statistics-note">{tr("stats.unmarkedAssistance")}</p>
    </> : totals.assessedSessions > 0 ? <>
      <p className="statistics-score"><span>{tr("stats.correctActions")}</span><strong>{score(totals.correctActions, totals.correctActions + totals.incorrectActions)}</strong></p>
      <p className="statistics-note">{tr("stats.actionHelp")}</p>
    </> : <p className="statistics-note">{tr("stats.unassessed")}</p>}
    {Object.keys(totals.quality).length > 0 && <div className="statistics-quality"><strong>{tr("stats.adultRatings")}</strong>{Object.entries(totals.quality).map(([quality, count]) => <span key={quality}>{valueLabels()[quality] ?? quality}: {count}</span>)}</div>}
    {trend.length > 0 && <details open={trend.length > 1}><summary>{totals.recoveredResponseSessions > 0 ? tr("stats.recoveredResults") : tr("stats.recentComparable")}</summary>
      <ol className="statistics-trend">{trend.map(point => <li key={point.id}><time>{formatDate(point.completedAt)}</time><meter min="0" max="100" value={point.firstCorrect / point.firstTotal * 100} aria-label={`${formatDate(point.completedAt)}: ${score(point.firstCorrect, point.firstTotal)}`} /><span>{score(point.firstCorrect, point.firstTotal)}</span></li>)}</ol>
    </details>}
    {difficulties.length > 0 && <details><summary>{tr("stats.difficultConcepts")}</summary><ul>{difficulties.map(([id, counts]) => <li key={id}>{conceptLabel(id)}: {tr("stats.ratio", { count: counts.total - counts.correct, total: counts.total })}</li>)}</ul></details>}
  </article>;
}

export default function StatisticsScreen({ initialTopicId = null, onClose, embedded = false }) {
  const { t: tr } = useUiTranslation();
  const students = useAppStore(state => state.students);
  const activeStudentId = useAppStore(state => state.activeStudentId);
  const sessions = useAppStore(state => state.sessions);
  const topics = useAppStore(state => state.topicRecords);
  const token = useAppStore(state => state.token);
  const accountId = useAppStore(state => state.account?.id);
  const [studentId, setStudentId] = useState(activeStudentId ?? students[0]?.id ?? "");
  const [topicId, setTopicId] = useState(initialTopicId);
  const [period, setPeriod] = useState("30");
  const [revision, setRevision] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [remote, setRemote] = useState(null);
  const [timeZone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
  const since = useMemo(() => period === "all" ? null : new Date(now - Number(period) * 86400000).toISOString(), [period, now]);
  const queryKey = JSON.stringify([accountId, studentId, topicId, since, revision, timeZone]);
  const status = !token || !studentId ? "local" : remote?.key === queryKey ? remote.status : "loading";
  const local = useMemo(() => aggregateStatistics(sessions, { studentId, topicId, since, timeZone }), [sessions, studentId, topicId, since, timeZone]);
  useEffect(() => {
    let cancelled = false;
    if (!token || !studentId) return;
    const query = new URLSearchParams({ studentId });
    if (topicId) query.set("topicId", topicId);
    if (since) query.set("since", since);
    query.set("timeZone", timeZone);
    (async () => {
      await flushQueue();
      await restoreHistoricalSessions(accountId, token);
      const report = await api.get(`/statistics?${query}`);
      if (!cancelled) setRemote({ key: queryKey, report, status: "server" });
    })().catch(() => { if (!cancelled) setRemote({ key: queryKey, status: "offline" }); });
    return () => { cancelled = true; };
  }, [token, studentId, topicId, since, queryKey, timeZone, accountId]);
  const report = remote?.key === queryKey && status === "server" ? remote.report : local;
  const topic = topics.find(item => item.meta.id === topicId);
  const title = id => getInterfaceTopicTitle(id, topics.find(item => item.meta.id === id)?.meta.title) || id;
  function topicResult(id) {
    const group = report.groups.filter(item => item.topicId === id && item.conditions).sort((a, b) => (b.trend.at(-1)?.completedAt ?? "").localeCompare(a.trend.at(-1)?.completedAt ?? ""))[0];
    if (!group?.totals.firstTotal) return null;
    const record = topics.find(item => item.meta.id === id);
    const mode = record?.modes?.find(item => item.id === group.modeId);
    const choices = group.conditions.optionCounts?.length ? ` · ${tr("stats.optionList", { options: group.conditions.optionCounts.join(", ") })}` : "";
    return <span className="statistics-topic-result">{group.conditions.historical ? tr("stats.oldHistory") : tr("stats.recentConditions")}: {setupText(mode?.ui?.title) || group.modeId}{choices} · {tr("stats.firstAnswerResult", { score: score(group.totals.firstCorrect, group.totals.firstTotal) })}</span>;
  }
  const total = report.totals;
  return <div className={embedded ? "statistics-screen statistics-screen--embedded" : "screen statistics-screen"}>
    <div className="screen-header"><button className="back-btn" onClick={() => topicId && !initialTopicId ? setTopicId(null) : onClose()} aria-label={tr("common.back")}><BackArrowIcon /></button><h1 className="screen-title">{topicId ? title(topicId) : tr("nav.studentStatistics")}</h1><button className="header-action-btn statistics-refresh" onClick={() => { setNow(Date.now()); setRevision(value => value + 1); }}>{tr("analytics.refresh")}</button></div>
    <div className="statistics-content">
      <div className="statistics-filters"><label>{tr("stats.student")}<select value={studentId} onChange={event => setStudentId(event.target.value)}><option value="" disabled>{tr("home.chooseStudent")}</option>{students.map(student => <option key={student.id} value={student.id}>{student.name}</option>)}</select></label><label>{tr("stats.period")}<select value={period} onChange={event => setPeriod(event.target.value)}><option value="7">{tr("stats.lastWeek")}</option><option value="30">{tr("stats.lastMonth")}</option><option value="all">{tr("stats.allTime")}</option></select></label></div>
      <p className="statistics-note" role="status">{status === "loading" ? tr("stats.loading") : status === "server" ? tr("stats.server") : status === "offline" ? tr("stats.offline") : tr("stats.local")}</p>
      {!studentId ? <p className="empty-state">{tr("stats.noStudent")}</p> : total.sessions === 0 ? <p className="empty-state">{tr("stats.empty")}</p> : <>
        <div className="statistics-overview"><div><strong>{total.sessions}</strong><span>{tr("stats.lessonsLabel")}</span></div><div><strong>{report.activeDays}</strong><span>{tr("stats.practiceDays")}</span></div><div><strong>{total.timedSessions ? Math.round(total.activeDurationMs / 60000) : "—"}</strong><span>{tr("stats.activeMinutes")}</span></div><div><strong>{total.completedSeries}</strong><span>{tr("stats.completedSeries")}</span></div></div>
        {total.checkpointSessions > 0 && <p className="statistics-note">{tr("stats.checkpoints", { count: total.checkpointSessions })}</p>}
        {total.snapshotRecoveredSessions > 0 && <p className="statistics-note">{tr("stats.snapshots", { count: total.snapshotRecoveredSessions })}</p>}
        {total.recoveredSessions > 0 && <p className="statistics-note">{tr("stats.recoveredHistory", { lessons: lessonCount(total.recoveredSessions), responses: total.recoveredResponseSessions, settings: total.savedSettingsSessions })}</p>}
        {topicId ? <div className="statistics-groups">{report.groups.map(group => <GroupCard key={group.key} group={group} topic={topic} />)}</div> : <>
          <p className="statistics-note">{tr("stats.noCombinedPercent")}</p>
          <div className="statistics-topics">{report.topics.map(item => <button key={item.topicId} onClick={() => setTopicId(item.topicId)}><strong>{title(item.topicId)}</strong><span>{lessonCount(item.totals.sessions)} · {formatDate(item.lastAt)} →</span>{topicResult(item.topicId)}</button>)}</div>
        </>}
        <details className="statistics-history"><summary>{tr("stats.recentCount", { count: report.recent.length })}</summary><ul>{report.recent.map(item => <li key={item.id}><span>{title(item.topicId)} · {setupText(topics.find(record => record.meta.id === item.topicId)?.modes?.find(mode => mode.id === item.modeId)?.ui?.title) || item.modeId}</span><SessionTiming session={item} timeZone={timeZone} /></li>)}</ul></details>
      </>}
    </div>
  </div>;
}
