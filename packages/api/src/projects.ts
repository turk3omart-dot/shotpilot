import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  breakdowns,
  budgets,
  projectMembers,
  projects,
  scenes,
  scriptVersions,
  scripts,
  users,
  workspaceMembers,
} from "@shotpilot/database";
import {
  CreateProjectInput,
  PROJECT_PHASES,
  PROJECT_ROLES,
  canCreateProject,
  canManageWorkspace,
  forbidden,
  invalid,
  notFound,
  type ProjectRole,
  type SectionAccess,
} from "@shotpilot/shared";
import { z } from "zod";
import type { ServiceContext } from "./context";
import { requireProject, requireWorkspace } from "./authz";
import { recordAudit } from "./audit";

export async function createProject(ctx: ServiceContext, workspaceId: string, raw: unknown) {
  const { role, userId, workspace } = await requireWorkspace(ctx, { id: workspaceId });
  if (!canCreateProject(role)) throw forbidden("Guests can't create projects.");
  const input = CreateProjectInput.parse(raw);
  return ctx.db.transaction(async (tx) => {
    const [project] = await tx
      .insert(projects)
      .values({
        workspaceId,
        name: input.name,
        type: input.type,
        description: input.description ?? null,
        country: input.country ?? workspace.defaultCountry,
        currency: input.currency ?? workspace.defaultCurrency,
        enabledPhases: input.phases ?? [...PROJECT_PHASES],
        createdBy: userId,
      })
      .returning();
    // The creator becomes the project's producer.
    await tx.insert(projectMembers).values({ projectId: project!.id, userId, role: "producer" });
    await recordAudit(tx, { workspaceId, projectId: project!.id, actorId: userId, action: "project.created", entityType: "project", entityId: project!.id });
    return project!;
  });
}

/** Owners/admins see every project; everyone else only projects they are a member of. */
export async function listProjects(ctx: ServiceContext, workspaceId: string) {
  const { role, userId } = await requireWorkspace(ctx, { id: workspaceId });
  const base = and(eq(projects.workspaceId, workspaceId), isNull(projects.deletedAt));
  if (canManageWorkspace(role)) {
    return ctx.db.select().from(projects).where(base).orderBy(desc(projects.updatedAt));
  }
  return ctx.db
    .select({ project: projects })
    .from(projects)
    .innerJoin(projectMembers, and(eq(projectMembers.projectId, projects.id), eq(projectMembers.userId, userId)))
    .where(base)
    .orderBy(desc(projects.updatedAt))
    .then((rows) => rows.map((r) => r.project));
}

/** Dashboard summary. Each block is only included if the caller can see that section. */
export async function getProjectOverview(ctx: ServiceContext, projectId: string) {
  const pa = await requireProject(ctx, projectId, "overview", "view");
  const out: {
    access: typeof pa;
    scriptCount?: number;
    latestScriptVersion?: { id: string; version: number; createdAt: Date; title: string } | null;
    breakdown?: { id: string; status: string; sceneCount: number; confirmedScenes: number; providerLabel: string } | null;
    budgetCount?: number;
    memberCount?: number;
  } = { access: pa };

  if (pa.access.scripts !== "none") {
    const rows = await ctx.db
      .select({ id: scriptVersions.id, version: scriptVersions.version, createdAt: scriptVersions.createdAt, title: scripts.title })
      .from(scriptVersions)
      .innerJoin(scripts, eq(scripts.id, scriptVersions.scriptId))
      .where(eq(scriptVersions.projectId, projectId))
      .orderBy(desc(scriptVersions.createdAt));
    out.scriptCount = rows.length;
    out.latestScriptVersion = rows[0] ?? null;
  }
  if (pa.access.breakdown !== "none") {
    const b = await ctx.db.query.breakdowns.findFirst({
      where: and(eq(breakdowns.projectId, projectId), inArray(breakdowns.status, ["draft", "in_review", "confirmed"])),
      orderBy: desc(breakdowns.createdAt),
    });
    if (b) {
      const [c] = await ctx.db
        .select({
          total: sql<number>`count(*)::int`,
          confirmed: sql<number>`count(*) filter (where ${scenes.confirmation} = 'confirmed')::int`,
        })
        .from(scenes)
        .where(eq(scenes.breakdownId, b.id));
      out.breakdown = { id: b.id, status: b.status, providerLabel: b.providerLabel, sceneCount: c?.total ?? 0, confirmedScenes: c?.confirmed ?? 0 };
    } else out.breakdown = null;
  }
  if (pa.access.budget !== "none") {
    const [c] = await ctx.db.select({ n: sql<number>`count(*)::int` }).from(budgets).where(eq(budgets.projectId, projectId));
    out.budgetCount = c?.n ?? 0;
  }
  if (pa.access.crew !== "none") {
    const [c] = await ctx.db.select({ n: sql<number>`count(*)::int` }).from(projectMembers).where(eq(projectMembers.projectId, projectId));
    out.memberCount = c?.n ?? 0;
  }
  return out;
}

export const AddMemberInput = z.object({
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(PROJECT_ROLES),
  title: z.string().trim().max(100).optional(),
  department: z.string().trim().max(100).optional(),
});

/**
 * Adds an existing ShotPilot user to a project (email invitations for new users are Phase 4).
 * The user is added to the workspace as a guest if they are not already a member.
 */
export async function addProjectMember(ctx: ServiceContext, projectId: string, raw: unknown) {
  const pa = await requireProject(ctx, projectId, "crew", "edit");
  const input = AddMemberInput.parse(raw);
  const user = await ctx.db.query.users.findFirst({ where: sql`lower(${users.email}) = ${input.email}` });
  if (!user) throw invalid("No ShotPilot account uses that email yet. Email invitations arrive in a later release.");
  await ctx.db.transaction(async (tx) => {
    await tx
      .insert(workspaceMembers)
      .values({ workspaceId: pa.project.workspaceId, userId: user.id, role: "guest" })
      .onConflictDoNothing();
    await tx
      .insert(projectMembers)
      .values({ projectId, userId: user.id, role: input.role, title: input.title, department: input.department })
      .onConflictDoUpdate({
        target: [projectMembers.projectId, projectMembers.userId],
        set: { role: input.role, title: input.title, department: input.department },
      });
    await recordAudit(tx, {
      workspaceId: pa.project.workspaceId,
      projectId,
      actorId: pa.userId,
      action: "project.member.added",
      entityType: "user",
      entityId: user.id,
      data: { role: input.role },
    });
  });
  return user;
}

export async function setMemberOverrides(ctx: ServiceContext, projectId: string, userId: string, overrides: SectionAccess | null) {
  const pa = await requireProject(ctx, projectId, "settings", "edit");
  const res = await ctx.db
    .update(projectMembers)
    .set({ overrides })
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)))
    .returning();
  if (!res.length) throw notFound("Member");
  await recordAudit(ctx.db, { workspaceId: pa.project.workspaceId, projectId, actorId: pa.userId, action: "project.member.permissions_changed", entityType: "user", entityId: userId, data: { overrides } });
}

export async function removeProjectMember(ctx: ServiceContext, projectId: string, userId: string) {
  const pa = await requireProject(ctx, projectId, "crew", "edit");
  if (userId === pa.userId) throw invalid("You can't remove yourself from a project.");
  await ctx.db.delete(projectMembers).where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)));
  await recordAudit(ctx.db, { workspaceId: pa.project.workspaceId, projectId, actorId: pa.userId, action: "project.member.removed", entityType: "user", entityId: userId });
}

export async function listProjectMembers(ctx: ServiceContext, projectId: string) {
  await requireProject(ctx, projectId, "crew", "view");
  return ctx.db
    .select({ userId: users.id, name: users.name, email: users.email, role: projectMembers.role, title: projectMembers.title, department: projectMembers.department })
    .from(projectMembers)
    .innerJoin(users, eq(users.id, projectMembers.userId))
    .where(eq(projectMembers.projectId, projectId))
    .orderBy(users.name);
}

export type { ProjectRole };
