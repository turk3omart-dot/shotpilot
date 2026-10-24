import type { ScriptAnalysis } from "@shotpilot/shared";
import { confidenceForScene, parseScreenplay } from "../screenplay-parser";
import type { ScriptAnalysisInput, ScriptAnalysisProvider, ScriptAnalysisResult } from "./types";

/**
 * Development / offline provider. Uses the deterministic parser only — no language model.
 * The UI labels its output "Rule-based parser (no AI)" so it is never mistaken for live AI.
 */
export class HeuristicProvider implements ScriptAnalysisProvider {
  readonly id = "heuristic";
  readonly label = "Rule-based parser (no AI)";
  readonly external = false;
  readonly isAI = false;

  async analyzeScript(input: ScriptAnalysisInput): Promise<ScriptAnalysisResult> {
    const parsed = parseScreenplay(input.text);
    const questions: ScriptAnalysis["questions"] = [
      { question: "What is the production country and city?", why: "Drives rate cards, permits and travel.", priority: "high" },
      { question: "Are any locations already secured?", why: "Affects scouting time and permit risk.", priority: "high" },
      { question: "Is there a target budget or deadline?", why: "Selects the Lean / Standard / Premium scenario.", priority: "medium" },
    ];
    if (parsed.scenes.length === 0) {
      questions.unshift({
        question: "Is this a treatment or idea rather than a formatted screenplay?",
        why: "No scene headings were found, so scenes could not be extracted automatically.",
        priority: "high",
      });
    }
    const analysis: ScriptAnalysis = {
      projectTypeGuess: null,
      genreGuess: null,
      logline: null,
      scenes: parsed.scenes.map((s) => ({
        number: s.number,
        heading: s.heading,
        intExt: s.intExt,
        location: s.location,
        timeOfDay: s.timeOfDay,
        synopsis: null,
        characters: s.characters,
        elements: s.elements,
        complexity: null,
        estSetupMinutes: null,
        estShootMinutes: null,
        risks: [],
        assumptions: [],
        confidence: confidenceForScene(s),
        source: { startLine: s.startLine, endLine: s.endLine, quote: s.heading },
      })),
      characters: parsed.characters.map((c) => ({
        name: c.name,
        description: null,
        hasDialogue: c.hasDialogue,
        confidence: "high" as const,
      })),
      questions: questions.slice(0, 5),
      warnings: [
        "Analysed with the rule-based parser. Props, wardrobe, synopsis and time estimates need an AI provider or manual entry.",
        ...parsed.warnings,
      ],
    };
    return { analysis, usage: {}, model: null };
  }
}
