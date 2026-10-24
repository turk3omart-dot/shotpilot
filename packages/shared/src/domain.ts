import { z } from "zod";

export const PROJECT_TYPES = [
  "feature_film",
  "short_film",
  "commercial",
  "documentary",
  "branded_content",
  "music_video",
  "series_episode",
  "photography",
  "event",
  "other",
] as const;
export type ProjectType = (typeof PROJECT_TYPES)[number];

/** Lifecycle stages. Projects choose which ones apply (e.g. photography skips post sound). */
export const PROJECT_PHASES = [
  "development",
  "script_analysis",
  "breakdown",
  "budgeting",
  "pre_production",
  "scheduling",
  "crew_resources",
  "production",
  "post_production",
  "client_review",
  "delivery",
  "closed",
] as const;
export type ProjectPhase = (typeof PROJECT_PHASES)[number];

/**
 * Provenance of a piece of production data. Distinguishes what the user wrote,
 * what a deterministic parser found in the source, what an AI inferred, and what a
 * person has confirmed.
 */
export const ORIGINS = ["parser", "ai", "user"] as const;
export type Origin = (typeof ORIGINS)[number];

export const CONFIDENCE = ["low", "medium", "high"] as const;
export type Confidence = (typeof CONFIDENCE)[number];

export const CONFIRMATION = ["unconfirmed", "confirmed", "rejected"] as const;
export type Confirmation = (typeof CONFIRMATION)[number];

export const INT_EXT = ["INT", "EXT", "INT/EXT", "UNKNOWN"] as const;
export type IntExt = (typeof INT_EXT)[number];

export const TIME_OF_DAY = ["DAY", "NIGHT", "DAWN", "DUSK", "MORNING", "EVENING", "CONTINUOUS", "UNKNOWN"] as const;
export type TimeOfDay = (typeof TIME_OF_DAY)[number];

export const ELEMENT_CATEGORIES = [
  "prop",
  "wardrobe",
  "makeup",
  "vehicle",
  "animal",
  "extras",
  "sfx",
  "vfx",
  "drone",
  "equipment",
  "sound",
  "production_design",
  "safety",
  "other",
] as const;
export type ElementCategory = (typeof ELEMENT_CATEGORIES)[number];

export const COMPLEXITY = ["low", "medium", "high"] as const;

/** A pointer back into the immutable script source (1-based, inclusive line numbers). */
export const SourceRef = z.object({
  startLine: z.number().int().min(1),
  endLine: z.number().int().min(1),
  quote: z.string().max(500).optional(),
});
export type SourceRef = z.infer<typeof SourceRef>;

/* ---------- Script analysis output contract (shared by every AI provider) ---------- */

export const AnalyzedElement = z.object({
  category: z.enum(ELEMENT_CATEGORIES),
  name: z.string().min(1).max(200),
  quantity: z.number().int().min(1).max(10000).nullable().default(null),
  notes: z.string().max(1000).nullable().default(null),
  confidence: z.enum(CONFIDENCE),
  source: SourceRef.nullable().default(null),
});
export type AnalyzedElement = z.infer<typeof AnalyzedElement>;

export const AnalyzedScene = z.object({
  number: z.string().min(1).max(20),
  heading: z.string().max(300),
  intExt: z.enum(INT_EXT),
  location: z.string().max(200),
  timeOfDay: z.enum(TIME_OF_DAY),
  synopsis: z.string().max(2000).nullable().default(null),
  characters: z.array(z.string().max(120)).max(200),
  elements: z.array(AnalyzedElement).max(300),
  complexity: z.enum(COMPLEXITY).nullable().default(null),
  /** Ranges, never fake precision. Minutes. */
  estSetupMinutes: z.object({ min: z.number().int().min(0), max: z.number().int().min(0) }).nullable().default(null),
  estShootMinutes: z.object({ min: z.number().int().min(0), max: z.number().int().min(0) }).nullable().default(null),
  risks: z.array(z.string().max(500)).max(50).default([]),
  assumptions: z.array(z.string().max(500)).max(50).default([]),
  confidence: z.enum(CONFIDENCE),
  source: SourceRef,
});
export type AnalyzedScene = z.infer<typeof AnalyzedScene>;

export const AnalyzedCharacter = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(1000).nullable().default(null),
  hasDialogue: z.boolean(),
  confidence: z.enum(CONFIDENCE),
});

export const ClarifyingQuestion = z.object({
  question: z.string().max(500),
  why: z.string().max(500),
  priority: z.enum(["high", "medium", "low"]),
});

export const ScriptAnalysis = z.object({
  projectTypeGuess: z.enum(PROJECT_TYPES).nullable().default(null),
  genreGuess: z.string().max(100).nullable().default(null),
  logline: z.string().max(1000).nullable().default(null),
  scenes: z.array(AnalyzedScene).max(1000),
  characters: z.array(AnalyzedCharacter).max(500),
  questions: z.array(ClarifyingQuestion).max(10),
  warnings: z.array(z.string().max(500)).max(50).default([]),
});
export type ScriptAnalysis = z.infer<typeof ScriptAnalysis>;

/* ---------- API input schemas ---------- */

export const slugSchema = z
  .string()
  .min(2)
  .max(48)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers and dashes only");

export const CreateWorkspaceInput = z.object({
  name: z.string().trim().min(2).max(80),
  slug: slugSchema,
});

export const CreateProjectInput = z.object({
  name: z.string().trim().min(1).max(120),
  type: z.enum(PROJECT_TYPES),
  description: z.string().trim().max(2000).optional().nullable(),
  country: z.string().length(2).toUpperCase().default("SA"),
  currency: z.string().length(3).toUpperCase().default("SAR"),
  phases: z.array(z.enum(PROJECT_PHASES)).min(1).optional(),
});

export const UpdateSceneInput = z.object({
  heading: z.string().max(300).optional(),
  intExt: z.enum(INT_EXT).optional(),
  timeOfDay: z.enum(TIME_OF_DAY).optional(),
  synopsis: z.string().max(2000).nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),
  complexity: z.enum(COMPLEXITY).nullable().optional(),
  confirmation: z.enum(CONFIRMATION).optional(),
});

export const ElementInput = z.object({
  category: z.enum(ELEMENT_CATEGORIES),
  name: z.string().trim().min(1).max(200),
  quantity: z.number().int().min(1).max(10000).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 48)
    .replace(/^-|-$/g, "");
}
