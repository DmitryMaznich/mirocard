import { useState, useEffect, useCallback } from "react";
import { getDb, topics } from "@/core/db";
import "./print_materials.css";

export default function PrintMaterialsRenderer({ topicRecord }) {
  const { meta, categories = [], items = [] } = topicRecord;
  const [activeCategory, setActiveCategory] = useState(categories[0]?.id ?? null);
  const [thumbUrls, setThumbUrls] = useState({});
  const [busy, setBusy] = useState({});

  // Load thumbnails from IndexedDB on mount
  useEffect(() => {
    let live = true;
    const created = [];

    (async () => {
      const db = await getDb();
      for (const item of items) {
        if (!item.thumbnail || !live) break;
        const blob = await topics.getFile(db, meta.id, item.thumbnail);
        if (!blob || !live) continue;
        const url = URL.createObjectURL(blob);
        created.push(url);
        if (live) setThumbUrls(prev => ({ ...prev, [item.id]: url }));
      }
    })();

    return () => {
      live = false;
      created.forEach(u => URL.revokeObjectURL(u));
    };
  }, [meta.id]);  // eslint-disable-line react-hooks/exhaustive-deps

  const handleOpen = useCallback(async (item, file) => {
    const key = `${item.id}::${file.path}`;
    setBusy(prev => ({ ...prev, [key]: true }));
    try {
      const db = await getDb();
      const blob = await topics.getFile(db, meta.id, file.path);
      if (!blob) {
        alert("Файл не найден. Переустановите тему.");
        return;
      }
      // PDF blobs saved with the correct MIME type open in the browser's
      // built-in viewer, from which the user can view, print or save.
      // A forced <a download> here would just save the file silently,
      // with no way to open/preview it.
      const pdfBlob = blob.type === "application/pdf" ? blob : new Blob([blob], { type: "application/pdf" });
      const url = URL.createObjectURL(pdfBlob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } finally {
      setBusy(prev => ({ ...prev, [key]: false }));
    }
  }, [meta.id]);

  const visible = activeCategory
    ? items.filter(i => i.category === activeCategory)
    : items;

  return (
    <div className="pm">
      {categories.length > 1 && (
        <div className="pm-tabs">
          {categories.map(cat => (
            <button
              key={cat.id}
              className={`pm-tab${activeCategory === cat.id ? " pm-tab--active" : ""}`}
              onClick={() => setActiveCategory(cat.id)}
            >
              {cat.label}
            </button>
          ))}
        </div>
      )}

      <div className="pm-grid">
        {visible.map(item => (
          <div key={item.id} className="pm-card">
            <div className="pm-card__thumb">
              {thumbUrls[item.id]
                ? <img src={thumbUrls[item.id]} alt={item.title} />
                : <div className="pm-card__thumb-placeholder">📄</div>
              }
            </div>
            <div className="pm-card__body">
              <div className="pm-card__title">{item.title}</div>
              {item.description && (
                <div className="pm-card__desc">{item.description}</div>
              )}
              <div className="pm-card__files">
                {(item.files ?? []).map(file => {
                  const key = `${item.id}::${file.path}`;
                  return (
                    <button
                      key={file.path}
                      className="pm-btn"
                      disabled={!!busy[key]}
                      onClick={() => handleOpen(item, file)}
                    >
                      <span className="pm-btn__icon">{busy[key] ? "⏳" : "📄"}</span>
                      <span className="pm-btn__label">{file.label}</span>
                      {file.hint && (
                        <span className="pm-btn__hint">{file.hint}</span>
                      )}
                    </button>
                  );
                })}
              </div>
              {item.assembly && (
                <div className="pm-card__note">📎 {item.assembly}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
