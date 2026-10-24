import { getWorkspace, listProjects } from "@shotpilot/api";
import { requireCtx } from "@/lib/server";
import { EmptyState, Icon, LinkButton, PageHeader } from "@/components/ui";
import { ProjectCard } from "@/components/project-card";

export const metadata = { title: "Projects" };

export default async function ProjectsPage({ params }: { params: Promise<{ ws: string }> }) {
  const { ws } = await params;
  const ctx = await requireCtx();
  const { workspace, role } = await getWorkspace(ctx, ws);
  const projects = await listProjects(ctx, workspace.id);
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-8">
      <PageHeader title="Projects" actions={role !== "guest" ? <LinkButton href={`/w/${ws}/projects/new`}><Icon name="plus" size={16} />New project</LinkButton> : null} />
      {projects.length === 0 ? <EmptyState title="No projects yet" body="Projects you create or are invited to appear here." /> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => <ProjectCard key={p.id} href={`/w/${ws}/p/${p.id}`} name={p.name} type={p.type} phase={p.phase} updatedAt={p.updatedAt} />)}
        </div>
      )}
    </div>
  );
}
