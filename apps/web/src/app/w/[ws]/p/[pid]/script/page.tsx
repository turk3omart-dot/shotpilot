import { getWorkspace, listBreakdowns, listScripts } from "@shotpilot/api";
import { resolveProvider } from "@shotpilot/ai";
import { loadProject, can } from "@/lib/project";
import { Alert, Badge, Card, EmptyState, Icon, PageHeader } from "@/components/ui";
import { AddScriptForm, AnalyseButton } from "@/components/script-forms";

export const metadata = { title: "Script" };

export default async function ScriptPage({ params }: { params: Promise<{ ws: string; pid: string }> }) {
  const { ws, pid } = await params;
  const { ctx, pa } = await loadProject(pid);
  const scripts = await listScripts(ctx, pid);
  const canEdit = can(pa.access, "scripts", "edit");
  const canAnalyse = can(pa.access, "breakdown", "edit");
  const analysed = new Set(can(pa.access, "breakdown") ? (await listBreakdowns(ctx, pid)).map((b) => `${b.scriptTitle}#${b.scriptVersion}`) : []);
  const provider = resolveProvider();
  const { workspace } = await getWorkspace(ctx, ws);
  const blocked = provider.external && !workspace?.aiExternalProcessingEnabled;

  return (
    <div className="space-y-6">
      <PageHeader title="Script" subtitle="Originals are stored unchanged. Every revision is a new version; analysis never edits the source." />
      {provider.isAI ? (
        <Alert tone="ai" title={`AI analysis: ${provider.label}`}>Script text is sent to Anthropic for analysis. Output is labelled as AI suggestions for you to review.</Alert>
      ) : (
        <Alert tone="info" title="Rule-based analysis (no AI)">No AI provider is configured on this server, so analysis uses ShotPilot&apos;s deterministic screenplay parser: scene headings, INT/EXT, day/night, dialogue characters and keyword-matched elements. Set ANTHROPIC_API_KEY to enable Claude.</Alert>
      )}
      {blocked ? <Alert tone="warn" title="External AI processing is off">The workspace owner must enable it in Workspace settings before scripts can be analysed.</Alert> : null}

      {scripts.length === 0 ? (
        canEdit ? <Card className="p-6"><AddScriptForm ws={ws} projectId={pid} /></Card> : <EmptyState title="No script yet" body="A producer hasn't added a script to this project." />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-4">
            {scripts.map((s) => (
              <Card key={s.id} className="overflow-hidden">
                <div className="flex items-center gap-3 border-b border-line px-5 py-4">
                  <Icon name="script" className="text-accent" />
                  <h2 className="font-semibold">{s.title}</h2>
                  <Badge className="ms-auto">{s.versions.length} version{s.versions.length === 1 ? "" : "s"}</Badge>
                </div>
                <ul className="divide-y divide-line">
                  {s.versions.map((v, i) => (
                    <li key={v.versionId} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          Version {v.version}
                          {i === 0 ? <Badge tone="accent">Latest</Badge> : null}
                          {analysed.has(`${s.title}#${v.version}`) ? <Badge tone="ok">Analysed</Badge> : null}
                        </div>
                        <div className="text-xs text-ink-3">{v.sourceKind.toUpperCase()} · {v.lineCount} lines · {v.createdAt.toLocaleString()}</div>
                      </div>
                      {canAnalyse ? (
                        <AnalyseButton ws={ws} projectId={pid} versionId={v.versionId} label={analysed.has(`${s.title}#${v.version}`) ? "Analyse again" : "Analyse script"}
                          disabledReason={blocked ? "Enable external AI processing to analyse." : undefined} />
                      ) : null}
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
          {canEdit ? (
            <Card className="h-fit p-5">
              <h2 className="mb-1 font-semibold">Add a revision</h2>
              <p className="mb-4 text-xs text-ink-3">Adds version {(scripts[0]?.versions[0]?.version ?? 0) + 1} of “{scripts[0]?.title}”. Confirmed breakdowns of earlier versions stay as they are.</p>
              <AddScriptForm ws={ws} projectId={pid} scriptId={scripts[0]?.id} compact />
            </Card>
          ) : null}
        </div>
      )}
    </div>
  );
}
