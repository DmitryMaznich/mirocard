export default function OppositeRenderer({ task }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", fontSize: "1.4rem", color: "#aaa" }}>
      opposites · {task?.type ?? "—"}
    </div>
  );
}
