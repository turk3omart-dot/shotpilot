import { getBudget } from "@shotpilot/api";
import { loadProject } from "@/lib/project";
import { money } from "@/lib/format";
import { Alert, Badge, Card, LinkButton, PageHeader, Stat } from "@/components/ui";
import { BudgetLineRow } from "@/components/budget";

export const metadata = { title: "Budget" };
const SECTIONS: [string, string][] = [["development", "Development"], ["pre_production", "Pre-production"], ["production", "Production"], ["post_production", "Post-production"], ["additional", "Additional"]];

export default async function BudgetDetail({ params }: { params: Promise<{ ws: string; pid: string; bid: string }> }) {
  const { ws, pid, bid } = await params;
  const { ctx } = await loadProject(pid);
  const b = await getBudget(ctx, bid);
  const cur = b.budget.currency;
  const path = `/w/${ws}/p/${pid}/budget/${bid}`;
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Budget" title={b.budget.name} subtitle={`Created ${b.budget.createdAt.toLocaleString()} · ${cur}`}
        actions={<><Badge>{b.budget.status}</Badge><LinkButton variant="secondary" href={`/w/${ws}/p/${pid}/budget`}>All budgets</LinkButton></>} />
      {b.budget.assumptions.length ? <Alert tone={b.rateCardIsSample ? "warn" : "info"} title="Assumptions"><ul className="list-disc ps-5">{b.budget.assumptions.map((a) => <li key={a}>{a}</li>)}</ul></Alert> : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="p-4"><Stat label="Estimated" value={money(b.totals.estimated, cur)} /></Card>
        <Card className="p-4"><Stat label={`Contingency ${b.budget.contingencyPct}%`} value={money(b.totals.contingency, cur)} /></Card>
        <Card className="p-4"><Stat label={`Tax ${b.budget.taxPct}%`} value={money(b.totals.tax, cur)} /></Card>
        <Card className="p-4"><Stat label="Total" value={money(b.totals.total, cur)} /></Card>
        <Card className="p-4"><Stat label="Committed / actual" value={`${money(b.totals.committed, cur)}`} hint={`${money(b.totals.actual, cur)} actual`} /></Card>
      </div>
      {SECTIONS.map(([key, label]) => {
        const lines = b.lines.filter((l) => l.section === key);
        if (!lines.length) return null;
        const sub = lines.reduce((n, l) => n + l.estimated, 0);
        return (
          <Card key={key} className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-4 py-3"><h2 className="font-semibold">{label}</h2><span className="font-semibold tabular-nums">{money(sub, cur)}</span></div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-surface-2/60 text-xs text-ink-3"><tr>
                  <th className="px-3 py-2 text-start font-medium">Item</th><th className="px-3 py-2 text-end font-medium">Quantity</th><th className="px-3 py-2 text-end font-medium">Rate</th>
                  <th className="px-3 py-2 text-end font-medium">Estimated</th><th className="px-3 py-2 text-end font-medium">Quoted</th><th className="px-3 py-2 text-end font-medium">Committed</th><th className="px-3 py-2 text-end font-medium">Actual</th>
                </tr></thead>
                <tbody className="divide-y divide-line">
                  {lines.map((l) => (
                    <BudgetLineRow key={l.id + l.version} path={path} canEdit={b.canEdit}
                      line={{ id: l.id, label: l.label, category: l.category, basis: l.basis, quantity: l.quantity, units: l.units, unit: l.unit, rate: l.rate, estimated: l.estimated, quoted: l.quoted, committed: l.committed, actual: l.actual, version: l.version, origin: l.origin }}
                      fmt={{ rate: money(l.rate, cur), estimated: money(l.estimated, cur), quoted: money(l.quoted, cur), committed: money(l.committed, cur), actual: money(l.actual, cur) }} />
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
