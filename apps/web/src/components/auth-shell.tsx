import { Logo } from "./logo";

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden bg-rail p-12 text-rail-ink lg:flex lg:flex-col lg:justify-between">
        <Logo className="text-rail-ink" />
        <div className="max-w-md">
          <p className="text-3xl font-semibold leading-tight tracking-tight">From the first idea to the final frame.</p>
          <p className="mt-4 text-rail-ink-2">Script breakdown, budgets, schedules, crew and call sheets — connected in one production workspace.</p>
        </div>
        <div className="pointer-events-none absolute -bottom-40 -end-40 h-[28rem] w-[28rem] rounded-full bg-accent/25 blur-3xl" aria-hidden />
        <p className="text-xs text-rail-ink-2">© ShotPilot</p>
      </section>
      <section className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden"><Logo /></div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mb-6 mt-1 text-sm text-ink-2">{subtitle}</p>
          {children}
        </div>
      </section>
    </main>
  );
}
