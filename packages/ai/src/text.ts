import { splitLines } from "./screenplay-parser";

/** Prefix each line with its 1-based number so model citations map back to the source. */
export function numberLines(text: string): string {
  return splitLines(text)
    .map((l, i) => `${String(i + 1).padStart(5, " ")}| ${l}`)
    .join("\n");
}
