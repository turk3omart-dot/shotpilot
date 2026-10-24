import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { requireProject } from "@shotpilot/api";
import type { AccessLevel, ProjectSection } from "@shotpilot/shared";
import { isDomainError } from "./action-result";
import { requireCtx } from "./server";

/** Loads project access for a page; maps NOT_FOUND to 404 (and FORBIDDEN to 404 too when asked). */
export const loadProject = cache(async (projectId: string) => {
  const ctx = await requireCtx();
  try {
    return { ctx, pa: await requireProject(ctx, projectId, "overview", "view") };
  } catch (e) {
    if (isDomainError(e, "NOT_FOUND")) notFound();
    throw e;
  }
});

export function can(access: Record<ProjectSection, AccessLevel>, section: ProjectSection, level: AccessLevel = "view") {
  const rank = { none: 0, view: 1, edit: 2 } as const;
  return rank[access[section]] >= rank[level];
}
