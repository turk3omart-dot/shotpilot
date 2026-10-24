/**
 * Production estimation engine — deterministic rules over the breakdown and a rate card.
 *
 * No language model is involved here and no prices are invented: every amount is
 * quantity × units × a rate-card rate, and every line carries a human-readable basis.
 * Scenarios differ by explicit resource assumptions (crew composition, pages per day,
 * post-production effort), not by price multipliers.
 */

export type Scenario = "lean" | "standard" | "premium";

export interface EstimationScene {
  number: string;
  intExt: string;
  timeOfDay: string;
  locationKey: string | null;
  lineCount: number;
  characterNames: string[];
  elements: { category: string; quantity: number | null; confirmation: string }[];
}

export interface EstimationInput {
  scenes: EstimationScene[];
  charactersWithDialogue: string[];
  currency: string;
  country: string;
}

export type RateMap = Map<string, { rate: number; unit: string; label: string; category: string }>;

export interface EstimateLine {
  section: "development" | "pre_production" | "production" | "post_production" | "additional";
  category: string;
  label: string;
  rateKey: string | null;
  quantity: number;
  units: number;
  unit: string;
  rate: number;
  estimated: number;
  basis: string;
}

export interface Estimate {
  scenario: Scenario;
  shootDays: number;
  headcount: number;
  lines: EstimateLine[];
  subtotal: number;
  contingencyPct: number;
  contingency: number;
  taxPct: number;
  tax: number;
  total: number;
  assumptions: string[];
  missingRates: string[];
}

interface ScenarioRules {
  pagesPerDay: number;
  maxLocationsPerDay: number;
  crew: [key: string, qty: number][];
  editorDaysPerPage: number;
  minEditorDays: number;
  colorDays: number;
  soundDays: number;
  contingencyPct: number;
  prepDays: number;
  defaultExtrasPerScene: number;
}

const LINES_PER_PAGE = 55;

export const SCENARIO_RULES: Record<Scenario, ScenarioRules> = {
  lean: {
    pagesPerDay: 5,
    maxLocationsPerDay: 3,
    crew: [
      ["crew.director", 1],
      ["crew.producer", 1],
      ["crew.dop", 1],
      ["crew.gaffer", 1],
      ["crew.sound_mixer", 1],
      ["crew.runner", 1],
    ],
    editorDaysPerPage: 1,
    minEditorDays: 3,
    colorDays: 1,
    soundDays: 1,
    contingencyPct: 5,
    prepDays: 2,
    defaultExtrasPerScene: 5,
  },
  standard: {
    pagesPerDay: 4,
    maxLocationsPerDay: 2,
    crew: [
      ["crew.director", 1],
      ["crew.producer", 1],
      ["crew.production_manager", 1],
      ["crew.assistant_director", 1],
      ["crew.dop", 1],
      ["crew.camera_assistant", 1],
      ["crew.gaffer", 1],
      ["crew.electric", 1],
      ["crew.grip", 1],
      ["crew.sound_mixer", 1],
      ["crew.boom", 1],
      ["crew.art_director", 1],
      ["crew.wardrobe", 1],
      ["crew.makeup", 1],
      ["crew.runner", 2],
    ],
    editorDaysPerPage: 1.5,
    minEditorDays: 5,
    colorDays: 2,
    soundDays: 2,
    contingencyPct: 10,
    prepDays: 4,
    defaultExtrasPerScene: 10,
  },
  premium: {
    pagesPerDay: 3,
    maxLocationsPerDay: 2,
    crew: [
      ["crew.director", 1],
      ["crew.producer", 1],
      ["crew.production_manager", 1],
      ["crew.assistant_director", 1],
      ["crew.dop", 1],
      ["crew.camera_assistant", 2],
      ["crew.gaffer", 1],
      ["crew.electric", 2],
      ["crew.grip", 2],
      ["crew.sound_mixer", 1],
      ["crew.boom", 1],
      ["crew.art_director", 1],
      ["crew.props_master", 1],
      ["crew.wardrobe", 1],
      ["crew.makeup", 2],
      ["crew.runner", 3],
    ],
    editorDaysPerPage: 2.5,
    minEditorDays: 8,
    colorDays: 4,
    soundDays: 4,
    contingencyPct: 15,
    prepDays: 6,
    defaultExtrasPerScene: 20,
  },
};

const PRE_SECTION_CATEGORIES = new Set(["Casting", "Location scouting", "Permits"]);

/** Elements a person has rejected never drive cost. */
const active = (s: EstimationScene, category: string) => s.elements.filter((e) => e.category === category && e.confirmation !== "rejected");

export function estimateProduction(input: EstimationInput, scenario: Scenario, rates: RateMap, opts: { taxPct?: number } = {}): Estimate {
  const R = SCENARIO_RULES[scenario];
  const lines: EstimateLine[] = [];
  const missingRates = new Set<string>();
  const assumptions: string[] = [];

  const add = (section: EstimateLine["section"], rateKey: string, quantity: number, units: number, basis: string, label?: string) => {
    if (quantity <= 0 || units <= 0) return;
    const r = rates.get(rateKey);
    if (!r) {
      missingRates.add(rateKey);
      return;
    }
    const sec = PRE_SECTION_CATEGORIES.has(r.category) ? "pre_production" : section;
    lines.push({
      section: sec,
      category: r.category,
      label: label ?? r.label,
      rateKey,
      quantity,
      units,
      unit: r.unit,
      rate: r.rate,
      estimated: Math.round(quantity * units * r.rate * 100) / 100,
      basis,
    });
  };

  const scenes = input.scenes;
  const totalLines = scenes.reduce((n, s) => n + s.lineCount, 0);
  const pages = Math.max(1, Math.round((totalLines / LINES_PER_PAGE) * 8) / 8);
  const locationKeys = [...new Set(scenes.map((s) => s.locationKey ?? `scene-${s.number}`))];
  const nightExtScenes = scenes.filter((s) => s.timeOfDay === "NIGHT" && s.intExt !== "INT");
  const hasDay = scenes.some((s) => s.timeOfDay !== "NIGHT");

  const byPages = Math.ceil(pages / R.pagesPerDay);
  const byLocations = Math.ceil(locationKeys.length / R.maxLocationsPerDay);
  // A night block is a separate shooting day when the script also has day work.
  const nightDay = nightExtScenes.length > 0 && hasDay ? 1 : 0;
  const shootDays = Math.max(1, byPages, byLocations, 1 + nightDay);

  assumptions.push(
    `≈${pages} script pages (${LINES_PER_PAGE} lines/page) at ${R.pagesPerDay} pages/day; ${locationKeys.length} location(s), max ${R.maxLocationsPerDay}/day → ${shootDays} shoot day(s).`,
  );
  if (nightDay) assumptions.push("Night exterior work is scheduled as its own block because the script also has day scenes.");

  // Crew
  let headcount = 0;
  for (const [key, qty] of R.crew) {
    add("production", key, qty, shootDays, `${qty} × ${shootDays} shoot day(s) (${scenario} crew plan)`);
    headcount += qty;
  }

  // Cast: each speaking character is booked for the days their scenes need.
  for (const name of input.charactersWithDialogue) {
    const charScenes = scenes.filter((s) => s.characterNames.includes(name));
    if (!charScenes.length) continue;
    const charPages = charScenes.reduce((n, s) => n + s.lineCount, 0) / LINES_PER_PAGE;
    const days = Math.min(shootDays, Math.max(1, Math.ceil(charPages / R.pagesPerDay), Math.ceil(new Set(charScenes.map((s) => s.locationKey)).size / R.maxLocationsPerDay)));
    add("production", "cast.principal", 1, days, `${charScenes.length} scene(s) → ${days} day(s)`, `Principal cast — ${name}`);
    headcount += 1;
  }

  // Extras
  let extrasPersonDays = 0;
  const extrasScenes: string[] = [];
  for (const s of scenes) {
    const ex = active(s, "extras");
    if (!ex.length) continue;
    const n = ex.reduce((m, e) => m + (e.quantity ?? R.defaultExtrasPerScene), 0);
    extrasPersonDays += n;
    extrasScenes.push(s.number);
  }
  if (extrasPersonDays) {
    add("production", "cast.extra", extrasPersonDays, 1, `Scenes ${extrasScenes.join(", ")}; ${R.defaultExtrasPerScene} per scene when the script gives no number`);
    assumptions.push(`Extras default to ${R.defaultExtrasPerScene} per scene when the script does not specify a number.`);
  }

  // Equipment
  add("production", "equip.camera_package", 1, shootDays, `${shootDays} shoot day(s)`);
  add("production", "equip.lighting_package", 1, shootDays, `${shootDays} shoot day(s)`);
  add("production", "equip.sound_package", 1, shootDays, `${shootDays} shoot day(s)`);
  if (scenario !== "lean") add("production", "equip.grip_package", 1, shootDays, `${shootDays} shoot day(s)`);
  if (nightExtScenes.length) {
    const nightDays = Math.max(1, Math.ceil(new Set(nightExtScenes.map((s) => s.locationKey)).size / R.maxLocationsPerDay));
    add("production", "equip.lighting_night_extra", 1, nightDays, `Night exterior scene(s) ${nightExtScenes.map((s) => s.number).join(", ")}`);
  }

  const daysFor = (category: string) => {
    const hits = scenes.filter((s) => active(s, category).length > 0);
    return { hits, days: hits.length ? Math.min(shootDays, Math.max(1, Math.ceil(new Set(hits.map((s) => s.locationKey)).size / R.maxLocationsPerDay))) : 0 };
  };
  const sceneList = (h: EstimationScene[]) => `scene(s) ${h.map((s) => s.number).join(", ")}`;

  const drone = daysFor("drone");
  if (drone.days) {
    add("production", "crew.drone_pilot", 1, drone.days, `Aerial work in ${sceneList(drone.hits)}`);
    add("production", "equip.drone", 1, drone.days, `Aerial work in ${sceneList(drone.hits)}`);
    assumptions.push("Drone flights require a licensed operator and GACA authorisation in Saudi Arabia — confirm permit lead time.");
  }
  const animals = daysFor("animal");
  if (animals.days) add("production", "art.animal_handler", 1, animals.days, `Animals in ${sceneList(animals.hits)}`);
  const vehicles = daysFor("vehicle");
  if (vehicles.days) add("production", "art.vehicle", 1, vehicles.days, `Vehicles in ${sceneList(vehicles.hits)}`);
  const sfx = daysFor("sfx");
  if (sfx.days) add("production", "fx.sfx_day", 1, sfx.days, `Practical effects in ${sceneList(sfx.hits)}`);
  const safety = daysFor("safety");
  if (safety.days) add("production", "safety.officer", 1, safety.days, `Safety-flagged action in ${sceneList(safety.hits)}`);

  const propScenes = scenes.filter((s) => active(s, "prop").length > 0);
  if (propScenes.length) add("production", "art.props_allowance", propScenes.length, 1, `Props in ${sceneList(propScenes)}`);
  const castCount = input.charactersWithDialogue.length;
  if (castCount && scenario !== "lean") add("production", "art.wardrobe_allowance", castCount, 1, `${castCount} speaking character(s)`);

  // Locations
  const locationDays = Math.max(locationKeys.length, shootDays);
  add("production", "loc.fee", 1, locationDays, `${locationKeys.length} location(s) over ${shootDays} day(s)`);
  const extLocations = new Set(scenes.filter((s) => s.intExt !== "INT").map((s) => s.locationKey)).size;
  add("production", "loc.permit", extLocations, 1, `${extLocations} exterior location(s) needing a permit`);
  add("production", "loc.scout", 1, Math.min(locationKeys.length, R.prepDays), `Scouting ${locationKeys.length} location(s)`);

  // Logistics
  const vans = Math.max(1, Math.ceil(headcount / 8));
  add("production", "transport.van", vans, shootDays, `${headcount} people ÷ 8 per van`);
  add("production", "catering.person_day", headcount, shootDays, `${headcount} people × ${shootDays} day(s)`);
  add("production", "insurance.production", 1, 1, "Placeholder — replace with broker quote");

  // Pre-production & development
  if (castCount) add("pre_production", "pre.casting", 1, Math.max(1, Math.ceil(castCount / 4)), `${castCount} speaking role(s), ~4 per casting day`);
  if (scenario !== "lean") add("development", "dev.storyboard", 1, Math.max(1, Math.ceil(scenes.length / 6)), `${scenes.length} scene(s), ~6 per day`);

  // Post-production
  const editorDays = Math.max(R.minEditorDays, Math.ceil(pages * R.editorDaysPerPage));
  add("post_production", "post.editor", 1, editorDays, `≈${pages} page(s) × ${R.editorDaysPerPage} day(s)/page, min ${R.minEditorDays}`);
  add("post_production", "post.color", 1, R.colorDays, `${scenario} finishing plan`);
  add("post_production", "post.sound_design", 1, R.soundDays, `${scenario} finishing plan`);
  add("post_production", "post.music_license", 1, 1, "Library music; commissioned score not included");
  const vfx = scenes.filter((s) => active(s, "vfx").length > 0);
  if (vfx.length) add("post_production", "post.vfx_shot", vfx.length, 1, `VFX in ${sceneList(vfx)}`);
  if (input.country === "SA" || scenario !== "lean") add("post_production", "post.subtitles", 1, 1, "Arabic/English subtitles");

  const subtotal = round2(lines.reduce((n, l) => n + l.estimated, 0));
  const contingency = round2((subtotal * R.contingencyPct) / 100);
  const taxPct = opts.taxPct ?? (input.country === "SA" ? 15 : 0);
  const tax = round2(((subtotal + contingency) * taxPct) / 100);
  if (input.country === "SA") assumptions.push("VAT at 15% (Saudi Arabia) applied to subtotal + contingency — confirm treatment with your accountant.");
  if (missingRates.size) assumptions.push(`No rate on the rate card for: ${[...missingRates].join(", ")} — those lines are excluded.`);

  return {
    scenario,
    shootDays,
    headcount,
    lines,
    subtotal,
    contingencyPct: R.contingencyPct,
    contingency,
    taxPct,
    tax,
    total: round2(subtotal + contingency + tax),
    assumptions,
    missingRates: [...missingRates],
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
