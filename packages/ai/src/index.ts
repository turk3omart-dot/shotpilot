import { AnthropicProvider } from "./providers/anthropic";
import { HeuristicProvider } from "./providers/heuristic";
import type { ScriptAnalysisProvider } from "./providers/types";

export * from "./providers/types";
export { AnthropicProvider, DEFAULT_ANTHROPIC_MODEL } from "./providers/anthropic";
export { HeuristicProvider } from "./providers/heuristic";
export * from "./screenplay-parser";
export * from "./extract";
export { numberLines } from "./text";

export type ProviderSetting = "auto" | "anthropic" | "heuristic";

/**
 * Picks the script-analysis provider from configuration.
 * `auto` uses Claude when ANTHROPIC_API_KEY is set, otherwise the rule-based parser.
 * Workspace consent is checked separately by the caller before any external provider runs.
 */
export function resolveProvider(env: Record<string, string | undefined> = process.env): ScriptAnalysisProvider {
  const setting = (env.SHOTPILOT_AI_PROVIDER ?? "auto") as ProviderSetting;
  const hasKey = Boolean(env.ANTHROPIC_API_KEY);
  if (setting === "heuristic") return new HeuristicProvider();
  if (setting === "anthropic" || (setting === "auto" && hasKey)) {
    if (!hasKey) throw new Error("SHOTPILOT_AI_PROVIDER=anthropic but ANTHROPIC_API_KEY is not set");
    return new AnthropicProvider({ apiKey: env.ANTHROPIC_API_KEY, model: env.SHOTPILOT_AI_MODEL || undefined });
  }
  return new HeuristicProvider();
}
