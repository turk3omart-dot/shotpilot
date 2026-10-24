import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-[10px] text-sm font-medium transition-colors duration-150 disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap";
const buttonVariants = {
  primary: "bg-accent text-accent-contrast hover:bg-accent-strong hover:text-white px-4 h-9 shadow-sm",
  secondary: "bg-surface text-ink border border-line hover:border-line-strong hover:bg-surface-2 px-4 h-9",
  ghost: "text-ink-2 hover:text-ink hover:bg-surface-2 px-3 h-8",
  danger: "bg-danger text-white hover:opacity-90 px-4 h-9",
} as const;
export type ButtonVariant = keyof typeof buttonVariants;

export function buttonClass(variant: ButtonVariant = "primary", extra?: string) {
  return cx(buttonBase, buttonVariants[variant], extra);
}

export function Button({ variant = "primary", className, ...props }: ComponentProps<"button"> & { variant?: ButtonVariant }) {
  return <button className={buttonClass(variant, className)} {...props} />;
}

export function LinkButton({ variant = "primary", className, ...props }: ComponentProps<typeof Link> & { variant?: ButtonVariant }) {
  return <Link className={buttonClass(variant, className)} {...props} />;
}

export const inputClass =
  "w-full h-10 rounded-[10px] border border-line bg-surface px-3 text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25 transition";

export function Field({ label, hint, error, children, htmlFor }: { label: string; hint?: string; error?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {error ? <p className="text-xs text-danger">{error}</p> : hint ? <p className="text-xs text-ink-3">{hint}</p> : null}
    </div>
  );
}

export function Card({ className, children, ...rest }: ComponentProps<"div">) {
  return (
    <div className={cx("rounded-[14px] border border-line bg-surface shadow-[var(--sp-shadow-sm)]", className)} {...rest}>
      {children}
    </div>
  );
}

const badgeTones = {
  neutral: "bg-surface-2 text-ink-2 border-line",
  accent: "bg-accent-soft text-accent-strong border-transparent",
  ok: "bg-ok-soft text-ok border-transparent",
  warn: "bg-warn-soft text-warn border-transparent",
  danger: "bg-danger-soft text-danger border-transparent",
  info: "bg-info-soft text-info border-transparent",
  ai: "bg-ai-soft text-ai border-transparent",
} as const;
export type BadgeTone = keyof typeof badgeTones;

export function Badge({ tone = "neutral", children, title, className }: { tone?: BadgeTone; children: ReactNode; title?: string; className?: string }) {
  return (
    <span title={title} className={cx("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4 whitespace-nowrap", badgeTones[tone], className)}>
      {children}
    </span>
  );
}

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? <div className="mb-1 text-xs font-medium uppercase tracking-wider text-ink-3">{eyebrow}</div> : null}
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-ink-2">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function EmptyState({ title, body, action, icon }: { title: string; body?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[14px] border border-dashed border-line-strong bg-surface/60 px-6 py-14 text-center">
      {icon ? <div className="mb-3 text-ink-3">{icon}</div> : null}
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {body ? <p className="mt-1 max-w-md text-sm text-ink-2">{body}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function Alert({ tone = "info", children, title }: { tone?: "info" | "warn" | "danger" | "ok" | "ai"; children: ReactNode; title?: string }) {
  const tones = {
    info: "bg-info-soft text-ink border-info/20",
    warn: "bg-warn-soft text-ink border-warn/25",
    danger: "bg-danger-soft text-ink border-danger/25",
    ok: "bg-ok-soft text-ink border-ok/25",
    ai: "bg-ai-soft text-ink border-ai/25",
  };
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cx("rounded-[10px] border px-4 py-3 text-sm", tones[tone])}>
      {title ? <div className="mb-0.5 font-semibold">{title}</div> : null}
      <div className="text-ink-2">{children}</div>
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div>
      <div className="text-xs font-medium text-ink-3">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-ink">{value}</div>
      {hint ? <div className="mt-0.5 text-xs text-ink-3">{hint}</div> : null}
    </div>
  );
}

/* Icons: small inline SVG set (stroke-based, 20px grid). */
type IconName =
  | "home" | "folder" | "chat" | "calendar" | "sparkle" | "settings" | "plus" | "script" | "list" | "money" | "users"
  | "check" | "x" | "upload" | "logout" | "chevron" | "alert" | "film" | "map" | "clock" | "search";
const paths: Record<IconName, ReactNode> = {
  home: <path d="M3 9.5 10 4l7 5.5V16a1 1 0 0 1-1 1h-4v-5H8v5H4a1 1 0 0 1-1-1V9.5Z" />,
  folder: <path d="M3 6a1 1 0 0 1 1-1h4l2 2h6a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6Z" />,
  chat: <path d="M4 5h12a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H9l-4 3v-3H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" />,
  calendar: <><rect x="3" y="5" width="14" height="12" rx="1.5" /><path d="M3 9h14M7 3v4M13 3v4" /></>,
  sparkle: <path d="M10 3l1.6 4.4L16 9l-4.4 1.6L10 15l-1.6-4.4L4 9l4.4-1.6L10 3Zm5 10 .7 1.8 1.8.7-1.8.7L15 18l-.7-1.8-1.8-.7 1.8-.7L15 13Z" />,
  settings: <><circle cx="10" cy="10" r="2.5" /><path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4" /></>,
  plus: <path d="M10 4v12M4 10h12" />,
  script: <><path d="M6 3h6l3 3v11H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" /><path d="M8 9h5M8 12h5M8 15h3" /></>,
  list: <path d="M7 5h10M7 10h10M7 15h10M3.5 5h.01M3.5 10h.01M3.5 15h.01" />,
  money: <><rect x="2.5" y="5" width="15" height="10" rx="1.5" /><circle cx="10" cy="10" r="2" /></>,
  users: <><circle cx="7.5" cy="7" r="2.5" /><path d="M3 16c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4M13 4.8a2.5 2.5 0 0 1 0 4.4M14.5 12c1.6.4 2.5 1.8 2.5 4" /></>,
  check: <path d="m4.5 10.5 3.5 3.5 7.5-8" />,
  x: <path d="M5 5l10 10M15 5 5 15" />,
  upload: <path d="M10 13V4M6.5 7.5 10 4l3.5 3.5M4 13v3h12v-3" />,
  logout: <path d="M8 4H4v12h4M12 6.5 15.5 10 12 13.5M15.5 10H8" />,
  chevron: <path d="m7.5 5 5 5-5 5" />,
  alert: <><path d="M10 3 2.5 16h15L10 3Z" /><path d="M10 8v4M10 14.5h.01" /></>,
  film: <><rect x="3" y="4" width="14" height="12" rx="1.5" /><path d="M7 4v12M13 4v12M3 8h4M3 12h4M13 8h4M13 12h4" /></>,
  map: <path d="M3 5.5 7.5 4l5 2L17 4.5v10L12.5 16l-5-2L3 15.5v-10ZM7.5 4v10M12.5 6v10" />,
  clock: <><circle cx="10" cy="10" r="7" /><path d="M10 6v4l2.5 2" /></>,
  search: <><circle cx="9" cy="9" r="5" /><path d="m13 13 4 4" /></>,
};
export function Icon({ name, size = 18, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      {paths[name]}
    </svg>
  );
}
export type { IconName };
