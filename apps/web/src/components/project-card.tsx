import Link from "next/link";
import { Badge, Icon } from "./ui";

const TYPE_LABEL: Record<string, string> = {
  feature_film: "Feature film", short_film: "Short film", commercial: "Commercial", documentary: "Documentary",
  branded_content: "Branded content", music_video: "Music video", series_episode: "Series episode", photography: "Photography", event: "Event", other: "Other",
};
export const projectTypeLabel = (t: string) => TYPE_LABEL[t] ?? t;
export const phaseLabel = (p: string) => p.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

export function ProjectCard({ href, name, type, phase, updatedAt }: { href: string; name: string; type: string; phase: string; updatedAt: Date }) {
  return (
    <Link href={href} className="group flex flex-col rounded-[14px] border border-line bg-surface p-4 shadow-[var(--sp-shadow-sm)] transition hover:-translate-y-0.5 hover:border-line-strong hover:shadow-[var(--sp-shadow)]">
      <div className="mb-6 flex items-start justify-between">
        <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-accent-soft text-accent-strong"><Icon name="film" /></span>
        <Badge>{phaseLabel(phase)}</Badge>
      </div>
      <div className="font-semibold text-ink group-hover:text-accent-strong">{name}</div>
      <div className="mt-0.5 text-xs text-ink-3">{projectTypeLabel(type)} · updated {updatedAt.toLocaleDateString()}</div>
    </Link>
  );
}
