import { EmptyState, Icon, type IconName } from "./ui";

export function ComingSoon({ icon, title, body, phase }: { icon: IconName; title: string; body: string; phase: string }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-8">
      <EmptyState icon={<Icon name={icon} size={32} />} title={title} body={<>{body}<br /><span className="mt-2 inline-block text-xs text-ink-3">Planned for {phase}. Not built yet.</span></>} />
    </div>
  );
}
