export default function HandwrittenLetter({ letter, size = 100, className = "" }) {
  return (
    <div
      className={`wl-handwritten ${className}`}
      style={{ fontSize: size, minWidth: size * 0.7, minHeight: size * 1.1 }}
    >
      {letter}
    </div>
  );
}
