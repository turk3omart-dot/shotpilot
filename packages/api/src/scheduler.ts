/**
 * Deterministic scheduling rules. No AI, no invented travel times or weather.
 *
 * draftSchedule groups scenes into shoot days:
 *   - night scenes never share a day with day scenes
 *   - scenes at the same location are kept together
 *   - a day holds at most `pagesPerDay` pages and `maxLocationsPerDay` locations
 */
export interface SchedScene {
  id: string;
  number: string;
  locationKey: string;
  timeOfDay: string;
  intExt: string;
  lineCount: number;
  characters: string[];
}

export const LINES_PER_PAGE = 55;
export const isNight = (t: string) => t === "NIGHT" || t === "EVENING" || t === "DUSK";

export interface DraftOptions {
  pagesPerDay: number;
  maxLocationsPerDay: number;
}

export function draftSchedule(scenes: SchedScene[], opts: DraftOptions): string[][] {
  const blocks: SchedScene[][] = [scenes.filter((s) => !isNight(s.timeOfDay)), scenes.filter((s) => isNight(s.timeOfDay))];
  const days: string[][] = [];
  for (const block of blocks) {
    // Group by location, keeping first-appearance order.
    const byLoc = new Map<string, SchedScene[]>();
    for (const s of block) (byLoc.get(s.locationKey) ?? byLoc.set(s.locationKey, []).get(s.locationKey)!).push(s);
    let cur: string[] = [];
    let curLines = 0;
    let curLocs = new Set<string>();
    const flush = () => {
      if (cur.length) days.push(cur);
      cur = [];
      curLines = 0;
      curLocs = new Set();
    };
    for (const [loc, group] of byLoc) {
      for (const s of group) {
        const wouldLines = curLines + s.lineCount;
        const newLoc = !curLocs.has(loc);
        if (cur.length && (wouldLines / LINES_PER_PAGE > opts.pagesPerDay || (newLoc && curLocs.size >= opts.maxLocationsPerDay))) flush();
        cur.push(s.id);
        curLines += s.lineCount;
        curLocs.add(loc);
      }
    }
    flush();
  }
  return days;
}

export type Severity = "error" | "warning";
export interface ConflictInput {
  dayId: string;
  dayNumber: number;
  scenes: SchedScene[];
  maxLocationsPerDay: number;
  pagesPerDay: number;
}
export interface Conflict {
  dayId: string;
  severity: Severity;
  code: "day_night_mix" | "too_many_locations" | "overloaded_day" | "empty_day";
  message: string;
}

/** Validates one shooting day against the rules above. */
export function validateDay(d: ConflictInput): Conflict[] {
  const out: Conflict[] = [];
  const mk = (severity: Severity, code: Conflict["code"], message: string) => out.push({ dayId: d.dayId, severity, code, message });
  if (d.scenes.length === 0) {
    mk("warning", "empty_day", `Day ${d.dayNumber} has no scenes.`);
    return out;
  }
  const night = d.scenes.filter((s) => isNight(s.timeOfDay));
  if (night.length && night.length < d.scenes.length) {
    mk("error", "day_night_mix", `Day ${d.dayNumber} mixes day and night scenes (night: ${night.map((s) => s.number).join(", ")}).`);
  }
  const locs = new Set(d.scenes.map((s) => s.locationKey));
  if (locs.size > d.maxLocationsPerDay) mk("warning", "too_many_locations", `Day ${d.dayNumber} has ${locs.size} locations; the plan assumes at most ${d.maxLocationsPerDay}.`);
  const pages = d.scenes.reduce((n, s) => n + s.lineCount, 0) / LINES_PER_PAGE;
  if (pages > d.pagesPerDay * 1.25) mk("warning", "overloaded_day", `Day ${d.dayNumber} has ≈${pages.toFixed(1)} pages; the plan assumes ${d.pagesPerDay}/day.`);
  return out;
}

/** Next `count` shoot dates from `start` (YYYY-MM-DD), skipping the given weekdays (0=Sun … 6=Sat). */
export function shootDates(start: string, count: number, skipWeekdays: number[]): string[] {
  const out: string[] = [];
  const d = new Date(`${start}T00:00:00Z`);
  while (out.length < count) {
    if (!skipWeekdays.includes(d.getUTCDay())) out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
    if (out.length === 0 && d.getUTCFullYear() > 2100) throw new Error("Invalid start date");
  }
  return out;
}

/** Saudi Arabia and several neighbours have a Friday–Saturday weekend; most other markets use Saturday–Sunday. Production can override per day. */
export const weekendFor = (country: string): number[] => (["SA", "KW", "QA", "BH", "OM", "EG"].includes(country) ? [5, 6] : [6, 0]);
