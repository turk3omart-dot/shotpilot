export function Logo({ className = "", withWord = true }: { className?: string; withWord?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="8" fill="var(--sp-rail)" />
        <path d="M8 21.5 16 7l8 14.5" fill="none" stroke="var(--sp-accent)" strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx="16" cy="21" r="2.6" fill="var(--sp-accent)" />
      </svg>
      {withWord ? <span className="text-[15px] font-semibold tracking-tight">ShotPilot</span> : null}
    </span>
  );
}
