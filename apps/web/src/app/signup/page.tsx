import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { AuthForm } from "@/components/auth-form";
import { currentUser } from "@/lib/server";

export const metadata = { title: "Create account" };

export default async function SignupPage() {
  if (await currentUser()) redirect("/");
  return (
    <AuthShell title="Create your account" subtitle="Set up a workspace for your production company in minutes.">
      <AuthForm mode="signup" />
    </AuthShell>
  );
}
