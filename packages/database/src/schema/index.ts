/**
 * ShotPilot core schema (Phase 1–2).
 *
 * Conventions:
 *  - UUID primary keys (stable identifiers for the production knowledge graph).
 *  - Every project-scoped row carries `project_id` so authorization can be checked
 *    with one lookup and rows can never be joined across workspaces by mistake.
 *  - `deleted_at` = soft delete where recovery matters.
 *  - Production data derived from scripts carries provenance: origin / confidence /
 *    confirmation / source_ref.
 *  - Editable records carry `version` for optimistic concurrency.
 *
 * See docs/DATABASE_SCHEMA.md for the full ERD including planned entities.
 */
import { sql } from "drizzle-orm";
import {
  bigint,
  date,
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import {
  CONFIDENCE,
  CONFIRMATION,
  ELEMENT_CATEGORIES,
  INT_EXT,
  ORIGINS,
  PROJECT_PHASES,
  PROJECT_ROLES,
  PROJECT_TYPES,
  TIME_OF_DAY,
  WORKSPACE_ROLES,
  type SectionAccess,
  type SourceRef,
} from "@shotpilot/shared";

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const createdAt = () => ts("created_at").notNull().defaultNow();
const updatedAt = () => ts("updated_at").notNull().defaultNow();

export const workspaceRole = pgEnum("workspace_role", WORKSPACE_ROLES);
export const projectRole = pgEnum("project_role", PROJECT_ROLES);
export const projectType = pgEnum("project_type", PROJECT_TYPES);
export const projectPhase = pgEnum("project_phase", PROJECT_PHASES);
export const origin = pgEnum("origin", ORIGINS);
export const confidence = pgEnum("confidence", CONFIDENCE);
export const confirmation = pgEnum("confirmation", CONFIRMATION);
export const intExt = pgEnum("int_ext", INT_EXT);
export const timeOfDay = pgEnum("time_of_day", TIME_OF_DAY);
export const elementCategory = pgEnum("element_category", ELEMENT_CATEGORIES);
export const aiJobStatus = pgEnum("ai_job_status", ["queued", "running", "succeeded", "failed", "cancelled"]);
export const breakdownStatus = pgEnum("breakdown_status", ["draft", "in_review", "confirmed", "superseded"]);

/* ------------------------------- Identity -------------------------------- */

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash"),
    locale: text("locale").notNull().default("en"),
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("users_email_lower_idx").on(sql`lower(${t.email})`)],
);

/** Server-side sessions. Only a SHA-256 hash of the cookie token is stored. */
export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: ts("expires_at").notNull(),
    createdAt: createdAt(),
    userAgent: text("user_agent"),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

/* ------------------------------ Workspaces ------------------------------- */

export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  /** Explicit owner opt-in before any project data is sent to an external AI provider. */
  aiExternalProcessingEnabled: boolean("ai_external_processing_enabled").notNull().default(false),
  aiConsentAt: ts("ai_consent_at"),
  aiConsentBy: uuid("ai_consent_by").references(() => users.id),
  defaultCountry: text("default_country").notNull().default("SA"),
  defaultCurrency: text("default_currency").notNull().default("SAR"),
  planKey: text("plan_key").notNull().default("free"),
  isDemo: boolean("is_demo").notNull().default(false),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  deletedAt: ts("deleted_at"),
});

export const workspaceMembers = pgTable(
  "workspace_members",
  {
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: workspaceRole("role").notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.userId] }), index("workspace_members_user_idx").on(t.userId)],
);

/* -------------------------------- Projects ------------------------------- */

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: projectType("type").notNull(),
    description: text("description"),
    country: text("country").notNull().default("SA"),
    currency: text("currency").notNull().default("SAR"),
    phase: projectPhase("phase").notNull().default("development"),
    /** Which lifecycle phases apply to this project (users may skip irrelevant stages). */
    enabledPhases: jsonb("enabled_phases").$type<string[]>().notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: ts("deleted_at"),
  },
  (t) => [index("projects_workspace_idx").on(t.workspaceId)],
);

export const projectMembers = pgTable(
  "project_members",
  {
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: projectRole("role").notNull(),
    title: text("title"),
    department: text("department"),
    overrides: jsonb("overrides").$type<SectionAccess>(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.userId] }), index("project_members_user_idx").on(t.userId)],
);

/* --------------------------------- Files --------------------------------- */

export const files = pgTable(
  "files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
    storageKey: text("storage_key").notNull().unique(),
    filename: text("filename").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    sha256: text("sha256").notNull(),
    uploadedBy: uuid("uploaded_by")
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
    deletedAt: ts("deleted_at"),
  },
  (t) => [index("files_project_idx").on(t.projectId)],
);

/* -------------------------------- Scripts -------------------------------- */

export const scripts = pgTable(
  "scripts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [index("scripts_project_idx").on(t.projectId)],
);

/** Immutable. A revision is a new row; source text is never edited in place. */
export const scriptVersions = pgTable(
  "script_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scriptId: uuid("script_id")
      .notNull()
      .references(() => scripts.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    sourceKind: text("source_kind").notNull(), // pasted | txt | fountain | pdf | docx
    fileId: uuid("file_id").references(() => files.id),
    sourceText: text("source_text").notNull(),
    sourceSha256: text("source_sha256").notNull(),
    lineCount: integer("line_count").notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("script_versions_script_version_idx").on(t.scriptId, t.version)],
);

/* ---------------------------------- AI ----------------------------------- */

export const aiJobs = pgTable(
  "ai_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // script_analysis | ...
    status: aiJobStatus("status").notNull().default("queued"),
    provider: text("provider").notNull(),
    model: text("model"),
    /** True when project data left our infrastructure (external provider). */
    external: boolean("external").notNull(),
    input: jsonb("input").$type<Record<string, unknown>>().notNull(),
    /** Raw validated output, kept for traceability. Never edited. */
    output: jsonb("output").$type<unknown>(),
    error: text("error"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    idempotencyKey: text("idempotency_key"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
    startedAt: ts("started_at"),
    finishedAt: ts("finished_at"),
  },
  (t) => [
    index("ai_jobs_project_idx").on(t.projectId),
    uniqueIndex("ai_jobs_idempotency_idx").on(t.workspaceId, t.idempotencyKey),
  ],
);

/* ------------------------------- Breakdown ------------------------------- */

/** One breakdown per analysed script version. A new script version never mutates an old breakdown. */
export const breakdowns = pgTable(
  "breakdowns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    scriptVersionId: uuid("script_version_id")
      .notNull()
      .references(() => scriptVersions.id),
    aiJobId: uuid("ai_job_id").references(() => aiJobs.id),
    status: breakdownStatus("status").notNull().default("draft"),
    providerLabel: text("provider_label").notNull(),
    logline: text("logline"),
    genreGuess: text("genre_guess"),
    warnings: jsonb("warnings").$type<string[]>().notNull().default([]),
    confirmedAt: ts("confirmed_at"),
    confirmedBy: uuid("confirmed_by").references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("breakdowns_project_idx").on(t.projectId)],
);

export const locations = pgTable(
  "locations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    description: text("description"),
    address: text("address"),
    origin: origin("origin").notNull(),
    confirmation: confirmation("confirmation").notNull().default("unconfirmed"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("locations_project_name_idx").on(t.projectId, t.normalizedName)],
);

export const characters = pgTable(
  "characters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    description: text("description"),
    hasDialogue: boolean("has_dialogue").notNull().default(false),
    origin: origin("origin").notNull(),
    confidence: confidence("confidence"),
    confirmation: confirmation("confirmation").notNull().default("unconfirmed"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("characters_project_name_idx").on(t.projectId, t.normalizedName)],
);

export const scenes = pgTable(
  "scenes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    breakdownId: uuid("breakdown_id")
      .notNull()
      .references(() => breakdowns.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull(),
    number: text("number").notNull(),
    heading: text("heading").notNull(),
    intExt: intExt("int_ext").notNull(),
    timeOfDay: timeOfDay("time_of_day").notNull(),
    locationId: uuid("location_id").references(() => locations.id, { onDelete: "set null" }),
    synopsis: text("synopsis"),
    excerpt: text("excerpt"),
    sourceRef: jsonb("source_ref").$type<SourceRef>(),
    complexity: text("complexity"),
    estSetupMinMin: integer("est_setup_min_min"),
    estSetupMinMax: integer("est_setup_min_max"),
    estShootMinMin: integer("est_shoot_min_min"),
    estShootMinMax: integer("est_shoot_min_max"),
    risks: jsonb("risks").$type<string[]>().notNull().default([]),
    assumptions: jsonb("assumptions").$type<string[]>().notNull().default([]),
    notes: text("notes"),
    origin: origin("origin").notNull(),
    confidence: confidence("confidence"),
    confirmation: confirmation("confirmation").notNull().default("unconfirmed"),
    version: integer("version").notNull().default(1),
    updatedBy: uuid("updated_by").references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("scenes_breakdown_idx").on(t.breakdownId, t.sortOrder), index("scenes_location_idx").on(t.locationId)],
);

export const sceneCharacters = pgTable(
  "scene_characters",
  {
    sceneId: uuid("scene_id")
      .notNull()
      .references(() => scenes.id, { onDelete: "cascade" }),
    characterId: uuid("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.sceneId, t.characterId] }), index("scene_characters_char_idx").on(t.characterId)],
);

export const breakdownElements = pgTable(
  "breakdown_elements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    sceneId: uuid("scene_id")
      .notNull()
      .references(() => scenes.id, { onDelete: "cascade" }),
    category: elementCategory("category").notNull(),
    name: text("name").notNull(),
    quantity: integer("quantity"),
    notes: text("notes"),
    sourceRef: jsonb("source_ref").$type<SourceRef>(),
    origin: origin("origin").notNull(),
    confidence: confidence("confidence"),
    confirmation: confirmation("confirmation").notNull().default("unconfirmed"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("breakdown_elements_scene_idx").on(t.sceneId)],
);

export const clarifyingQuestions = pgTable("clarifying_questions", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  breakdownId: uuid("breakdown_id")
    .notNull()
    .references(() => breakdowns.id, { onDelete: "cascade" }),
  question: text("question").notNull(),
  why: text("why"),
  priority: text("priority").notNull(),
  answer: text("answer"),
  answeredBy: uuid("answered_by").references(() => users.id),
  answeredAt: ts("answered_at"),
  createdAt: createdAt(),
});

/* -------------------------------- Budgets -------------------------------- */

/** Rate cards are configurable. Seeded cards are flagged `is_sample` — they are not market quotes. */
export const rateCards = pgTable("rate_cards", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  country: text("country").notNull(),
  currency: text("currency").notNull(),
  isSample: boolean("is_sample").notNull().default(false),
  createdAt: createdAt(),
});

export const rateCardItems = pgTable(
  "rate_card_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    rateCardId: uuid("rate_card_id")
      .notNull()
      .references(() => rateCards.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    category: text("category").notNull(),
    label: text("label").notNull(),
    unit: text("unit").notNull(), // day | flat | hour | person_day
    rate: numeric("rate", { precision: 14, scale: 2, mode: "number" }).notNull(),
  },
  (t) => [uniqueIndex("rate_card_items_key_idx").on(t.rateCardId, t.key)],
);

export const budgets = pgTable(
  "budgets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    scenario: text("scenario").notNull(), // lean | standard | premium | custom
    currency: text("currency").notNull(),
    rateCardId: uuid("rate_card_id").references(() => rateCards.id),
    breakdownId: uuid("breakdown_id").references(() => breakdowns.id),
    contingencyPct: numeric("contingency_pct", { precision: 5, scale: 2, mode: "number" }).notNull().default(10),
    taxPct: numeric("tax_pct", { precision: 5, scale: 2, mode: "number" }).notNull().default(15),
    assumptions: jsonb("assumptions").$type<string[]>().notNull().default([]),
    status: text("status").notNull().default("draft"), // draft | approved | locked
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("budgets_project_idx").on(t.projectId)],
);

export const budgetLineItems = pgTable(
  "budget_line_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    budgetId: uuid("budget_id")
      .notNull()
      .references(() => budgets.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    section: text("section").notNull(), // development | pre_production | production | post_production | additional
    category: text("category").notNull(),
    label: text("label").notNull(),
    quantity: numeric("quantity", { precision: 12, scale: 2, mode: "number" }).notNull(),
    unit: text("unit").notNull(),
    units: numeric("units", { precision: 12, scale: 2, mode: "number" }).notNull().default(1),
    rate: numeric("rate", { precision: 14, scale: 2, mode: "number" }).notNull(),
    estimated: numeric("estimated", { precision: 14, scale: 2, mode: "number" }).notNull(),
    quoted: numeric("quoted", { precision: 14, scale: 2, mode: "number" }),
    approved: numeric("approved", { precision: 14, scale: 2, mode: "number" }),
    committed: numeric("committed", { precision: 14, scale: 2, mode: "number" }),
    actual: numeric("actual", { precision: 14, scale: 2, mode: "number" }),
    basis: text("basis"),
    rateKey: text("rate_key"),
    origin: origin("origin").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    version: integer("version").notNull().default(1),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("budget_line_items_budget_idx").on(t.budgetId)],
);

/* --------------------------------- Audit --------------------------------- */

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id").references(() => users.id),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    data: jsonb("data").$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [index("audit_events_project_idx").on(t.projectId, t.createdAt)],
);

/* ------------------------------- Scheduling ------------------------------ */



export const shootingDays = pgTable(
  "shooting_days",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    breakdownId: uuid("breakdown_id").references(() => breakdowns.id),
    dayNumber: integer("day_number").notNull(),
    shootDate: date("shoot_date", { mode: "string" }).notNull(),
    generalCall: text("general_call").notNull().default("07:00"), // HH:MM, local to the production
    wrapTarget: text("wrap_target").notNull().default("17:00"),
    notes: text("notes"),
    version: integer("version").notNull().default(1),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("shooting_days_project_idx").on(t.projectId, t.shootDate)],
);

export const scheduleItems = pgTable(
  "schedule_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    shootingDayId: uuid("shooting_day_id")
      .notNull()
      .references(() => shootingDays.id, { onDelete: "cascade" }),
    sceneId: uuid("scene_id")
      .notNull()
      .references(() => scenes.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("schedule_items_scene_idx").on(t.sceneId),
    index("schedule_items_day_idx").on(t.shootingDayId, t.sortOrder),
  ],
);

/** Immutable snapshot per revision. Content is frozen at generation time. */
export const callSheets = pgTable(
  "call_sheets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    shootingDayId: uuid("shooting_day_id")
      .notNull()
      .references(() => shootingDays.id, { onDelete: "cascade" }),
    revision: integer("revision").notNull(),
    content: jsonb("content").$type<Record<string, unknown>>().notNull(),
    contentHash: text("content_hash").notNull(),
    shareTokenHash: text("share_token_hash"),
    shareExpiresAt: ts("share_expires_at"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("call_sheets_day_rev_idx").on(t.shootingDayId, t.revision), index("call_sheets_share_idx").on(t.shareTokenHash)],
);

export const callSheetAcks = pgTable(
  "call_sheet_acks",
  {
    callSheetId: uuid("call_sheet_id")
      .notNull()
      .references(() => callSheets.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    ackedAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.callSheetId, t.userId] })],
);
