import { getWorkspace } from "@shotpilot/api";
import { resolveProvider } from "@shotpilot/ai";
import { requireCtx } from "@/lib/server";
import { Badge, Card, PageHeader } from "@/components/ui";
import { AiConsentForm } from "@/components/ai-consent-form";

export const metadata = { title: "Workspace settings" };

export default async function Settings({ params }: { params: Promise<{ ws: string }> }) {
  const { ws } = await params;
  const { workspace, role } = await getWorkspace(await requireCtx(), ws);
  const provider = resolveProvider();
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-8">
      <PageHeader title="Workspace settings" subtitle={workspace.name} />
      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">AI data processing</h2>
          {workspace.aiExternalProcessingEnabled ? <Badge tone="ai">Enabled{workspace.aiConsentAt ? ` · ${workspace.aiConsentAt.toLocaleDateString()}` : ""}</Badge> : <Badge>Off</Badge>}
        </div>
        <AiConsentForm workspace={ws} enabled={workspace.aiExternalProcessingEnabled} isOwner={role === "owner"} providerLabel={provider.label} providerExternal={provider.external} />
      </Card>
      <Card className="p-6">
        <h2 className="font-semibold">Defaults</h2>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div><dt className="text-ink-3">Country</dt><dd>{workspace.defaultCountry}</dd></div>
          <div><dt className="text-ink-3">Currency</dt><dd>{workspace.defaultCurrency}</dd></div>
          <div><dt className="text-ink-3">Your role</dt><dd className="capitalize">{role}</dd></div>
          <div><dt className="text-ink-3">Plan</dt><dd className="capitalize">{workspace.planKey}</dd></div>
        </dl>
      </Card>
    </div>
  );
}
