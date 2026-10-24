import { notFound } from "next/navigation";
import { listProjectMembers } from "@shotpilot/api";
import { ROLE_DEFAULTS, type ProjectRole } from "@shotpilot/shared";
import { loadProject, can } from "@/lib/project";
import { removeMemberAction } from "./actions";
import { Badge, Card, PageHeader } from "@/components/ui";
import { AddMemberForm, roleLabel } from "@/components/crew";

export const metadata = { title: "Crew" };

export default async function CrewPage({ params }: { params: Promise<{ ws: string; pid: string }> }) {
  const { ws, pid } = await params;
  const { ctx, pa } = await loadProject(pid);
  if (!can(pa.access, "crew")) notFound();
  const members = await listProjectMembers(ctx, pid);
  const path = `/w/${ws}/p/${pid}/crew`;
  const canEdit = can(pa.access, "crew", "edit");
  return (
    <div className="space-y-6">
      <PageHeader title="Crew" subtitle="Everyone on this project and what their role lets them see." />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card>
          <ul className="divide-y divide-line">
            {members.map((m) => {
              const sections = Object.entries(ROLE_DEFAULTS[m.role as ProjectRole] ?? {}).filter(([, l]) => l !== "none").map(([s]) => s);
              return (
                <li key={m.userId} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-rail text-xs font-semibold text-rail-ink">{m.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}</span>
                  <span className="min-w-0 flex-1"><span className="block font-medium">{m.name}</span><span className="block truncate text-xs text-ink-3" dir="ltr">{m.email}</span></span>
                  <span className="flex flex-col items-end gap-1">
                    <Badge tone="accent">{roleLabel(m.role)}{m.title ? ` · ${m.title}` : ""}</Badge>
                    <span className="hidden max-w-xs text-end text-[11px] text-ink-3 md:block">Sees: {sections.join(", ")}</span>
                  </span>
                  {canEdit && m.userId !== ctx.userId ? (
                    <form action={removeMemberAction}><input type="hidden" name="projectId" value={pid} /><input type="hidden" name="userId" value={m.userId} /><input type="hidden" name="path" value={path} />
                      <button className="rounded px-2 py-1 text-xs text-danger hover:bg-danger-soft">Remove</button></form>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </Card>
        {canEdit ? <Card className="h-fit p-5"><h2 className="mb-3 font-semibold">Add someone</h2><AddMemberForm projectId={pid} path={path} /></Card> : null}
      </div>
    </div>
  );
}
