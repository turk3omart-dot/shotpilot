/**
 * Role-based access model.
 *
 * Two layers:
 *  1. Workspace role (owner/admin/member/guest) — governs workspace administration.
 *     Owners and admins have full access to every project in the workspace.
 *  2. Project role (production role such as "director" or "client") — governs which
 *     project sections a member can see or edit. Defaults come from ROLE_DEFAULTS and
 *     can be overridden per member via `overrides`.
 *
 * These rules are enforced server-side in @shotpilot/api. The UI uses the same
 * functions only to decide what to render; hiding UI is never the security boundary.
 */

export const WORKSPACE_ROLES = ["owner", "admin", "member", "guest"] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export const PROJECT_SECTIONS = [
  "overview",
  "scripts",
  "breakdown",
  "budget",
  "contracts",
  "crew",
  "schedule",
  "locations",
  "equipment",
  "conversations",
  "files",
  "reviews",
  "deliverables",
  "analytics",
  "settings",
] as const;
export type ProjectSection = (typeof PROJECT_SECTIONS)[number];

export const ACCESS_LEVELS = ["none", "view", "edit"] as const;
export type AccessLevel = (typeof ACCESS_LEVELS)[number];

const LEVEL_RANK: Record<AccessLevel, number> = { none: 0, view: 1, edit: 2 };

export function satisfies(have: AccessLevel, need: AccessLevel): boolean {
  return LEVEL_RANK[have] >= LEVEL_RANK[need];
}

export const PROJECT_ROLES = [
  "executive_producer",
  "producer",
  "production_manager",
  "director",
  "assistant_director",
  "director_of_photography",
  "camera_operator",
  "photographer",
  "art_director",
  "casting_director",
  "wardrobe",
  "location_manager",
  "sound",
  "editor",
  "colorist",
  "motion_designer",
  "talent",
  "client",
  "vendor",
  "custom",
] as const;
export type ProjectRole = (typeof PROJECT_ROLES)[number];

export type SectionAccess = Partial<Record<ProjectSection, AccessLevel>>;

const ALL_EDIT: SectionAccess = Object.fromEntries(PROJECT_SECTIONS.map((s) => [s, "edit"]));

/** Creative/technical crew baseline: sees the production plan, not money or contracts. */
const CREW_BASE: SectionAccess = {
  overview: "view",
  scripts: "view",
  breakdown: "view",
  schedule: "view",
  locations: "view",
  equipment: "view",
  conversations: "edit",
  files: "view",
  crew: "view",
};

export const ROLE_DEFAULTS: Record<ProjectRole, SectionAccess> = {
  executive_producer: ALL_EDIT,
  producer: ALL_EDIT,
  production_manager: { ...ALL_EDIT, contracts: "view", settings: "view" },
  director: { ...CREW_BASE, scripts: "edit", breakdown: "edit", reviews: "edit", deliverables: "view" },
  assistant_director: { ...CREW_BASE, breakdown: "edit", schedule: "edit" },
  director_of_photography: { ...CREW_BASE, equipment: "edit" },
  camera_operator: CREW_BASE,
  photographer: CREW_BASE,
  art_director: { ...CREW_BASE, breakdown: "edit" },
  casting_director: { ...CREW_BASE, breakdown: "edit" },
  wardrobe: CREW_BASE,
  location_manager: { ...CREW_BASE, locations: "edit" },
  sound: CREW_BASE,
  editor: { overview: "view", scripts: "view", conversations: "edit", files: "edit", reviews: "edit", deliverables: "edit" },
  colorist: { overview: "view", conversations: "edit", files: "view", reviews: "edit", deliverables: "view" },
  motion_designer: { overview: "view", conversations: "edit", files: "view", reviews: "edit", deliverables: "view" },
  // Talent sees their own call info — never budgets, contracts or internal crew lists.
  talent: { overview: "view", schedule: "view", locations: "view", conversations: "edit" },
  // Clients see progress and review material only. Internal conversations are excluded.
  client: { overview: "view", reviews: "edit", deliverables: "view" },
  vendor: { overview: "view", equipment: "view", conversations: "edit" },
  custom: { overview: "view" },
};

export interface AccessContext {
  workspaceRole: WorkspaceRole | null;
  projectRole: ProjectRole | null;
  overrides?: SectionAccess | null;
}

/** Effective access level for one section, after inheritance and explicit overrides. */
export function sectionAccess(ctx: AccessContext, section: ProjectSection): AccessLevel {
  if (ctx.workspaceRole === "owner" || ctx.workspaceRole === "admin") return "edit";
  if (!ctx.projectRole) return "none";
  const override = ctx.overrides?.[section];
  if (override) return override;
  return ROLE_DEFAULTS[ctx.projectRole][section] ?? "none";
}

export function effectiveAccess(ctx: AccessContext): Record<ProjectSection, AccessLevel> {
  return Object.fromEntries(PROJECT_SECTIONS.map((s) => [s, sectionAccess(ctx, s)])) as Record<
    ProjectSection,
    AccessLevel
  >;
}

export function canManageWorkspace(role: WorkspaceRole | null): boolean {
  return role === "owner" || role === "admin";
}

/** Workspace members (not guests) may create projects. */
export function canCreateProject(role: WorkspaceRole | null): boolean {
  return role === "owner" || role === "admin" || role === "member";
}
