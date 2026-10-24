import { redirect } from "next/navigation";
import { getDb } from "@shotpilot/database";
import { listMyWorkspaces } from "@shotpilot/api";
import { currentUser } from "@/lib/server";

export default async function Root() {
  const user = await currentUser();
  if (!user) redirect("/login");
  const ws = await listMyWorkspaces({ db: getDb(), userId: user.id });
  redirect(ws[0] ? `/w/${ws[0].slug}` : "/onboarding");
}
