import { getWorkspace } from "@shotpilot/api";
import { requireCtx } from "@/lib/server";
import { Card, PageHeader } from "@/components/ui";
import { ProjectForm } from "@/components/project-form";

export const metadata = { title: "New project" };

export default async function NewProject({ params }: { params: Promise<{ ws: string }> }) {
  const { ws } = await params;
  const { workspace } = await getWorkspace(await requireCtx(), ws);
  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:px-8">
      <PageHeader title="New project" subtitle="Just the basics — you can add everything else as the production takes shape." />
      <Card className="p-6"><ProjectForm workspace={ws} country={workspace.defaultCountry} currency={workspace.defaultCurrency} /></Card>
    </div>
  );
}
