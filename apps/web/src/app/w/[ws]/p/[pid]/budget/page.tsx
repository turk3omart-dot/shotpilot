import Link from "next/link";
import { getCurrentBreakdownId, listBudgets, previewScenarios } from "@shotpilot/api";
import { notFound } from "next/navigation";
import { loadProject, can } from "@/lib/project";
import { money } from "@/lib/format";
import { Alert, Badge, Card, EmptyState, Icon, LinkButton, PageHeader } from "@/components/ui";
import { GenerateBudgetForm } from "@/components/budget";

export const metadata = { title: "Budget" };
const LABEL: Record<string, string> = { lean: "Lean", standard: "Standard", premium: "Premium" };

export default async function BudgetPage({ params, searchParams }: { params: Promise<{ ws: string; pid: string }>; searchParams: Promise<{ breakdown?: string }> }) {
  const { ws, pid } = await params;
  const { ctx, pa } = await loadProject(pid);
  if (!can(pa.access, "budget")) notFound();
  const base = `/w/${ws}/p/${pid}`;
  const { breakdown } = await searchParams;
  const budgets = await listBudgets(ctx, pid);
  const breakdownId = can(pa.access, "breakdown") ? breakdown ?? (await getCurrentBreakdownId(ctx, pid)) : null;
  const preview = breakdownId && can(pa.access, "budget", "edit") ? await previewScenarios(ctx, pid, breakdownId) : null;
  const cur = pa.project.currency;

  return (
    <div className="space-y-6">
      <PageHeader title="Budget" subtitle="Estimates are calculated from your breakdown and rate card with explicit rules — never invented by AI." />
      {preview ? (
        <Card className="p-5">
          <h2 className="font-semibold">New estimate</h2>
          <p className="mb-4 mt-1 text-sm text-ink-2">Scenarios differ by crew size, pages per day and post-production effort — each line shows how it was calculated.</p>
          {preview.rateCardIsSample ? <div className="mb-4"><Alert tone="warn" title="Sample rate card">“{preview.rateCardName}”. These figures are placeholders for planning, not market quotations.</Alert></div> : null}
          <GenerateBudgetForm ws={ws} projectId={pid} breakdownId={breakdownId!}
            scenarios={preview.scenarios.map((s) => ({ ...s, label: LABEL[s.scenario]!, totalLabel: money(s.total, cur) }))} />
        </Card>
      ) : !breakdownId ? (
        <EmptyState icon={<Icon name="money" size={32} />} title="Analyse a script first" body="Budgets are generated from a breakdown so every line traces back to the production plan."
          action={can(pa.access, "scripts") ? <LinkButton href={`${base}/script`}>Go to script</LinkButton> : null} />
      ) : null}
      {budgets.length ? (
        <Card>
          <div className="border-b border-line px-5 py-3 text-sm font-semibold">Budgets</div>
          <ul className="divide-y divide-line">
            {budgets.map((b) => (
              <li key={b.id}><Link href={`${base}/budget/${b.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-2/50">
                <Icon name="money" className="text-accent" />
                <span className="flex-1"><span className="font-medium">{b.name}</span><span className="block text-xs text-ink-3">{b.createdAt.toLocaleString()}</span></span>
                <Badge>{b.status}</Badge>
                <span className="w-32 text-end font-semibold tabular-nums">{money(b.estimated, b.currency)}</span>
                <span className="text-xs text-ink-3">before contingency & tax</span>
              </Link></li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
