import type { ScriptAnalysis } from "@shotpilot/shared";

export interface ScriptAnalysisInput {
  /** Immutable source text of the script version. */
  text: string;
  projectName: string;
  projectType: string;
  country: string;
}

export interface ProviderUsage {
  inputTokens?: number;
  outputTokens?: number;
}

export interface ScriptAnalysisResult {
  analysis: ScriptAnalysis;
  usage: ProviderUsage;
  model: string | null;
}

export interface ScriptAnalysisProvider {
  /** Stable id stored on ai_jobs.provider. */
  readonly id: string;
  /** Human-readable label shown in the UI next to every output. */
  readonly label: string;
  /** True when calling this provider sends project data outside ShotPilot's infrastructure. */
  readonly external: boolean;
  /** True when output comes from a language model (vs deterministic rules). */
  readonly isAI: boolean;
  analyzeScript(input: ScriptAnalysisInput, signal?: AbortSignal): Promise<ScriptAnalysisResult>;
}
