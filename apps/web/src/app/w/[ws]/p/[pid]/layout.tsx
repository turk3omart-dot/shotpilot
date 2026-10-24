import { loadProject, can } from "@/lib/project";
import { TabLink } from "@/components/nav-link";
import { Badge } from "@/components/ui";
import { phaseLabel, projectTypeLabel } from "@/components/project-card";

export default async function ProjectLayout({ children, params }: { children: React.ReactNode; params: Promise<{ ws: string; pid: string }> }) {
  const { ws, pid } = await params;
  const { pa } = await loadProject(pid);
  const base = `/w/${ws}/p/${pid}`;
  const tabs = [
    { href: base, label: "Overview", show: true, exact: true },
    { href: `${base}/script`, label: "Script", show: can(pa.access, "scripts") },
    { href: `${base}/breakdown`, label: "Breakdown", show: can(pa.access, "breakdown") },
    { href: `${base}/budget`, label: "Budget", show: can(pa.access, "budget") },
    { href: `${base}/crew`, label: "Crew", show: can(pa.access, "crew") },
  ].filter((t) => t.show);
  return (
    <div>
      <div className="border-b border-line bg-surface/60">
        <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-8">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">{pa.project.name}</h1>
            <Badge>{projectTypeLabel(pa.project.type)}</Badge>
            <Badge tone="accent">{phaseLabel(pa.project.phase)}</Badge>
            {pa.projectRole && !pa.workspaceRole?.match(/owner|admin/) ? <Badge tone="info">{phaseLabel(pa.projectRole)}</Badge> : null}
          </div>
          <nav className="-mb-px mt-4 flex gap-6 overflow-x-auto" aria-label="Project">
            {tabs.map((t) => <TabLink key={t.href} href={t.href} label={t.label} exact={t.exact} />)}
          </nav>
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8">{children}</div>
    </div>
  );
}
