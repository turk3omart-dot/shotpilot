import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { AuthForm } from "@/components/auth-form";
import { currentUser } from "@/lib/server";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await currentUser()) redirect("/");
  const { next } = await searchParams;
  return (
    <AuthShell title="Welcome back" subtitle="Sign in to your production workspace.">
      <AuthForm mode="signin" next={next} />
    </AuthShell>
  );
}
