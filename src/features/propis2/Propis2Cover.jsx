import { PrintPageTop } from "@/topics/renderers/propis/PrintPageView";

// Covers of a printed notebook (owner, 2026-10-08: three designs, the back left empty). One component for the print (an A5 / A4 page)
// and for the small previews in the print dialog: every size is a share of the cover's own width (container query units), so the
// preview is the cover itself, only smaller.
//  school  — like the printed notebooks of the series: «ТЕТРАДЬ», the notebook's name, Имя / Фамилия / Начата, the logo
//  propis  — the name written in the copybook's own hand on the copybook ruling, with a few rows of the notebook under it
//  sample  — the name, and a window on the first rows of the notebook itself (its own paper), name fields
export const COVERS = [
  { id: "none", label: "Без обложки" },
  { id: "school", label: "Школьная" },
  { id: "propis", label: "Пропись" },
  { id: "sample", label: "С образцом" },
];

export default function Propis2Cover({ design, title, titleTask, sampleTask, a4 = false }) {
  const name = String(title ?? "").trim() || "Тетрадь";
  return (
    <div className={`p2-cover p2-cover--${design}${a4 ? " p2-cover--a4" : ""}`} data-testid={`propis2-cover-${design}`}>
      {design === "school" && (
        <div className="p2-cover-mid">
          <div className="p2-cover-kicker">ТЕТРАДЬ</div>
          <div className="p2-cover-name">{name}</div>
          <Fields names={["Имя", "Фамилия", "Начата"]} />
        </div>
      )}
      {design === "propis" && (
        <div className="p2-cover-mid">
          <div className="p2-cover-ruled">{titleTask && <PrintPageTop task={titleTask} rows={2} />}</div>
          <Fields names={["Имя", "Фамилия"]} />
        </div>
      )}
      {design === "sample" && (
        <div className="p2-cover-top">
          <div className="p2-cover-kicker">ТЕТРАДЬ</div>
          <div className="p2-cover-name p2-cover-name--big">{name}</div>
          <div className="p2-cover-window">{sampleTask && <PrintPageTop task={sampleTask} rows={6} />}</div>
          <Fields names={["Имя", "Фамилия"]} />
        </div>
      )}
      <div className="p2-cover-logo">Mironium</div>
    </div>
  );
}

function Fields({ names }) {
  return (
    <div className="p2-cover-fields">
      {names.map((n) => <div key={n} className="p2-cover-field"><span>{n}</span><i /></div>)}
    </div>
  );
}
