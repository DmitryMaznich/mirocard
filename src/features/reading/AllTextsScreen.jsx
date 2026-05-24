import { useState, useEffect } from "react";
import { useAppStore } from "@/core/store";
import { getRawRecipeTxt } from "@/core/groupStore";
import { getTopicTitle } from "@/shared/utils/format";

function useAllTextsContent(topicId, texts) {
  const [contents, setContents] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!topicId || !texts?.length) { setLoading(false); return; }
    const targets = texts.filter((t) => t.kind === "instruction" && t.file);
    Promise.all(
      targets.map(async (t) => [t.id, await getRawRecipeTxt(topicId, t.file)])
    ).then((entries) => {
      setContents(Object.fromEntries(entries.filter(([, v]) => v)));
      setLoading(false);
    });
  }, [topicId, texts]);

  return { contents, loading };
}

export default function AllTextsScreen() {
  const setScreen     = useAppStore((s) => s.setScreen);
  const activeTopicId = useAppStore((s) => s.activeTopicId);
  const topicRecords  = useAppStore((s) => s.topicRecords);

  const topicRecord = topicRecords.find((r) => r.meta.id === activeTopicId);
  const allTexts    = topicRecord?.texts ?? [];
  const instructions = allTexts.filter((t) => t.kind === "instruction");

  const { contents, loading } = useAllTextsContent(activeTopicId, instructions);

  return (
    <div className="screen">
      <div className="screen-header">
        <button className="back-btn" onClick={() => setScreen("texts")}>←</button>
        <h1 className="screen-title">
          {topicRecord ? getTopicTitle(topicRecord.meta.title) : "Все тексты"}
        </h1>
      </div>

      {loading ? (
        <div className="empty-state">
          <div className="empty-state__text">Загрузка…</div>
        </div>
      ) : instructions.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__text">Нет инструкций в теме</div>
        </div>
      ) : (
        <div className="all-texts-scroll">
          {instructions.map((text, i) => (
            <div key={text.id} className="all-texts-block">
              <div className="all-texts-index">{i + 1}</div>
              <pre className="all-texts-pre">{contents[text.id] ?? ""}</pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
