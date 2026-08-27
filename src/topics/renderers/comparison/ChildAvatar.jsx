// Simple flat child illustrations pairing with each real-life scenario's
// character — same visual role as the generated item icons (realLifeItems.js):
// everything the question mentions gets shown, not just the countable
// objects. Kept as inline SVG (not generated) so it renders crisp at any
// size; drawn with the app's own accent blue + a warm secondary, not an
// arbitrary palette, to match the rest of the topic's visual language.
export default function ChildAvatar({ gender, className }) {
  const skin = "#FBD3A6";
  const skinShade = "#F0B87E";
  const outline = "#2d3748";
  const isGirl = gender === "girl";
  const hair = isGirl ? "#5C3A21" : "#3D2A18";
  const shirt = isGirl ? "#EC4899" : "#3b82f6";
  const shirtShade = isGirl ? "#DB2777" : "#2563eb";

  return (
    <svg
      className={className}
      viewBox="0 0 120 132"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* shoulders / shirt */}
      <path
        d="M16 130c1.5-24 14.5-36 44-36s42.5 12 44 36"
        fill={shirt}
        stroke={outline}
        strokeWidth="4.5"
        strokeLinejoin="round"
      />
      {/* collar accent */}
      <path d="M46 96c4 6 10 9 14 9s10-3 14-9" fill="none" stroke={shirtShade} strokeWidth="4" strokeLinecap="round" />

      {isGirl ? (
        <>
          {/* long hair mass behind head */}
          <path
            d="M20 64c-1-26 16-42 40-42s41 16 40 42c0 8-2 15-5 21l-6-4c1-6 2-13 0-19-4 6-10 9-16 10 3-6 3-12 1-17-5 7-13 11-21 12 2-5 2-11 0-15-6 7-16 11-25 10-2 6-1 13 1 19l-6 4c-3-6-4-13-3-21z"
            fill={hair}
            stroke={outline}
            strokeWidth="4.5"
            strokeLinejoin="round"
          />
        </>
      ) : (
        <>
          {/* short hair cap */}
          <path
            d="M22 58c-4-27 14-44 38-44s42 17 38 44c-3-9-9-16-17-19 2 4 2 8 1 12-7-8-17-13-27-13-3 0-7 3-9 8-6-1-11-4-14-9-2 6-4 13-10 21z"
            fill={hair}
            stroke={outline}
            strokeWidth="4.5"
            strokeLinejoin="round"
          />
        </>
      )}

      {/* face */}
      <circle cx="60" cy="62" r="33" fill={skin} stroke={outline} strokeWidth="4.5" />
      <path d="M30 66a30 30 0 0 0 4 15" fill="none" stroke={skinShade} strokeWidth="3" strokeLinecap="round" opacity="0.5" />

      {isGirl && (
        <>
          <circle cx="23" cy="58" r="10" fill={hair} stroke={outline} strokeWidth="4" />
          <circle cx="97" cy="58" r="10" fill={hair} stroke={outline} strokeWidth="4" />
        </>
      )}

      {/* eyes */}
      <circle cx="48" cy="63" r="4.2" fill={outline} />
      <circle cx="72" cy="63" r="4.2" fill={outline} />
      {/* eyebrows */}
      <path d="M42 53c3-2 8-2 11 0" stroke={outline} strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M67 53c3-2 8-2 11 0" stroke={outline} strokeWidth="3" strokeLinecap="round" fill="none" />
      {/* smile */}
      <path d="M46 76c5 6 23 6 28 0" stroke={outline} strokeWidth="4" strokeLinecap="round" fill="none" />
      {/* cheeks */}
      <circle cx="37" cy="73" r="5.5" fill="#FF9B85" opacity="0.55" />
      <circle cx="83" cy="73" r="5.5" fill="#FF9B85" opacity="0.55" />
    </svg>
  );
}
