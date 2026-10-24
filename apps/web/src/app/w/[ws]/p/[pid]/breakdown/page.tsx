import Link from "next/link";
import { getBreakdown, getCurrentBreakdownId, listBreakdowns } from "@shotpilot/api";
import { loadProject, can } from "@/lib/project";
import { Alert, Badge, Card, EmptyState, Icon, LinkButton, PageHeader, Stat } from "@/components/ui";
import { ConfirmBreakdown, QuestionItem, SceneCard, type SceneVM } from "@/components/breakdown";

export const metadata = { title: "Breakdown" };

export default async function BreakdownPage({ params, searchParams }: { params: Promise<{ ws: string; pid: string }>; searchParams: Promise<{ id?: string; tab?: string }> }) {
  const { ws, pid } = await params;
  const { id, tab = "scenes" } = await searchParams;
  const { ctx, pa } = await loadProject(pid);
  const base = `/w/${ws}/p/${pid}`;
  const breakdownId = id ?? (await getCurrentBreakdownId(ctx, pid));
  if (!breakdownId) {
    return (
      <EmptyState icon={<Icon name="list" size={32} />} title="No breakdown yet"
        body="Add a script and analyse it. Scenes, cast, locations and production elements will appear here for review."
        action={can(pa.access, "scripts") ? <LinkButton href={`${base}/script`}>Go to script</LinkButton> : null} />
    );
  }
  const [bd, history] = await Promise.all([getBreakdown(ctx, breakdownId), listBreakdowns(ctx, pid)]);
  const path = `${base}/breakdown`;
  const scenes: SceneVM[] = bd.scenes.map((s) => ({
    id: s.id, number: s.number, heading: s.heading, intExt: s.intExt, timeOfDay: s.timeOfDay, synopsis: s.synopsis, notes: s.notes, excerpt: s.excerpt,
    complexity: s.complexity, sourceRef: s.sourceRef ?? null,
    estSetup: s.estSetupMinMin != null && s.estSetupMinMax != null ? [s.estSetupMinMin, s.estSetupMinMax] : null,
    estShoot: s.estShootMinMin != null && s.estShootMinMax != null ? [s.estShootMinMin, s.estShootMinMax] : null,
    risks: s.risks, assumptions: s.assumptions, origin: s.origin, confidence: s.confidence, confirmation: s.confirmation, version: s.version,
    location: s.location?.name ?? null, characters: s.characters.map((c) => c.name),
    elements: s.elements.map((e) => ({ id: e.id, category: e.category, name: e.name, quantity: e.quantity, notes: e.notes, origin: e.origin, confidence: e.confidence, confirmation: e.confirmation, sourceLine: e.sourceRef?.startLine ?? null })),
  }));
  const active = scenes.filter((s) => s.confirmation !== "rejected");
  const unconfirmed = scenes.filter((s) => s.confirmation === "unconfirmed").length;
  const isAI = bd.breakdown.providerLabel.startsWith("Claude");
  const tabs = [
    { key: "scenes", label: `Scenes (${active.length})` },
    { key: "cast", label: `Cast (${bd.characters.length})` },
    { key: "locations", label: `Locations (${bd.locations.length})` },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Breakdown"
        subtitle={<>Script v{bd.scriptVersion?.version} · analysed {bd.breakdown.createdAt.toLocaleString()} by <Badge tone={isAI ? "ai" : "info"}>{bd.breakdown.providerLabel}</Badge></>}
        actions={bd.breakdown.status === "confirmed" ? <Badge tone="ok"><Icon name="check" size={12} />Confirmed {bd.breakdown.confirmedAt?.toLocaleDateString()}</Badge>
          : bd.canEdit ? <ConfirmBreakdown breakdownId={bd.breakdown.id} path={path} unconfirmed={unconfirmed} /> : <Badge tone="warn">{bd.breakdown.status}</Badge>}
      />
      {bd.breakdown.status === "superseded" ? <Alert tone="warn" title="Older breakdown">A newer analysis exists. This one is read-only and kept for traceability.</Alert> : null}
      {isAI ? <Alert tone="ai">Items marked <b>AI suggestion</b> are interpretations, not facts. Confirm or reject them; anything you edit becomes team-authored.</Alert> : null}
      {bd.breakdown.warnings.length ? (
        <Alert tone="warn" title="Things to check"><ul className="list-disc ps-5">{bd.breakdown.warnings.map((w) => <li key={w}>{w}</li>)}</ul></Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="p-4"><Stat label="Scenes" value={active.length} hint={`${scenes.length - unconfirmed - (scenes.length - active.length)} confirmed`} /></Card>
        <Card className="p-4"><Stat label="Interior / exterior" value={`${active.filter((s) => s.intExt === "INT").length} / ${active.filter((s) => s.intExt !== "INT").length}`} /></Card>
        <Card className="p-4"><Stat label="Day / night" value={`${active.filter((s) => s.timeOfDay !== "NIGHT").length} / ${active.filter((s) => s.timeOfDay === "NIGHT").length}`} /></Card>
        <Card className="p-4"><Stat label="Speaking cast" value={bd.characters.filter((c) => c.hasDialogue).length} /></Card>
        <Card className="p-4"><Stat label="Locations" value={bd.locations.length} /></Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-4">
          <nav className="flex gap-1 rounded-[10px] border border-line bg-surface-2 p-0.5 text-sm" aria-label="Breakdown views">
            {tabs.map((t) => (
              <Link key={t.key} href={`${path}?id=${bd.breakdown.id}&tab=${t.key}`} aria-current={tab === t.key ? "page" : undefined}
                className={`flex-1 rounded-[8px] px-3 py-1.5 text-center ${tab === t.key ? "bg-surface font-medium shadow-sm" : "text-ink-2"}`}>{t.label}</Link>
            ))}
          </nav>
          {tab === "scenes" ? (
            <div className="space-y-2">{scenes.map((s) => <SceneCard key={s.id + s.version} scene={s} canEdit={bd.canEdit} path={path} />)}</div>
          ) : tab === "cast" ? (
            <Card><ul className="divide-y divide-line">{bd.characters.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent-strong">{c.name.slice(0, 2)}</span>
                <span className="flex-1 font-medium" dir="auto">{c.name}</span>
                {c.hasDialogue ? <Badge>Speaking</Badge> : <Badge tone="neutral">Non-speaking</Badge>}
                <span className="text-xs text-ink-3">Scenes {c.sceneNumbers.join(", ")}</span>
              </li>))}
              {bd.characters.length === 0 ? <li className="px-4 py-6 text-sm text-ink-3">No characters identified.</li> : null}
            </ul></Card>
          ) : (
            <Card><ul className="divide-y divide-line">{bd.locations.map((l) => (
              <li key={l.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <Icon name="map" className="text-ink-3" />
                <span className="flex-1 font-medium" dir="auto">{l.name}</span>
                {l.sceneNumbers.length > 1 ? <Badge tone="accent" title="Scenes at the same location can be grouped into one shooting block">Group {l.sceneNumbers.length} scenes</Badge> : null}
                <span className="text-xs text-ink-3">Scenes {l.sceneNumbers.join(", ")}</span>
              </li>))}
            </ul></Card>
          )}
        </div>
        <aside className="space-y-4">
          {bd.questions.length ? (
            <Card className="p-4">
              <h2 className="text-sm font-semibold">Questions for the producer</h2>
              <p className="text-xs text-ink-3">Answers help sharpen estimates.</p>
              <ul className="divide-y divide-line">{bd.questions.map((q) => <QuestionItem key={q.id} q={q} path={path} canEdit={bd.canEdit} />)}</ul>
            </Card>
          ) : null}
          {can(pa.access, "budget", "edit") && active.length ? (
            <Card className="p-4">
              <h2 className="text-sm font-semibold">Next: estimate the budget</h2>
              <p className="mb-3 mt-1 text-xs text-ink-3">Builds Lean, Standard or Premium line items from this breakdown and your rate card.</p>
              <LinkButton variant="secondary" href={`${base}/budget?breakdown=${bd.breakdown.id}`}><Icon name="money" size={16} />Generate estimate</LinkButton>
            </Card>
          ) : null}
          {history.length > 1 ? (
            <Card className="p-4">
              <h2 className="mb-2 text-sm font-semibold">History</h2>
              <ul className="space-y-1.5 text-sm">{history.map((h) => (
                <li key={h.id}><Link href={`${path}?id=${h.id}`} className={`flex items-center gap-2 ${h.id === bd.breakdown.id ? "font-semibold" : "text-ink-2 hover:text-ink"}`}>
                  v{h.scriptVersion} · {h.createdAt.toLocaleDateString()}<Badge tone={h.status === "confirmed" ? "ok" : h.status === "superseded" ? "neutral" : "warn"} className="ms-auto">{h.status}</Badge></Link></li>))}
              </ul>
            </Card>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
