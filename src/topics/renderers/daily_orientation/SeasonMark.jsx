// Season silhouette (snowflake / sprout / sun / leaves), drawn in
// currentColor. Shared by the Время года card background and the modals.
export function SeasonMark({ season, className = "daily-orientation__season-mark" }) {
  if (season.id === "winter") {
    return <svg className={className} viewBox="0 0 160 160" aria-hidden="true"><g stroke="currentColor" strokeWidth="10" strokeLinecap="round"><path d="M80 20v120M28 50l104 60M28 110l104-60" /><path d="m80 20-14 14M80 20l14 14M80 140l-14-14M80 140l14-14" /></g></svg>;
  }
  if (season.id === "spring") {
    return <svg className={className} viewBox="0 0 160 160" aria-hidden="true"><path d="M80 140V75" stroke="currentColor" strokeWidth="10" strokeLinecap="round" /><path d="M80 108c-38 0-46-35-43-48 31 3 43 21 43 48ZM80 88c3-32 20-45 43-48 3 22-6 48-43 48Z" fill="currentColor" opacity=".78" /><circle cx="80" cy="55" r="22" fill="currentColor" /></svg>;
  }
  if (season.id === "summer") {
    return <svg className={className} viewBox="0 0 160 160" aria-hidden="true"><g fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="round"><circle cx="80" cy="80" r="30" fill="currentColor" opacity=".8" /><path d="M80 14v18M80 128v18M14 80h18M128 80h18M33 33l13 13M114 114l13 13M127 33l-13 13M46 114l-13 13" /></g></svg>;
  }
  return <svg className={className} viewBox="0 0 160 160" aria-hidden="true"><path d="M78 146c3-53 16-88 56-118-1 48-19 88-56 118Z" fill="currentColor" opacity=".9" /><path d="M78 146C70 99 48 64 20 41c4 47 22 86 58 105Z" fill="currentColor" opacity=".65" /><path d="M78 146c3-47 16-79 56-118M78 146C68 100 45 63 20 41" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" /></svg>;
}
