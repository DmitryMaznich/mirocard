// Simple flat, bold-shape child illustrations — same visual language as the
// generated item icons (realLifeItems.js): thick soft outlines, bright flat
// colors, no gradients/shadows. Drawn inline (not generated) so the "who" in
// a real-life comparison is an actual illustrated character, not just a
// text name — a child with autism spectrum needs everything the question
// mentions shown, not just some of it.
export default function ChildAvatar({ gender, className }) {
  const skin = "#FFD9AE";
  const outline = "#3A2E28";
  const isGirl = gender === "girl";
  const hair = isGirl ? "#7A4A2A" : "#4A3222";
  const shirt = isGirl ? "#F0709B" : "#4FA3E3";

  return (
    <svg
      className={className}
      viewBox="0 0 120 130"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* shirt / shoulders */}
      <path
        d="M20 128c0-22 13-34 40-34s40 12 40 34"
        fill={shirt}
        stroke={outline}
        strokeWidth="4"
        strokeLinejoin="round"
      />
      {isGirl ? (
        <>
          {/* long hair behind head */}
          <path
            d="M22 62c0-24 16-40 38-40s38 16 38 40l-6 30c-2-8-6-12-6-12l-4 20-6-16-6 18-6-18-6 16-4-20s-4 4-6 12z"
            fill={hair}
            stroke={outline}
            strokeWidth="4"
            strokeLinejoin="round"
          />
        </>
      ) : (
        <>
          {/* short hair cap */}
          <path
            d="M24 56c-2-26 15-42 36-42s38 16 36 42c-8-10-20-14-36-14s-28 4-36 14z"
            fill={hair}
            stroke={outline}
            strokeWidth="4"
            strokeLinejoin="round"
          />
        </>
      )}
      {/* face */}
      <circle cx="60" cy="60" r="34" fill={skin} stroke={outline} strokeWidth="4" />
      {isGirl && (
        <>
          {/* two side buns */}
          <circle cx="24" cy="50" r="11" fill={hair} stroke={outline} strokeWidth="4" />
          <circle cx="96" cy="50" r="11" fill={hair} stroke={outline} strokeWidth="4" />
        </>
      )}
      {/* eyes */}
      <circle cx="47" cy="62" r="4.5" fill={outline} />
      <circle cx="73" cy="62" r="4.5" fill={outline} />
      {/* smile */}
      <path d="M46 76c5 7 23 7 28 0" stroke={outline} strokeWidth="4" strokeLinecap="round" fill="none" />
      {/* cheeks */}
      <circle cx="38" cy="72" r="5" fill="#FF9E8A" opacity="0.6" />
      <circle cx="82" cy="72" r="5" fill="#FF9E8A" opacity="0.6" />
      {isGirl && (
        <path
          d="M96 34l4 9 9 1-7 6 2 9-8-5-8 5 2-9-7-6 9-1z"
          fill="#FF6F91"
          stroke={outline}
          strokeWidth="3"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}
