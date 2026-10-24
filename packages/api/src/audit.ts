import { auditEvents, type Executor } from "@shotpilot/database";

export interface AuditInput {
  workspaceId?: string | null;
  projectId?: string | null;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  data?: Record<string, unknown>;
}

export async function recordAudit(db: Executor, e: AuditInput) {
  await db.insert(auditEvents).values({
    workspaceId: e.workspaceId ?? null,
    projectId: e.projectId ?? null,
    actorId: e.actorId,
    action: e.action,
    entityType: e.entityType,
    entityId: e.entityId ?? null,
    data: e.data ?? null,
  });
}
