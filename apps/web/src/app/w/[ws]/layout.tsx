import Link from "next/link";
import { notFound } from "next/navigation";
import { getWorkspace, listMyWorkspaces, listProjects } from "@shotpilot/api";
import { isDomainError } from "@/lib/action-result";
import { currentLocale, requireCtx } from "@/lib/server";
import { signOutAction, setLocaleAction } from "@/app/auth-actions";
import { BottomLink, RailLink } from "@/components/nav-link";
import { Logo } from "@/components/logo";
import { Icon } from "@/components/ui";

export default async function WorkspaceLayout({ children, params }: { children: React.ReactNode; params: Promise<{ ws: string }> }) {
  const { ws: slug } = await params;
  const ctx = await requireCtx();
  let data;
  try {
    data = await getWorkspace(ctx, slug);
  } catch (e) {
    if (isDomainError(e, "NOT_FOUND")) notFound();
    throw e;
  }
  const [workspaces, projects] = await Promise.all([listMyWorkspaces(ctx), listProjects(ctx, data.workspace.id)]);
  const base = `/w/${slug}`;
  const locale = await currentLocale();

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col bg-rail text-rail-ink md:flex">
        <div className="flex h-14 items-center px-4"><Link href={base}><Logo /></Link></div>
        <details className="group mx-3 mb-3 rounded-[10px] bg-rail-2">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm">
            <span className="grid h-6 w-6 place-items-center rounded-md bg-accent text-xs font-bold text-accent-contrast">{data.workspace.name[0]}</span>
            <span className="truncate font-medium">{data.workspace.name}</span>
            <Icon name="chevron" size={14} className="ms-auto rotate-90 text-rail-ink-2" />
          </summary>
          <div className="space-y-0.5 px-1.5 pb-2">
            {workspaces.map((w) => (
              <Link key={w.id} href={`/w/${w.slug}`} className="block rounded-md px-2 py-1.5 text-sm text-rail-ink-2 hover:bg-rail hover:text-rail-ink">{w.name}</Link>
            ))}
            <Link href="/onboarding" className="block rounded-md px-2 py-1.5 text-sm text-rail-ink-2 hover:bg-rail hover:text-rail-ink">+ New workspace</Link>
          </div>
        </details>
        <nav className="space-y-0.5 px-3" aria-label="Main">
          <RailLink href={base} exact icon="home" label="Home" />
          <RailLink href={`${base}/inbox`} icon="chat" label="Inbox" soon />
          <RailLink href={`${base}/calendar`} icon="calendar" label="Calendar" soon />
          <RailLink href={`${base}/assistant`} icon="sparkle" label="Assistant" soon />
        </nav>
        <div className="mt-6 flex items-center justify-between px-6 text-[11px] font-semibold uppercase tracking-wider text-rail-ink-2">
          Projects
          <Link href={`${base}/projects/new`} className="rounded p-0.5 hover:text-rail-ink" aria-label="New project"><Icon name="plus" size={14} /></Link>
        </div>
        <nav className="mt-1 flex-1 space-y-0.5 overflow-y-auto px-3" aria-label="Projects">
          {projects.length === 0 ? <p className="px-3 py-2 text-xs text-rail-ink-2">No projects yet</p> : null}
          {projects.map((p) => <RailLink key={p.id} href={`${base}/p/${p.id}`} icon="film" label={p.name} />)}
        </nav>
        <div className="border-t border-white/5 p-3">
          <RailLink href={`${base}/settings`} icon="settings" label="Workspace settings" />
          <div className="mt-2 flex items-center gap-2 px-3 text-xs text-rail-ink-2">
            <span className="truncate">{ctx.user.name}</span>
            <form action={setLocaleAction} className="ms-auto">
              <input type="hidden" name="back" value={base} />
              <button name="locale" value={locale === "ar" ? "en" : "ar"} className="rounded px-1.5 py-0.5 hover:bg-rail-2 hover:text-rail-ink" title="Language">{locale === "ar" ? "English" : "العربية"}</button>
            </form>
            <form action={signOutAction}>
              <button className="rounded p-1 hover:bg-rail-2 hover:text-rail-ink" aria-label="Sign out" title="Sign out"><Icon name="logout" size={16} /></button>
            </form>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-bg/85 px-4 backdrop-blur md:hidden">
          <Link href={base}><Logo withWord={false} /></Link>
          <span className="truncate text-sm font-semibold">{data.workspace.name}</span>
          <form action={signOutAction} className="ms-auto"><button aria-label="Sign out" className="p-2 text-ink-3"><Icon name="logout" /></button></form>
        </header>
        <main className="flex-1 pb-20 md:pb-0">{children}</main>
        <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface/95 backdrop-blur md:hidden" aria-label="Main">
          <BottomLink href={base} exact icon="home" label="Home" />
          <BottomLink href={`${base}/projects`} icon="folder" label="Projects" />
          <BottomLink href={`${base}/inbox`} icon="chat" label="Inbox" />
          <BottomLink href={`${base}/calendar`} icon="calendar" label="Calendar" />
          <BottomLink href={`${base}/assistant`} icon="sparkle" label="Assistant" />
        </nav>
      </div>
    </div>
  );
}
