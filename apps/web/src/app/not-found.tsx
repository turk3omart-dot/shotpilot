import { LinkButton } from "@/components/ui";
export default function NotFound() {
  return (
    <main className="grid min-h-[60vh] place-items-center px-4 text-center">
      <div><p className="text-sm font-medium text-accent-strong">404</p><h1 className="mt-1 text-2xl font-semibold">Not found</h1>
        <p className="mt-2 text-sm text-ink-2">This page doesn&apos;t exist, or you don&apos;t have access to it.</p>
        <LinkButton className="mt-6" href="/">Go home</LinkButton></div>
    </main>
  );
}
