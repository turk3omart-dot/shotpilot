import { redirect } from "next/navigation";
import { getAiJob } from "@shotpilot/api";
import { loadProject } from "@/lib/project";
import { Alert, Card, LinkButton } from "@/components/ui";
import { JobPoller } from "@/components/job-status";

export const metadata = { title: "Analysing" };

export default async function JobPage({ params }: { params: Promise<{ ws: string; pid: string; jobId: string }> }) {
  const { ws, pid, jobId } = await params;
  const { ctx } = await loadProject(pid);
  const job = await getAiJob(ctx, jobId);
  if (job.status === "succeeded" && job.breakdownId) redirect(`/w/${ws}/p/${pid}/breakdown?id=${job.breakdownId}`);
  const running = job.status === "queued" || job.status === "running";
  return (
    <Card className="mx-auto max-w-xl p-8 text-center">
      <JobPoller active={running} />
      {running ? (
        <>
          <div className="mx-auto mb-5 h-10 w-10 animate-spin rounded-full border-[3px] border-accent border-t-transparent" aria-hidden />
          <h2 className="text-lg font-semibold">Analysing your script…</h2>
          <p className="mt-1 text-sm text-ink-2">Finding scenes, characters, locations and production elements. You can leave this page — the analysis keeps running.</p>
          <div className="mx-auto mt-6 max-w-xs space-y-2" aria-hidden>
            <div className="sp-skeleton h-3" /><div className="sp-skeleton h-3 w-4/5" /><div className="sp-skeleton h-3 w-3/5" />
          </div>
        </>
      ) : (
        <>
          <Alert tone="danger" title="Analysis failed">{job.error ?? "Unknown error."} Your script and any existing breakdown are unchanged.</Alert>
          <LinkButton className="mt-5" variant="secondary" href={`/w/${ws}/p/${pid}/script`}>Back to script</LinkButton>
        </>
      )}
    </Card>
  );
}
