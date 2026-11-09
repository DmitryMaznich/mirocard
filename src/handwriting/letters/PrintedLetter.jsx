export default function PrintedLetter({ letter, size = 96, className = "" }) {
  return (
    <div
      className={`wl-printed ${className}`}
      style={{ fontSize: size, minWidth: size * 0.8, minHeight: size * 1.1 }}
    >
      {letter}
    </div>
  );
}
