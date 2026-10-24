import Link from "next/link";
import { getProjectOverview } from "@shotpilot/api";
import { loadProject } from "@/lib/project";
import { Badge, Card, Icon, LinkButton, Stat } from "@/components/ui";

export default async function Overview({ params }: { params: Promise<{ ws: string; pid: string }> }) {
  const { ws, pid } = await params;
  const { ctx } = await loadProject(pid);
  const o = await getProjectOverview(ctx, pid);
  const base = `/w/${ws}/p/${pid}`;

  // Next step guidance: show the producer the single most useful next action.
  const steps = [
    { done: (o.scriptCount ?? 0) > 0, label: "Add a script or treatment", href: `${base}/script`, show: o.scriptCount !== undefined },
    { done: !!o.breakdown, label: "Analyse it into a breakdown", href: `${base}/script`, show: o.breakdown !== undefined },
    { done: o.breakdown?.status === "confirmed", label: "Review and confirm the breakdown", href: `${base}/breakdown`, show: o.breakdown !== undefined },
    { done: (o.budgetCount ?? 0) > 0, label: "Generate a first budget estimate", href: `${base}/budget`, show: o.budgetCount !== undefined },
    { done: (o.memberCount ?? 0) > 1, label: "Add your crew", href: `${base}/crew`, show: o.memberCount !== undefined },
  ].filter((s) => s.show);
  const next = steps.find((s) => !s.done);

  return (
    <div className="space-y-6">
      {o.access.project.description ? <p className="max-w-3xl text-sm text-ink-2">{o.access.project.description}</p> : null}
      {next ? (
        <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-accent-soft text-accent-strong"><Icon name="sparkle" /></span>
          <div className="flex-1"><div className="text-xs font-medium text-ink-3">Next step</div><div className="font-semibold">{next.label}</div></div>
          <LinkButton href={next.href}>Continue</LinkButton>
        </Card>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {o.scriptCount !== undefined ? <Card className="p-4"><Stat label="Script versions" value={o.scriptCount} hint={o.latestScriptVersion ? `Latest: ${o.latestScriptVersion.title} v${o.latestScriptVersion.version}` : "None yet"} /></Card> : null}
        {o.breakdown !== undefined ? (
          <Card className="p-4"><Stat label="Scenes" value={o.breakdown?.sceneCount ?? "—"} hint={o.breakdown ? `${o.breakdown.confirmedScenes} confirmed · ${o.breakdown.status}` : "No breakdown yet"} /></Card>
        ) : null}
        {o.budgetCount !== undefined ? <Card className="p-4"><Stat label="Budgets" value={o.budgetCount} /></Card> : null}
        {o.memberCount !== undefined ? <Card className="p-4"><Stat label="People" value={o.memberCount} /></Card> : null}
      </div>
      {steps.length ? (
        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold">Production setup</h2>
          <ol className="space-y-2">
            {steps.map((s) => (
              <li key={s.label} className="flex items-center gap-3 text-sm">
                <span className={`grid h-5 w-5 place-items-center rounded-full ${s.done ? "bg-ok text-white" : "border border-line-strong"}`}>{s.done ? <Icon name="check" size={12} /> : null}</span>
                <Link href={s.href} className={s.done ? "text-ink-3 line-through" : "hover:text-accent-strong"}>{s.label}</Link>
              </li>
            ))}
          </ol>
        </Card>
      ) : null}
      {o.breakdown ? <p className="text-xs text-ink-3">Latest breakdown produced by <Badge tone={o.breakdown.providerLabel.startsWith("Claude") ? "ai" : "neutral"}>{o.breakdown.providerLabel}</Badge></p> : null}
    </div>
  );
}
