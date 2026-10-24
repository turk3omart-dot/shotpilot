import { users } from "@shotpilot/database";
import { listMyWorkspaces } from "@shotpilot/api";
import { eq } from "drizzle-orm";
import { apiRoute } from "@/lib/api-route";

export const GET = apiRoute(async (ctx) => {
  const user = await ctx.db.query.users.findFirst({ where: eq(users.id, ctx.userId!), columns: { id: true, name: true, email: true, locale: true } });
  return { user, workspaces: await listMyWorkspaces(ctx) };
});
