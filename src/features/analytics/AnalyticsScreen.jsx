import { useState, useEffect } from "react";
import { api } from "@/core/api";
import { flushQueue } from "@/core/syncApi";

const HYPOTHESIS_COLOR = {
  "усваивает":  "#43a047",
  "в процессе": "#f57c00",
  "угадывает":  "#c62828",
};

const STATUS_LABEL = {
  mastered: "усвоена",
  learning: "в процессе",
  guessing: "угадывает",
};

const STATUS_COLOR = {
  mastered: "#43a047",
  learning: "#f57c00",
  guessing: "#c62828",
};

export function AnalyticsScreen({ studentId, topicId, topicTitle, onClose }) {
  const [report,  setReport]  = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const [empty,   setEmpty]   = useState(false);

  useEffect(() => { loadCached(); }, [studentId, topicId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadCached() {
    try {
      const data = await api.get(`/analysis/topic?studentId=${studentId}&topicId=${topicId}`);
      if (data) setReport(data);
      else setEmpty(true);
    } catch (e) {
      if (e.status === 404) setEmpty(true);
      else setError(e.message);
    }
  }

  async function handleRefresh() {
    setLoading(true);
    setError(null);
    try {
      await flushQueue();
      await api.delete(`/analysis/topic?studentId=${studentId}&topicId=${topicId}`);
      const data = await api.post("/analysis/topic", { studentId, topicId });
      setReport(data);
      setEmpty(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.screen}>
      <div style={styles.header}>
        <button onClick={onClose} style={styles.closeBtn}>←</button>
        <div style={styles.headerTitle}>
          <span style={styles.topicTitle}>{topicTitle}</span>
          {report?.generated_at && (
            <span style={styles.updatedAt}>
              Обновлено {new Date(report.generated_at).toLocaleDateString("ru")}
            </span>
          )}
        </div>
        <button onClick={handleRefresh} disabled={loading} style={styles.refreshBtn}>
          {loading ? "…" : report ? "Обновить" : "Сформировать"}
        </button>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {empty && !loading && (
        <div style={styles.empty}>
          Нажми «Сформировать» чтобы получить первый отчёт
        </div>
      )}

      {report && <ReportBody report={report} />}
    </div>
  );
}

function ReportBody({ report }) {
  const color = HYPOTHESIS_COLOR[report.hypothesis] ?? "#888";
  return (
    <div style={styles.body}>
      <div style={styles.hypothesisRow}>
        <div style={{ ...styles.dot, background: color }} />
        <span style={styles.hypothesisText}>
          {report.hypothesis} · {Math.round((report.confidence ?? 0) * 100)}% уверенность
        </span>
      </div>

      {report.summary && <p style={styles.summary}>{report.summary}</p>}

      <div style={styles.sectionLabel}>Карточки</div>
      {report.cards?.map((card) => (
        <CardRow key={card.card_id} card={card} />
      ))}
    </div>
  );
}

function CardRow({ card }) {
  const color = STATUS_COLOR[card.status] ?? "#888";
  return (
    <div style={styles.cardRow}>
      <span style={styles.cardId}>{card.card_id}</span>
      <span style={{ ...styles.statusLabel, color }}>{STATUS_LABEL[card.status] ?? card.status}</span>
      {card.note && <span style={styles.cardNote}>{card.note}</span>}
    </div>
  );
}

const styles = {
  screen:        { display: "flex", flexDirection: "column", height: "100%", background: "#fff" },
  header:        { display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", borderBottom: "1px solid #eee" },
  closeBtn:      { fontSize: 18, background: "none", border: "none", cursor: "pointer", padding: "4px 8px" },
  headerTitle:   { flex: 1, display: "flex", flexDirection: "column" },
  topicTitle:    { fontWeight: 600, fontSize: 15 },
  updatedAt:     { fontSize: 11, color: "#aaa" },
  refreshBtn:    { fontSize: 13, padding: "6px 14px", borderRadius: 8, border: "1px solid #ddd", cursor: "pointer", background: "#f5f5f5" },
  error:         { padding: "12px 16px", color: "#c62828", fontSize: 13 },
  empty:         { padding: "48px 16px", textAlign: "center", color: "#aaa", fontSize: 14 },
  body:          { padding: 16, overflowY: "auto" },
  hypothesisRow: { display: "flex", alignItems: "center", gap: 10, marginBottom: 12 },
  dot:           { width: 12, height: 12, borderRadius: "50%", flexShrink: 0 },
  hypothesisText:{ fontWeight: 600, fontSize: 15 },
  summary:       { fontSize: 13, color: "#555", lineHeight: 1.6, marginBottom: 16 },
  sectionLabel:  { fontSize: 11, textTransform: "uppercase", color: "#aaa", letterSpacing: 0.5, marginBottom: 8 },
  cardRow:       { padding: "8px 0", borderBottom: "1px solid #f5f5f5", display: "grid", gridTemplateColumns: "1fr auto", gap: "4px 12px", alignItems: "start" },
  cardId:        { fontSize: 13, color: "#333", fontWeight: 500 },
  statusLabel:   { fontSize: 11, fontWeight: 600 },
  cardNote:      { fontSize: 11, color: "#888", gridColumn: "1/-1" },
};
