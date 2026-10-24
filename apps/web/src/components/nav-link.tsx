"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, cx, type IconName } from "./ui";

export function RailLink({ href, icon, label, exact, soon }: { href: string; icon: IconName; label: string; exact?: boolean; soon?: boolean }) {
  const path = usePathname();
  const active = exact ? path === href : path === href || path.startsWith(href + "/");
  return (
    <Link href={href} aria-current={active ? "page" : undefined}
      className={cx("group flex h-9 items-center gap-3 rounded-[8px] px-3 text-sm transition-colors",
        active ? "bg-rail-2 text-rail-ink" : "text-rail-ink-2 hover:bg-rail-2/60 hover:text-rail-ink")}>
      <Icon name={icon} className={active ? "text-accent" : ""} />
      <span className="truncate">{label}</span>
      {soon ? <span className="ms-auto rounded-full bg-rail-2 px-1.5 text-[10px] text-rail-ink-2">soon</span> : null}
    </Link>
  );
}

export function BottomLink({ href, icon, label, exact }: { href: string; icon: IconName; label: string; exact?: boolean }) {
  const path = usePathname();
  const active = exact ? path === href : path === href || path.startsWith(href + "/");
  return (
    <Link href={href} aria-current={active ? "page" : undefined}
      className={cx("flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px]", active ? "text-accent-strong" : "text-ink-3")}>
      <Icon name={icon} size={20} />
      {label}
    </Link>
  );
}

export function TabLink({ href, label, exact }: { href: string; label: string; exact?: boolean }) {
  const path = usePathname();
  const active = exact ? path === href : path === href || path.startsWith(href + "/");
  return (
    <Link href={href} aria-current={active ? "page" : undefined}
      className={cx("relative whitespace-nowrap px-1 pb-3 pt-1 text-sm transition-colors",
        active ? "font-medium text-ink after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full after:bg-accent" : "text-ink-2 hover:text-ink")}>
      {label}
    </Link>
  );
}
