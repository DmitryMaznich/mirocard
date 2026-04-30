export default function Button({
  children,
  variant = "primary",
  onClick,
  disabled = false,
  fullWidth = false,
  type = "button",
}) {
  const cls = ["btn", `btn-${variant}`, fullWidth ? "btn-full" : ""]
    .filter(Boolean)
    .join(" ");
  return (
    <button className={cls} onClick={onClick} disabled={disabled} type={type}>
      {children}
    </button>
  );
}
