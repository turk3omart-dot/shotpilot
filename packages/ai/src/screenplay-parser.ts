/**
 * Deterministic screenplay parser.
 *
 * Recognises standard scene headings (INT./EXT./INT/EXT, optional scene numbers,
 * Fountain forced headings) and Arabic headings (داخلي / خارجي with نهار / ليل),
 * dialogue cues, and a small keyword list of production elements.
 *
 * This is NOT AI. Everything it returns is either literally present in the text
 * (scene headings, dialogue cues) or a keyword match marked low confidence.
 * It is used (a) as the offline/dev analysis provider and (b) as a cross-check on
 * AI output (scene count and headings).
 */
import type { AnalyzedElement, Confidence, ElementCategory, IntExt, TimeOfDay } from "@shotpilot/shared";

export interface ParsedScene {
  number: string;
  heading: string;
  intExt: IntExt;
  location: string;
  timeOfDay: TimeOfDay;
  startLine: number;
  endLine: number;
  characters: string[];
  elements: AnalyzedElement[];
  actionText: string;
}

export interface ParsedScript {
  scenes: ParsedScene[];
  characters: { name: string; hasDialogue: boolean; sceneCount: number }[];
  warnings: string[];
  lineCount: number;
}

const HEADING_RE =
  /^\s*(?:(\d+[A-Z]{0,2})[.)]?\s+)?(INT\.?\s*\/\s*EXT\.?|EXT\.?\s*\/\s*INT\.?|I\/E\.?|INT\.|EXT\.|INT\s|EXT\s|EST\.)\s*(.+?)\s*(?:\s\d+[A-Z]{0,2})?\s*$/;
const FORCED_HEADING_RE = /^\.(?!\.)(\S.*)$/;
const AR_HEADING_RE = /^\s*(?:(\d+)\s*[-.:)]?\s*)?(داخلي\s*\/\s*خارجي|خارجي\s*\/\s*داخلي|داخلي|خارجي)\s*[-–.:،]?\s*(.+)$/;

const TIME_WORDS: [RegExp, TimeOfDay][] = [
  [/\b(NIGHT|LATE NIGHT|MIDNIGHT)\b|ليل|ليلا|ليلاً/, "NIGHT"],
  [/\bDAWN\b|\bSUNRISE\b|فجر/, "DAWN"],
  [/\bDUSK\b|\bSUNSET\b|غروب/, "DUSK"],
  [/\bMORNING\b|صباح/, "MORNING"],
  [/\bEVENING\b|مساء/, "EVENING"],
  [/\bCONTINUOUS\b|\bLATER\b|\bSAME\b|مستمر/, "CONTINUOUS"],
  [/\b(DAY|AFTERNOON|NOON)\b|نهار|نهاراً|ظهر/, "DAY"],
];

const TRANSITION_RE = /^(?:[A-Z ]+TO:|FADE (?:IN|OUT)[.:]?|CUT TO BLACK[.:]?|THE END|END CREDITS|SMASH CUT|MATCH CUT|INTERCUT.*)$/;
const CUE_EXTENSION_RE = /\s*\((?:V\.?O\.?|O\.?S\.?|O\.?C\.?|CONT'?D|CONT\.|CONTINUING|PRE-?LAP|FILTERED|ON PHONE|INTO PHONE)\)\s*/gi;

interface KeywordRule {
  category: ElementCategory;
  re: RegExp;
  name: (m: RegExpMatchArray) => string;
}

// Deliberately conservative. Keyword hits are suggestions with low confidence.
const KEYWORD_RULES: KeywordRule[] = [
  { category: "vehicle", re: /\b(pickup truck|car|truck|van|taxi|motorcycle|motorbike|bus|jeep|suv|pickup|ambulance|police car|boat|helicopter)s?\b/i, name: (m) => m[1]!.toLowerCase() },
  { category: "animal", re: /\b(dog|horse|camel|falcon|cat|bird|goat|sheep|hawk)s?\b/i, name: (m) => m[1]!.toLowerCase() },
  { category: "drone", re: /\b(drone shot|drone|aerial shot|aerial view|bird'?s[- ]eye)\b/i, name: () => "aerial / drone shot" },
  { category: "sfx", re: /\b(explosion|explodes|fire|flames|smoke|rain|gunshot|gunfire|sparks|fog)\b/i, name: (m) => m[1]!.toLowerCase() },
  { category: "vfx", re: /\b(VFX|CGI|hologram|holographic|green ?screen|morphs|disappears into thin air)\b/i, name: (m) => m[1]!.toLowerCase() },
  { category: "extras", re: /\b(crowd|crowds|passers-?by|onlookers|guests|shoppers|commuters|audience|extras|pedestrians)\b/i, name: (m) => m[1]!.toLowerCase() },
  { category: "safety", re: /\b(stunt|falls from|jumps from|weapon|gun|knife|rooftop|cliff|water tank|underwater)\b/i, name: (m) => m[1]!.toLowerCase() },
];

export function normalizeName(name: string): string {
  return name.replace(CUE_EXTENSION_RE, " ").replace(/\s+/g, " ").trim().toUpperCase();
}

function splitLocationAndTime(rest: string): { location: string; timeOfDay: TimeOfDay } {
  const parts = rest.split(/\s+[-–—]\s+|\s*[-–—]\s*(?=[A-Z؀-ۿ]+\s*$)/);
  if (parts.length > 1) {
    const last = parts[parts.length - 1]!.trim();
    for (const [re, tod] of TIME_WORDS) {
      if (re.test(last.toUpperCase()) || re.test(last)) {
        return { location: parts.slice(0, -1).join(" - ").trim().replace(/[.,]$/, ""), timeOfDay: tod };
      }
    }
  }
  return { location: rest.trim().replace(/[.,]$/, ""), timeOfDay: "UNKNOWN" };
}

function intExtFrom(token: string): IntExt {
  const t = token.toUpperCase().replace(/\s|\./g, "");
  if (t.includes("/") || t === "I/E") return "INT/EXT";
  if (t.startsWith("INT")) return "INT";
  if (t.startsWith("EXT") || t.startsWith("EST")) return "EXT";
  if (token.includes("/")) return "INT/EXT";
  if (token.includes("داخلي")) return "INT";
  if (token.includes("خارجي")) return "EXT";
  return "UNKNOWN";
}

export function parseHeading(line: string): { number?: string; intExt: IntExt; location: string; timeOfDay: TimeOfDay; heading: string } | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 160) return null;
  let m = trimmed.match(HEADING_RE);
  if (m && trimmed === trimmed.toUpperCase()) {
    const { location, timeOfDay } = splitLocationAndTime(m[3]!);
    return { number: m[1], intExt: intExtFrom(m[2]!), location, timeOfDay, heading: trimmed };
  }
  m = trimmed.match(AR_HEADING_RE);
  if (m) {
    const { location, timeOfDay } = splitLocationAndTime(m[3]!);
    return { number: m[1], intExt: intExtFrom(m[2]!), location, timeOfDay, heading: trimmed };
  }
  m = trimmed.match(FORCED_HEADING_RE);
  if (m) {
    const { location, timeOfDay } = splitLocationAndTime(m[1]!);
    return { intExt: "UNKNOWN", location, timeOfDay, heading: m[1]! };
  }
  return null;
}

function isCue(line: string, prev: string | undefined, next: string | undefined): string | null {
  const raw = line.trim();
  if (!raw || raw.length > 45) return null;
  if (prev !== undefined && prev.trim() !== "") return null;
  if (next === undefined || next.trim() === "") return null;
  if (TRANSITION_RE.test(raw)) return null;
  // Fountain forced character: @Name
  if (raw.startsWith("@")) return normalizeName(raw.slice(1));
  const name = raw.replace(CUE_EXTENSION_RE, " ").replace(/\^$/, "").trim();
  if (!/^[A-Z][A-Z0-9 .'\-#]*[A-Z0-9.)]$/.test(name) && !/^[A-Z]$/.test(name)) return null;
  if (!/[A-Z]{2}/.test(name)) return null;
  if (/[.!?]$/.test(name) && !/\b[A-Z]\.$/.test(name) && !/\bDR\.$|\bMR\.$|\bMRS\.$/.test(name)) return null;
  return normalizeName(name);
}

export function splitLines(text: string): string[] {
  return text.replace(/\r\n?/g, "\n").split("\n");
}

export function parseScreenplay(text: string): ParsedScript {
  const lines = splitLines(text);
  const warnings: string[] = [];
  const headingIdx: number[] = [];
  lines.forEach((l, i) => {
    if (parseHeading(l)) headingIdx.push(i);
  });

  const scenes: ParsedScene[] = [];
  const charStats = new Map<string, { hasDialogue: boolean; scenes: Set<number> }>();

  headingIdx.forEach((start, si) => {
    const end = (headingIdx[si + 1] ?? lines.length) - 1;
    const h = parseHeading(lines[start]!)!;
    const sceneChars = new Set<string>();
    const actionLines: string[] = [];
    const elements: AnalyzedElement[] = [];
    const seen = new Set<string>();

    let inDialogue = false;
    for (let i = start + 1; i <= end; i++) {
      const line = lines[i]!;
      const cue = isCue(line, lines[i - 1], lines[i + 1]);
      if (cue) {
        sceneChars.add(cue);
        const stat = charStats.get(cue) ?? { hasDialogue: true, scenes: new Set<number>() };
        stat.scenes.add(si);
        charStats.set(cue, stat);
        inDialogue = true;
        continue;
      }
      if (line.trim() === "") {
        inDialogue = false;
        continue;
      }
      if (inDialogue) continue; // dialogue/parentheticals are not scanned for elements
      actionLines.push(line.trim());
      for (const rule of KEYWORD_RULES) {
        const m = line.match(rule.re);
        if (!m) continue;
        const name = rule.name(m);
        const key = `${rule.category}:${name}`;
        if (seen.has(key)) continue;
        seen.add(key);
        elements.push({
          category: rule.category,
          name,
          quantity: null,
          notes: "Keyword match — verify",
          confidence: "low",
          source: { startLine: i + 1, endLine: i + 1, quote: line.trim().slice(0, 200) },
        });
      }
    }
    if (h.timeOfDay === "NIGHT" && h.intExt !== "INT") {
      elements.push({
        category: "equipment",
        name: "night exterior lighting",
        quantity: null,
        notes: "Derived from heading (EXT + NIGHT) — verify",
        confidence: "medium",
        source: { startLine: start + 1, endLine: start + 1, quote: h.heading },
      });
    }

    scenes.push({
      number: h.number ?? String(si + 1),
      heading: h.heading,
      intExt: h.intExt,
      location: h.location || "UNSPECIFIED",
      timeOfDay: h.timeOfDay,
      startLine: start + 1,
      endLine: end + 1,
      characters: [...sceneChars],
      elements,
      actionText: actionLines.join(" ").slice(0, 600),
    });
  });

  if (scenes.length === 0) {
    warnings.push(
      "No standard scene headings (INT./EXT. or داخلي/خارجي) were found. The text may be a treatment or idea rather than a screenplay.",
    );
  }
  if (/[؀-ۿ]/.test(text)) {
    warnings.push("Arabic text detected: dialogue cues cannot be detected by capitalisation, so character extraction may be incomplete.");
  }

  const characters = [...charStats.entries()]
    .map(([name, s]) => ({ name, hasDialogue: s.hasDialogue, sceneCount: s.scenes.size }))
    .sort((a, b) => b.sceneCount - a.sceneCount || a.name.localeCompare(b.name));

  return { scenes, characters, warnings, lineCount: lines.length };
}

export function confidenceForScene(s: ParsedScene): Confidence {
  return s.intExt !== "UNKNOWN" && s.timeOfDay !== "UNKNOWN" ? "high" : "medium";
}
