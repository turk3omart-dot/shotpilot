import { getWorkspace, listProjects } from "@shotpilot/api";
import { requireCtx } from "@/lib/server";
import { Card, EmptyState, Icon, LinkButton, PageHeader } from "@/components/ui";
import { ProjectCard } from "@/components/project-card";

export default async function WorkspaceHome({ params }: { params: Promise<{ ws: string }> }) {
  const { ws } = await params;
  const ctx = await requireCtx();
  const { workspace, role } = await getWorkspace(ctx, ws);
  const projects = await listProjects(ctx, workspace.id);
  const first = ctx.user.name.split(" ")[0];

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-8">
      <PageHeader eyebrow={workspace.name} title={`Good to see you, ${first}`} subtitle="Here's what's happening across your productions."
        actions={role !== "guest" ? <LinkButton href={`/w/${ws}/projects/new`}><Icon name="plus" size={16} />New project</LinkButton> : null} />

      {projects.length === 0 ? (
        <EmptyState icon={<Icon name="film" size={32} />} title="Start your first production"
          body="Create a project, upload a script, and ShotPilot turns it into scenes, cast, locations and a first budget you can review."
          action={role !== "guest" ? <LinkButton href={`/w/${ws}/projects/new`}>Create a project</LinkButton> : null} />
      ) : (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-ink-2">Projects</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => <ProjectCard key={p.id} href={`/w/${ws}/p/${p.id}`} name={p.name} type={p.type} phase={p.phase} updatedAt={p.updatedAt} />)}
          </div>
        </section>
      )}

      <section className="grid gap-3 md:grid-cols-3">
        {[
          { icon: "script" as const, title: "Upload a script", body: "PDF, DOCX, Fountain or plain text. The original is kept unchanged." },
          { icon: "list" as const, title: "Review the breakdown", body: "Scenes, cast, locations and elements — every item traceable to the page." },
          { icon: "money" as const, title: "Estimate the budget", body: "Lean, Standard or Premium scenarios built from your own rate card." },
        ].map((c) => (
          <Card key={c.title} className="p-4">
            <Icon name={c.icon} className="text-accent" />
            <div className="mt-3 text-sm font-semibold">{c.title}</div>
            <p className="mt-1 text-sm text-ink-2">{c.body}</p>
          </Card>
        ))}
      </section>
    </div>
  );
}
