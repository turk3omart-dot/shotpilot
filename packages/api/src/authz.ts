import { and, eq, isNull } from "drizzle-orm";
import { projectMembers, projects, workspaceMembers, workspaces, type Executor } from "@shotpilot/database";
import {
  effectiveAccess,
  forbidden,
  notFound,
  satisfies,
  sectionAccess,
  type AccessLevel,
  type ProjectRole,
  type ProjectSection,
  type SectionAccess,
  type WorkspaceRole,
} from "@shotpilot/shared";
import type { ServiceContext } from "./context";
import { requireUser } from "./auth";

export async function workspaceRoleOf(db: Executor, workspaceId: string, userId: string): Promise<WorkspaceRole | null> {
  const m = await db.query.workspaceMembers.findFirst({
    where: and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)),
  });
  return m?.role ?? null;
}

/** Loads a workspace the caller belongs to. Non-members get NOT_FOUND (no existence leak). */
export async function requireWorkspace(ctx: ServiceContext, by: { id?: string; slug?: string }) {
  const userId = requireUser(ctx);
  const ws = await ctx.db.query.workspaces.findFirst({
    where: and(by.id ? eq(workspaces.id, by.id) : eq(workspaces.slug, by.slug ?? ""), isNull(workspaces.deletedAt)),
  });
  if (!ws) throw notFound("Workspace");
  const role = await workspaceRoleOf(ctx.db, ws.id, userId);
  if (!role) throw notFound("Workspace");
  return { workspace: ws, role, userId };
}

export interface ProjectAccess {
  project: typeof projects.$inferSelect;
  workspaceRole: WorkspaceRole | null;
  projectRole: ProjectRole | null;
  overrides: SectionAccess | null;
  access: Record<ProjectSection, AccessLevel>;
  userId: string;
}

/**
 * Central project authorization check. Every project-scoped service calls this first.
 * - Users with no relationship to the project get NOT_FOUND.
 * - Users who can see the project but lack the section level get FORBIDDEN.
 */
export async function requireProject(
  ctx: ServiceContext,
  projectId: string,
  section: ProjectSection = "overview",
  level: AccessLevel = "view",
): Promise<ProjectAccess> {
  const userId = requireUser(ctx);
  const project = await ctx.db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), isNull(projects.deletedAt)),
  });
  if (!project) throw notFound("Project");
  const [workspaceRole, member] = await Promise.all([
    workspaceRoleOf(ctx.db, project.workspaceId, userId),
    ctx.db.query.projectMembers.findFirst({
      where: and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)),
    }),
  ]);
  const accessCtx = { workspaceRole, projectRole: member?.role ?? null, overrides: member?.overrides ?? null };
  // Must belong to the workspace AND either administer it or be a project member.
  if (!workspaceRole || (!member && workspaceRole !== "owner" && workspaceRole !== "admin")) {
    throw notFound("Project");
  }
  const have = sectionAccess(accessCtx, section);
  if (!satisfies(have, level)) {
    throw forbidden(level === "edit" ? `You can't edit ${section} on this project.` : `You don't have access to ${section} on this project.`);
  }
  return { project, ...accessCtx, access: effectiveAccess(accessCtx), userId };
}
