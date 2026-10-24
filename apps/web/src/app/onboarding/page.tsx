import { AuthShell } from "@/components/auth-shell";
import { WorkspaceForm } from "@/components/workspace-form";
import { requireCtx } from "@/lib/server";

export const metadata = { title: "Create workspace" };

export default async function Onboarding() {
  const { user } = await requireCtx();
  return (
    <AuthShell title={`Welcome, ${user.name.split(" ")[0]}`} subtitle="Create a workspace for your production company or team. You can invite people later.">
      <WorkspaceForm />
    </AuthShell>
  );
}
