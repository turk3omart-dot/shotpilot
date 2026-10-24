import { and, eq, isNull } from "drizzle-orm";
import { workspaceMembers, workspaces } from "@shotpilot/database";
import { CreateWorkspaceInput, forbidden, invalid, canManageWorkspace } from "@shotpilot/shared";
import type { ServiceContext } from "./context";
import { requireUser } from "./auth";
import { requireWorkspace } from "./authz";
import { recordAudit } from "./audit";

export async function createWorkspace(ctx: ServiceContext, raw: unknown) {
  const userId = requireUser(ctx);
  const input = CreateWorkspaceInput.parse(raw);
  const taken = await ctx.db.query.workspaces.findFirst({ where: eq(workspaces.slug, input.slug) });
  if (taken) throw invalid("That workspace URL is already taken.");
  return ctx.db.transaction(async (tx) => {
    const [ws] = await tx.insert(workspaces).values({ name: input.name, slug: input.slug, createdBy: userId }).returning();
    await tx.insert(workspaceMembers).values({ workspaceId: ws!.id, userId, role: "owner" });
    await recordAudit(tx, { workspaceId: ws!.id, actorId: userId, action: "workspace.created", entityType: "workspace", entityId: ws!.id });
    return ws!;
  });
}

export async function listMyWorkspaces(ctx: ServiceContext) {
  const userId = requireUser(ctx);
  return ctx.db
    .select({ id: workspaces.id, name: workspaces.name, slug: workspaces.slug, role: workspaceMembers.role })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(and(eq(workspaceMembers.userId, userId), isNull(workspaces.deletedAt)))
    .orderBy(workspaces.name);
}

export async function getWorkspace(ctx: ServiceContext, slug: string) {
  return requireWorkspace(ctx, { slug });
}

/**
 * Explicit, audited opt-in before any project content is sent to an external AI provider.
 * Only workspace owners can grant it.
 */
export async function setExternalAiProcessing(ctx: ServiceContext, workspaceId: string, enabled: boolean) {
  const { role, userId } = await requireWorkspace(ctx, { id: workspaceId });
  if (role !== "owner") throw forbidden("Only the workspace owner can change AI data processing.");
  await ctx.db
    .update(workspaces)
    .set({
      aiExternalProcessingEnabled: enabled,
      aiConsentAt: enabled ? new Date() : null,
      aiConsentBy: enabled ? userId : null,
      updatedAt: new Date(),
    })
    .where(eq(workspaces.id, workspaceId));
  await recordAudit(ctx.db, {
    workspaceId,
    actorId: userId,
    action: enabled ? "workspace.ai_external.enabled" : "workspace.ai_external.disabled",
    entityType: "workspace",
    entityId: workspaceId,
  });
}

export { canManageWorkspace };
