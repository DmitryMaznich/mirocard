import { RefreshIcon } from '@/shared/components/ArrowIcons';

function BookIcon() {
  return (
    <svg viewBox="0 0 22 22" fill="none" aria-hidden>
      <path d="M4 5.5c2-1 5-1 7 0 2-1 5-1 7 0v11c-2-1-5-1-7 0-2-1-5-1-7 0V5.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M11 5.5V16.5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function BasketIcon() {
  return (
    <svg viewBox="0 0 22 22" fill="none" aria-hidden>
      <path d="M4.5 8.5h13l-1.3 8.2a1.6 1.6 0 0 1-1.6 1.3H7.4a1.6 1.6 0 0 1-1.6-1.3L4.5 8.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M7 8.5V6.8A4 4 0 0 1 11 3a4 4 0 0 1 4 3.8v1.7" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 22 22" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="7.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M11 6.5V11l3 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function CookArrowIcon() {
  return (
    <svg className="planner-navbar__cook-icon" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M7 4l6 6-6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function PlannerActionBar({
  hasSelection,
  readyToCook,
  cookedCount,
  totalCount,
  recipesLoaded,
  hint,
  onOpenCatalog,
  onEditProducts,
  onCook,
  onRestart,
  onHistory,
}) {
  const showCookBadge = hasSelection && cookedCount > 0 && cookedCount < totalCount;

  return (
    <div className="planner-navbar">
      <div className="planner-navbar-bar">
        <button type="button" className="planner-navbar__item" onClick={onOpenCatalog} disabled={!recipesLoaded}>
          <BookIcon />
          <span>Рецепты</span>
        </button>
        <button type="button" className="planner-navbar__item" onClick={onEditProducts}>
          <BasketIcon />
          <span>Продукты</span>
        </button>
        <div className="planner-navbar__cook-slot" />
        <button type="button" className="planner-navbar__item" onClick={onRestart} disabled={!hasSelection}>
          <RefreshIcon />
          <span>Заново</span>
        </button>
        <button type="button" className="planner-navbar__item" onClick={onHistory}>
          <ClockIcon />
          <span>История</span>
        </button>
        <button type="button" className="planner-navbar__cook" onClick={onCook} disabled={!readyToCook}>
          <span className="planner-navbar__cook-label">Готовим!</span>
          <CookArrowIcon />
          {showCookBadge && (
            <span className="planner-navbar__cook-badge">{cookedCount}/{totalCount}</span>
          )}
        </button>
      </div>
      {hint && <div className="planner-navbar-hint">{hint}</div>}
    </div>
  );
}
