import { useEffect, useMemo, useState } from "react";
import { useAppStore } from "@/core/store";
import { api } from "@/core/api";
import { flushQueue } from "@/core/syncApi";
import { aggregateStatistics } from "../../../shared/session-statistics.mjs";
import { getTopicTitle, formatDate } from "@/shared/utils/format";
import { BackArrowIcon } from "@/shared/components/ArrowIcons";
import "./statistics.css";
import { restoreHistoricalSessions } from "./restoreHistoricalSessions";

const text = value => typeof value === "string" ? value : value?.ru ?? "";
const valueLabels = { easy: "Легко", correct: "Правильно", prompted: "С подсказкой", fail: "Не получилось", independent: "Самостоятельно", after_model: "После образца", none: "Нет ответа", starter: "Начальный", reinforce: "Закрепление", challenge: "Усложнение", medium: "Средняя", hard: "Сложная", training: "Тренировка", check: "Проверка", trained: "Знакомый материал", transfer: "Новый материал", model: "Образец", answer: "Самостоятельный ответ", phrase: "Фраза", dots: "Точки", more: "Больше", less: "Меньше" };
const paramLabels = { optionCount: "Вариантов", distractorLevel: "Похожесть вариантов", figureDifficulty: "Уровень фигур", activityStage: "Этап", materialSet: "Материал", introStage: "Этап знакомства", showImage: "Картинка", showLabels: "Подписи", showHint: "Подсказка", hintMode: "Подсказка", questionHint: "Подсказка вопроса", level: "Уровень", visualMode: "Опора", question: "Вопрос", repsPerConcept: "Повторов на понятие", examplesCount: "Примеров" };
const labelValue = value => typeof value === "boolean" ? value ? "Да" : "Нет" : Array.isArray(value) ? value.map(labelValue).join(", ") : valueLabels[value] ?? String(value ?? "—");
const score = (correct, total) => total ? `${Math.round(correct / total * 100)}% · ${correct} из ${total}` : "Нет оцененных ответов";
const completionLabels = { series_completed: "Серия завершена", manual: "Завершено вручную", interrupted: "Прервано", checkpoint: "Промежуточный результат сохранен" };
const lessonCount = count => `${count} ${count % 10 === 1 && count % 100 !== 11 ? "занятие" : count % 10 >= 2 && count % 10 <= 4 && !(count % 100 >= 12 && count % 100 <= 14) ? "занятия" : "занятий"}`;

function Conditions({ group, topic }) {
  if (!group.conditions) return <p className="statistics-note">Условия не сохранены. Эти результаты не смешиваются с новой статистикой.</p>;
  const definitions = topic?.modes?.find(mode => mode.id === group.modeId)?.params ?? {};
  const entries = Object.entries(group.conditions.params ?? {});
  const visible = entries.filter(([key]) => paramLabels[key] || text(definitions[key]?.label));
  const displayValue = (key, value) => definitions[key]?.labels?.ru?.[value] ?? (key === "distractorLevel" ? { easy: "Низкая", medium: "Средняя", hard: "Высокая" }[value] ?? labelValue(value) : labelValue(value));
  const selectedText = topic?.texts?.find(item => item.id === group.conditions.textId);
  const material = (group.conditions.conceptIds ?? []).map(id => {
    const card = topic?.cards?.find(item => item.conceptId === id || item.id === id);
    return text(card?.label) || text(card?.title);
  }).filter(Boolean);
  return <>
    {group.conditions.historical && <p className="statistics-note">Восстановлены сохраненные настройки. Полный набор условий неизвестен; результаты отделены от новых измерений.</p>}
    <div className="statistics-tags">{visible.slice(0, 4).map(([key, value]) => <span key={key}>{text(definitions[key]?.label) || paramLabels[key]}: {displayValue(key, value)}</span>)}
      {group.conditions.optionCounts?.length > 0 && <span>Фактически вариантов: {group.conditions.optionCounts.join(", ")}</span>}
    </div>
    <details className="statistics-conditions"><summary>Условия и материал</summary>
      <p>Версия материала: {group.topicVersion} · {Array.isArray(group.conditions.conceptIds) ? `Понятий в наборе: ${group.conditions.conceptIds.length}` : "Набор материала не сохранен"}</p>
      {selectedText && <p>Текст: {text(selectedText.title) || selectedText.id}</p>}
      {material.length > 0 && <p>Материал: {material.join(", ")}</p>}
      {visible.map(([key, value]) => <div key={key}>{text(definitions[key]?.label) || paramLabels[key]}: {displayValue(key, value)}</div>)}
      <p>{group.conditions.historical ? "Сгруппированы только известные настройки. Неизвестные параметры не восстановлены из текущих настроек темы." : "Сравниваются занятия с одинаковым режимом, набором материала и настройками задания."} Помощь взрослого учитывается только при явной оценке.</p>
    </details>
  </>;
}

function GroupCard({ group, topic }) {
  const totals = group.totals;
  const mode = topic?.modes?.find(item => item.id === group.modeId);
  const trend = group.trend.filter(point => point.firstTotal > 0);
  const difficulties = Object.entries(group.concepts).filter(([, counts]) => counts.total >= 3 && counts.correct < counts.total).sort((a, b) => a[1].correct / a[1].total - b[1].correct / b[1].total).slice(0, 5);
  function conceptLabel(id) {
    const card = topic?.cards?.find(item => item.conceptId === id || item.id === id);
    return text(card?.label) || text(card?.title) || id;
  }
  return <article className="statistics-group">
    <div className="statistics-group-heading"><h2>{text(mode?.ui?.title) || text(mode?.title) || group.modeId}</h2><span>{lessonCount(totals.sessions)}</span></div>
    <Conditions group={group} topic={topic} />
    {totals.firstTotal > 0 ? <>
      <p className="statistics-score"><span>С первого ответа</span><strong>{score(totals.firstCorrect, totals.firstTotal)}</strong></p>
      {totals.recoveredResponseSessions > 0 && <p className="statistics-note">Восстановлено по событиям {lessonCount(totals.recoveredResponseSessions)}: нажатия полностью сходятся с итоговыми счетчиками. Условия и помощь могли учитываться не полностью.</p>}
      <p className="statistics-note">После ошибки исправлено: {totals.corrected}. {totals.recoveredSessions > 0 ? "Учет помощи для этих ответов не восстановлен." : `Завершено с отмеченной помощью: ${totals.assisted}.`}</p>
      <p className="statistics-note">Внешняя помощь без отметки не определяется автоматически.</p>
    </> : totals.assessedSessions > 0 ? <>
      <p className="statistics-score"><span>Доля верных действий</span><strong>{score(totals.correctActions, totals.correctActions + totals.incorrectActions)}</strong></p>
      <p className="statistics-note">Учитываются повторные попытки и отдельные шаги. Показатель первого ответа для этих занятий недоступен.</p>
    </> : <p className="statistics-note">Практика без автоматической оценки правильности.</p>}
    {Object.keys(totals.quality).length > 0 && <div className="statistics-quality"><strong>Оценки взрослого</strong>{Object.entries(totals.quality).map(([quality, count]) => <span key={quality}>{valueLabels[quality] ?? quality}: {count}</span>)}</div>}
    {trend.length > 0 && <details open={trend.length > 1}><summary>{totals.recoveredResponseSessions > 0 ? "Результаты по сохранившимся событиям" : "Последние сопоставимые занятия"}</summary>
      <ol className="statistics-trend">{trend.map(point => <li key={point.id}><time>{formatDate(point.completedAt)}</time><meter min="0" max="100" value={point.firstCorrect / point.firstTotal * 100} aria-label={`${formatDate(point.completedAt)}: ${score(point.firstCorrect, point.firstTotal)}`} /><span>{score(point.firstCorrect, point.firstTotal)}</span></li>)}</ol>
    </details>}
    {difficulties.length > 0 && <details><summary>Где чаще возникали ошибки первого ответа</summary><ul>{difficulties.map(([id, counts]) => <li key={id}>{conceptLabel(id)}: {counts.total - counts.correct} из {counts.total}</li>)}</ul></details>}
  </article>;
}

export default function StatisticsScreen({ initialTopicId = null, onClose, embedded = false }) {
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
  const title = id => getTopicTitle(topics.find(item => item.meta.id === id)?.meta.title) || id;
  function topicResult(id) {
    const group = report.groups.filter(item => item.topicId === id && item.conditions).sort((a, b) => (b.trend.at(-1)?.completedAt ?? "").localeCompare(a.trend.at(-1)?.completedAt ?? ""))[0];
    if (!group?.totals.firstTotal) return null;
    const record = topics.find(item => item.meta.id === id);
    const mode = record?.modes?.find(item => item.id === group.modeId);
    const choices = group.conditions.optionCounts?.length ? ` · вариантов: ${group.conditions.optionCounts.join(", ")}` : "";
    return <span className="statistics-topic-result">{group.conditions.historical ? "Из старой истории" : "В последних использованных условиях"}: {text(mode?.ui?.title) || group.modeId}{choices} · с первого ответа {score(group.totals.firstCorrect, group.totals.firstTotal)}</span>;
  }
  const total = report.totals;
  return <div className={embedded ? "statistics-screen statistics-screen--embedded" : "screen statistics-screen"}>
    <div className="screen-header"><button className="back-btn" onClick={() => topicId && !initialTopicId ? setTopicId(null) : onClose()} aria-label="Назад"><BackArrowIcon /></button><h1 className="screen-title">{topicId ? title(topicId) : "Статистика ученика"}</h1><button className="header-action-btn statistics-refresh" onClick={() => { setNow(Date.now()); setRevision(value => value + 1); }}>Обновить</button></div>
    <div className="statistics-content">
      <div className="statistics-filters"><label>Ученик<select value={studentId} onChange={event => setStudentId(event.target.value)}><option value="" disabled>Выберите ученика</option>{students.map(student => <option key={student.id} value={student.id}>{student.name}</option>)}</select></label><label>Период<select value={period} onChange={event => setPeriod(event.target.value)}><option value="7">Последние 7 дней</option><option value="30">Последние 30 дней</option><option value="all">Все время</option></select></label></div>
      <p className="statistics-note" role="status">{status === "loading" ? "Обновляем сводку… Пока показаны сохраненные на устройстве занятия." : status === "server" ? "Сводка по всем синхронизированным занятиям за выбранный период." : status === "offline" ? "Сервер недоступен. Показаны только занятия на этом устройстве; история может быть неполной." : "Показаны сохраненные на этом устройстве занятия. Более ранняя история может быть неполной."}</p>
      {!studentId ? <p className="empty-state">Добавьте или выберите ученика, чтобы увидеть статистику.</p> : total.sessions === 0 ? <p className="empty-state">За выбранный период занятий нет.</p> : <>
        <div className="statistics-overview"><div><strong>{total.sessions}</strong><span>занятий</span></div><div><strong>{report.activeDays}</strong><span>дней практики</span></div><div><strong>{total.timedSessions ? Math.round(total.activeDurationMs / 60000) : "—"}</strong><span>активных минут</span></div><div><strong>{total.completedSeries}</strong><span>завершенных серий</span></div></div>
        <p className="statistics-note">Завершено вручную: {total.manualSessions}. Для старых занятий причина завершения и время могут быть неизвестны.</p>
        {total.checkpointSessions > 0 && <p className="statistics-note">Занятий с автоматически сохраненным промежуточным результатом: {total.checkpointSessions}. Они учитываются, даже если занятие не завершили.</p>}
        {total.snapshotRecoveredSessions > 0 && <p className="statistics-note">Из состояния незавершенного занятия восстановлено: {total.snapshotRecoveredSessions}. Дата соответствует последнему сохранению; распределение старых ответов по дням неизвестно.</p>}
        {total.recoveredSessions > 0 && <p className="statistics-note">Из старой истории восстановлено: {lessonCount(total.recoveredSessions)}. Первые ответы — в {total.recoveredResponseSessions}, сохраненные настройки — в {total.savedSettingsSessions}. История без достаточных данных показана без предположений.</p>}
        {topicId ? <div className="statistics-groups">{report.groups.map(group => <GroupCard key={group.key} group={group} topic={topic} />)}</div> : <>
          <p className="statistics-note">Результаты разных тем и условий не объединяются в общий процент. Откройте тему, чтобы увидеть ответы и динамику.</p>
          <div className="statistics-topics">{report.topics.map(item => <button key={item.topicId} onClick={() => setTopicId(item.topicId)}><strong>{title(item.topicId)}</strong><span>{lessonCount(item.totals.sessions)} · {formatDate(item.lastAt)} →</span>{topicResult(item.topicId)}</button>)}</div>
        </>}
        <details className="statistics-history"><summary>Последние занятия ({report.recent.length})</summary><ul>{report.recent.map(item => <li key={item.id}><span>{title(item.topicId)} · {text(topics.find(record => record.meta.id === item.topicId)?.modes?.find(mode => mode.id === item.modeId)?.ui?.title) || item.modeId}</span><span>{formatDate(item.completedAt)} · {completionLabels[item.completionReason] ?? "Причина завершения не сохранена"}</span></li>)}</ul></details>
      </>}
    </div>
  </div>;
}
