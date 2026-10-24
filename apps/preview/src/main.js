// ShotPilot browser preview. Everything runs in this page: no server, no accounts, data stays in this browser.
// It uses the real ShotPilot parser, estimation engine, scheduler and permission matrix from /packages.
import SAMPLE from "../../../tests/fixtures/the-last-light.fountain";
import { parseScreenplay } from "../../../packages/ai/src/screenplay-parser.ts";
import { estimateProduction, SCENARIO_RULES } from "../../../packages/api/src/estimation.ts";
import { draftSchedule, validateDay, shootDates, weekendFor } from "../../../packages/api/src/scheduler.ts";
import { SAMPLE_SA_RATE_CARD } from "../../../packages/database/src/rate-cards.ts";
import { PROJECT_SECTIONS, sectionAccess } from "../../../packages/shared/src/permissions.ts";

const KEY = "shotpilot-preview-v1";
const LINES_PER_PAGE = 55;
const RATES = new Map(SAMPLE_SA_RATE_CARD.items.map((i) => [i.key, i]));
const ROLES = [
  ["producer", "Producer"], ["director", "Director"], ["camera_operator", "Camera operator"],
  ["talent", "Cast member"], ["editor", "Editor"], ["client", "Client"],
];
const roleName = (r) => (ROLES.find((x) => x[0] === r) || [r, r.replace(/_/g, " ")])[1];
const TABS = [
  ["overview", "Overview", "overview"], ["script", "Script", "scripts"], ["breakdown", "Breakdown", "breakdown"],
  ["budget", "Budget", "budget"], ["schedule", "Schedule", "schedule"], ["sheets", "Call sheets", "schedule"], ["crew", "Crew", "crew"],
];
const SECTION_LABEL = { overview: "Overview", scripts: "Scripts", breakdown: "Breakdown", budget: "Budget", contracts: "Contracts", crew: "Crew", schedule: "Schedule", locations: "Locations", equipment: "Equipment", conversations: "Chat", files: "Files", reviews: "Reviews", deliverables: "Deliverables", analytics: "Analytics", settings: "Settings" };
const CAT = { prop: "Props", wardrobe: "Wardrobe", makeup: "Hair & makeup", vehicle: "Vehicles", animal: "Animals", extras: "Extras", sfx: "Special effects", vfx: "VFX", drone: "Drone / aerial", equipment: "Equipment", sound: "Sound", production_design: "Production design", safety: "Safety", other: "Other" };
const SECTIONS = [["development", "Development"], ["pre_production", "Pre-production"], ["production", "Production"], ["post_production", "Post-production"], ["additional", "Additional"]];

const uid = () => Math.random().toString(36).slice(2, 10);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const money = (n) => (n === null || n === undefined || n === "" ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "SAR", maximumFractionDigits: 0 }).format(n));
const fmtDate = (d) => new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const hash = (o) => { const s = JSON.stringify(o); let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return String(h); };
const todayPlus = (n) => { const d = new Date(); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

/* ------------------------------ state ------------------------------ */
function analyse(text, versionNo) {
  const p = parseScreenplay(text);
  const scenes = p.scenes.map((s) => ({
    id: uid(), number: s.number, heading: s.heading, intExt: s.intExt, timeOfDay: s.timeOfDay, location: s.location, locKey: s.location.toUpperCase(),
    start: s.startLine, end: s.endLine, characters: s.characters, synopsis: "", notes: "", confirmation: "unconfirmed",
    elements: s.elements.map((e) => ({ id: uid(), category: e.category, name: e.name, notes: e.notes || "", line: e.source ? e.source.startLine : null, origin: "parser", confidence: e.confidence, confirmation: "unconfirmed" })),
  }));
  return { id: uid(), versionNo, at: Date.now(), status: "draft", scenes, characters: p.characters, warnings: ["Analysed with the rule-based parser (no AI). Synopses and time estimates need an AI provider or manual entry.", ...p.warnings] };
}
function fresh() {
  const bd = analyse(SAMPLE, 1);
  return {
    role: "producer", tab: "overview", projectName: "The Last Light",
    versions: [{ v: 1, title: "The Last Light (sample script)", text: SAMPLE, at: Date.now() }], draft: SAMPLE,
    breakdowns: [bd], bdId: bd.id, budgets: [], budgetId: null, schedule: null, sheets: [], sheetId: null,
    crew: [
      { id: uid(), name: "Noura Al-Harbi", role: "producer", title: "" }, { id: uid(), name: "Faisal Camera", role: "camera_operator", title: "1st AC" },
      { id: uid(), name: "Layla Cast", role: "talent", title: "Noura (lead)" }, { id: uid(), name: "Client Reviewer", role: "client", title: "" },
    ],
    ui: { open: [], bdTab: "scenes", scenario: "standard", start: nextWorkday(), toast: "" },
  };
}
function nextWorkday() { return todayPlus(7); }
let S;
try { S = JSON.parse(localStorage.getItem(KEY) || "null"); } catch { S = null; }
if (!S || !S.versions) S = fresh();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* storage unavailable: preview still works */ } };

const access = (section) => sectionAccess({ workspaceRole: null, projectRole: S.role, overrides: null }, section);
const can = (section, level = "view") => ({ none: 0, view: 1, edit: 2 })[access(section)] >= ({ none: 0, view: 1, edit: 2 })[level];
const curBd = () => S.breakdowns.find((b) => b.id === S.bdId) || S.breakdowns[S.breakdowns.length - 1] || null;
const activeScenes = (bd) => (bd ? bd.scenes.filter((s) => s.confirmation !== "rejected") : []);
const lineCount = (s) => s.end - s.start + 1;
const toast = (m) => { S.ui.toast = m; render(); setTimeout(() => { if (S.ui.toast === m) { S.ui.toast = ""; render(); } }, 2600); };

/* ------------------------------ domain helpers ------------------------------ */
function estimationInput(bd) {
  return {
    country: "SA", currency: "SAR",
    charactersWithDialogue: bd.characters.filter((c) => c.hasDialogue).map((c) => c.name),
    scenes: activeScenes(bd).map((s) => ({ number: s.number, intExt: s.intExt, timeOfDay: s.timeOfDay, locationKey: s.locKey, lineCount: lineCount(s), characterNames: s.characters, elements: s.elements.map((e) => ({ category: e.category, quantity: null, confirmation: e.confirmation })) })),
  };
}
const sceneRows = (bd) => activeScenes(bd).map((s) => ({ id: s.id, number: s.number, locationKey: s.locKey, timeOfDay: s.timeOfDay, intExt: s.intExt, lineCount: lineCount(s), characters: s.characters }));
const lineEst = (l) => Math.round(l.quantity * l.units * l.rate * 100) / 100;
function budgetTotals(b) {
  const sum = (f) => b.lines.reduce((n, l) => n + (f(l) || 0), 0);
  const estimated = sum(lineEst), contingency = estimated * b.contingencyPct / 100, tax = (estimated + contingency) * b.taxPct / 100;
  return { estimated, contingency, tax, total: estimated + contingency + tax, committed: sum((l) => l.committed), actual: sum((l) => l.actual), quoted: sum((l) => l.quoted) };
}
function dayView(day) {
  const bd = S.breakdowns.find((b) => b.id === day.bdId) || curBd();
  const rows = bd ? sceneRows(bd) : [];
  const scenes = day.sceneIds.map((id) => (bd ? bd.scenes.find((s) => s.id === id) : null)).filter(Boolean);
  const conflicts = validateDay({ dayId: day.id, dayNumber: day.n, maxLocationsPerDay: 2, pagesPerDay: 4, scenes: day.sceneIds.map((id) => rows.find((r) => r.id === id)).filter(Boolean) });
  return { scenes, conflicts };
}
function sheetContent(day) {
  const { scenes } = dayView(day);
  return {
    production: S.projectName, dayNumber: day.n, date: day.date, generalCall: day.call, wrapTarget: day.wrap,
    scenes: scenes.map((s) => ({ number: s.number, heading: s.heading, intExt: s.intExt, timeOfDay: s.timeOfDay, location: s.location, cast: s.characters })),
    locations: [...new Set(scenes.map((s) => s.location))], cast: [...new Set(scenes.flatMap((s) => s.characters))].sort(),
    crew: S.crew.filter((m) => m.role !== "client").map((m) => ({ name: m.name, role: m.role, title: m.title, call: day.call })),
  };
}
const latestSheet = (dayId) => S.sheets.filter((x) => x.dayId === dayId).sort((a, b) => b.rev - a.rev)[0] || null;

/* ------------------------------ actions ------------------------------ */
const A = {
  role: (el) => { S.role = el.value; if (!TABS.some((t) => t[0] === S.tab && can(t[2]))) S.tab = "overview"; },
  tab: (el) => { S.tab = el.dataset.v; if (el.dataset.id) S.sheetId = el.dataset.id; },
  reset: () => { S = fresh(); toast("Sample project restored."); },
  clearAll: () => { S = { ...fresh(), versions: [], draft: "", breakdowns: [], bdId: null }; S.tab = "script"; },
  projectName: (el) => { S.projectName = el.value.trim() || "Untitled production"; },
  draft: (el) => { S.draft = el.value; },
  saveVersion: (el) => {
    const andAnalyse = el.dataset.v === "1";
    const text = S.draft.trim();
    if (!text) return toast("Paste or upload a script first.");
    const v = (S.versions[S.versions.length - 1]?.v || 0) + 1;
    S.versions.push({ v, title: S.versions[0]?.title || "Script", text, at: Date.now() });
    toast(`Saved as version ${v}. Earlier versions are kept unchanged.`);
    if (andAnalyse) A.analyse(null, String(v));
  },
  analyse: (_, v) => {
    const ver = S.versions.find((x) => String(x.v) === String(v));
    if (!ver) return;
    // Older drafts are superseded; confirmed breakdowns are never touched.
    S.breakdowns.forEach((b) => { if (b.status === "draft") b.status = "superseded"; });
    const bd = analyse(ver.text, ver.v);
    S.breakdowns.push(bd); S.bdId = bd.id; S.tab = "breakdown"; S.ui.open = [];
    toast(`Analysed version ${ver.v}: ${bd.scenes.length} scene${bd.scenes.length === 1 ? "" : "s"} found.`);
  },
  pickBd: (el) => { S.bdId = el.value; S.ui.open = []; },
  bdTab: (el) => { S.ui.bdTab = el.dataset.v; },
  confirmBd: () => {
    S.breakdowns.forEach((b) => { if (b.status === "confirmed") b.status = "superseded"; });
    const b = curBd(); b.status = "confirmed"; b.confirmedAt = Date.now();
    b.scenes.forEach((s) => { if (s.confirmation === "unconfirmed") s.confirmation = "confirmed"; });
    toast("Breakdown confirmed. It is now the reference for budgets and scheduling.");
  },
  sceneField: (el, id) => { const s = curBd().scenes.find((x) => x.id === id); s[el.dataset.f] = el.value; s.confirmation = "confirmed"; },
  sceneSet: (_, id, v) => { curBd().scenes.find((x) => x.id === id).confirmation = v; },
  elSet: (_, id, v) => { for (const s of curBd().scenes) { const e = s.elements.find((x) => x.id === id); if (e) e.confirmation = v; } },
  elDel: (_, id) => { for (const s of curBd().scenes) s.elements = s.elements.filter((x) => x.id !== id); },
  elAdd: (el, id) => {
    const f = el.closest("[data-form]"); const name = f.querySelector("[data-n]").value.trim();
    if (!name) return;
    curBd().scenes.find((x) => x.id === id).elements.push({ id: uid(), category: f.querySelector("[data-cat]").value, name, notes: "", line: null, origin: "user", confidence: null, confirmation: "confirmed" });
  },
  scenario: (el) => { S.ui.scenario = el.dataset.v; },
  makeBudget: () => {
    const bd = curBd();
    const est = estimateProduction(estimationInput(bd), S.ui.scenario, RATES);
    const b = {
      id: uid(), name: `${S.ui.scenario[0].toUpperCase()}${S.ui.scenario.slice(1)} estimate`, scenario: S.ui.scenario, at: Date.now(),
      contingencyPct: est.contingencyPct, taxPct: est.taxPct, assumptions: ["Built from SAMPLE rates. These are placeholders, not market quotations. Replace them with your own rate card before sharing.", ...(bd.status !== "confirmed" ? ["The breakdown behind this estimate has not been confirmed yet."] : []), ...est.assumptions],
      lines: est.lines.map((l) => ({ id: uid(), section: l.section, category: l.category, label: l.label, quantity: l.quantity, units: l.units, unit: l.unit, rate: l.rate, basis: l.basis, quoted: null, committed: null, actual: null })),
    };
    S.budgets.push(b); S.budgetId = b.id; toast("Budget created. Existing budgets were not changed.");
  },
  pickBudget: (el) => { S.budgetId = el.value; },
  lineField: (el, id) => {
    const b = S.budgets.find((x) => x.id === S.budgetId); const l = b.lines.find((x) => x.id === id);
    const raw = el.value; const n = raw === "" ? null : Math.max(0, Number(raw));
    l[el.dataset.f] = ["quantity", "units", "rate"].includes(el.dataset.f) ? (n ?? 0) : n;
  },
  start: (el) => { S.ui.start = el.value; },
  draftSchedule: () => {
    if (S.sheets.length) return toast("Call sheets already exist, so the schedule can't be regenerated. Move scenes between days instead.");
    const bd = curBd(); const rows = sceneRows(bd);
    if (!rows.length) return toast("This breakdown has no scenes to schedule.");
    const r = SCENARIO_RULES.standard;
    const plan = draftSchedule(rows, { pagesPerDay: r.pagesPerDay, maxLocationsPerDay: r.maxLocationsPerDay });
    const dates = shootDates(S.ui.start, plan.length, weekendFor("SA"));
    S.schedule = { days: plan.map((ids, i) => ({ id: uid(), n: i + 1, date: dates[i], call: "07:00", wrap: "17:00", sceneIds: ids, bdId: bd.id })) };
    toast(`Drafted ${plan.length} shoot day${plan.length === 1 ? "" : "s"}. Fridays and Saturdays are skipped.`);
  },
  moveScene: (el, sceneId) => {
    const to = S.schedule.days.find((d) => d.id === el.value); if (!to) return;
    S.schedule.days.forEach((d) => { d.sceneIds = d.sceneIds.filter((x) => x !== sceneId); });
    to.sceneIds.push(sceneId);
  },
  dayField: (el, id) => { S.schedule.days.find((d) => d.id === id)[el.dataset.f] = el.value; },
  makeSheet: (_, id) => {
    const day = S.schedule.days.find((d) => d.id === id); const { scenes, conflicts } = dayView(day);
    if (!scenes.length) return toast("Add at least one scene to this day first.");
    const errs = conflicts.filter((c) => c.severity === "error");
    if (errs.length) return toast("Fix scheduling errors first: " + errs.map((e) => e.message).join(" "));
    const content = sheetContent(day); const h = hash(content); const last = latestSheet(id);
    if (last && last.hash === h) { S.sheetId = last.id; S.tab = "sheets"; return toast("Nothing changed since the last revision."); }
    const sheet = { id: uid(), dayId: id, rev: (last?.rev || 0) + 1, at: Date.now(), content, hash: h, acks: [] };
    S.sheets.push(sheet); S.sheetId = sheet.id; S.tab = "sheets"; toast(`Call sheet revision ${sheet.rev} generated.`);
  },
  pickSheet: (el) => { S.sheetId = el.value; },
  ack: (_, id) => { const sh = S.sheets.find((x) => x.id === id); const who = roleName(S.role); if (!sh.acks.includes(who)) sh.acks.push(who); toast("Acknowledged. The production office can see it."); },
  addPerson: (el) => {
    const f = el.closest("[data-form]"); const name = f.querySelector("[data-n]").value.trim(); if (!name) return;
    S.crew.push({ id: uid(), name, role: f.querySelector("[data-r]").value, title: f.querySelector("[data-t]").value.trim() });
  },
  rmPerson: (_, id) => { S.crew = S.crew.filter((m) => m.id !== id); },
  file: async (el) => {
    const f = el.files[0]; if (!f) return;
    if (!/\.(txt|fountain|text|spmd)$/i.test(f.name)) return toast("This preview reads .txt and .fountain files. PDF and Word upload is in the full app.");
    S.draft = await f.text(); toast(`Loaded ${f.name}. Press “Save as new version”.`);
  },
  theme: () => { const r = document.documentElement; const dark = r.dataset.theme ? r.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches; r.dataset.theme = dark ? "light" : "dark"; },
};

/* ------------------------------ views ------------------------------ */
const badge = (t, c = "") => `<span class="badge ${c}">${esc(t)}</span>`;
const todChip = (t) => `<span class="tod ${t === "NIGHT" || t === "EVENING" || t === "DUSK" ? "night" : t === "UNKNOWN" ? "unk" : "day"}">${esc(t)}</span>`;
const confBadge = (c) => (c === "confirmed" ? badge("Confirmed", "ok") : c === "rejected" ? badge("Rejected", "bad") : badge("Needs review", "warn"));
const originBadge = (o, conf) => (o === "user" ? badge("Added by team") : badge(`Found in script${conf ? " · " + conf : ""}`, "info"));
const btn = (label, act, attrs = "", cls = "") => `<button class="btn ${cls}" data-a="${act}" ${attrs}>${label}</button>`;
const stat = (k, v, h = "") => `<div class="card pad stat"><div class="k">${k}</div><div class="v">${v}</div>${h ? `<div class="h">${h}</div>` : ""}</div>`;
const empty = (t, b, a = "") => `<div class="empty"><h2>${esc(t)}</h2><p>${b}</p>${a ? `<div style="margin-top:14px">${a}</div>` : ""}</div>`;
const head = (t, sub, actions = "") => `<div class="head"><div><h1>${t}</h1>${sub ? `<p class="sub">${sub}</p>` : ""}</div><div class="row">${actions}</div></div>`;
const ro = () => `<div class="alert">Your role can view this page but not change it.</div>`;

function vOverview() {
  const bd = curBd(); const b = S.budgets[S.budgets.length - 1];
  const steps = [
    [S.versions.length > 0, "Add a script or treatment", "script", can("scripts")],
    [!!bd, "Analyse it into a breakdown", "script", can("breakdown")],
    [bd?.status === "confirmed", "Review and confirm the breakdown", "breakdown", can("breakdown")],
    [S.budgets.length > 0, "Generate a first budget estimate", "budget", can("budget")],
    [!!S.schedule, "Draft the shooting schedule", "schedule", can("schedule")],
    [S.sheets.length > 0, "Generate the first call sheet", "schedule", can("schedule")],
  ].filter((s) => s[3]);
  const next = steps.find((s) => !s[0]);
  return `${head(esc(S.projectName), "A short film project. Everything here is a working copy that lives in this browser.")}
  ${next ? `<div class="card pad row" style="gap:14px"><div style="flex:1;min-width:200px"><div class="faint" style="font-size:12px">Next step</div><h2 style="font-size:17px">${next[1]}</h2></div>${btn("Continue", "tab", `data-v="${next[2]}"`, "primary")}</div>` : ""}
  <div class="grid g3">
    ${can("scripts") ? stat("Script versions", S.versions.length, S.versions.length ? "Originals are never edited" : "None yet") : ""}
    ${can("breakdown") ? stat("Scenes", bd ? activeScenes(bd).length : "—", bd ? `${bd.scenes.filter((s) => s.confirmation === "confirmed").length} confirmed · ${bd.status}` : "No breakdown yet") : ""}
    ${can("budget") ? stat("Estimated total", b ? money(budgetTotals(b).total) : "—", b ? b.name : "No budget yet") : ""}
    ${can("schedule") ? stat("Shoot days", S.schedule ? S.schedule.days.length : "—", S.sheets.length ? `${S.sheets.length} call sheet revision${S.sheets.length === 1 ? "" : "s"}` : "") : ""}
    ${can("crew") ? stat("People", S.crew.length) : ""}
  </div>
  <div class="card"><div class="ch"><h2>Production setup</h2></div><div class="pad" style="display:flex;flex-direction:column;gap:9px">
    ${steps.map((s) => `<div class="row"><span class="badge ${s[0] ? "ok" : ""}" style="width:22px;height:22px;justify-content:center;padding:0">${s[0] ? "✓" : ""}</span><button class="btn ghost sm" data-a="tab" data-v="${s[2]}" style="${s[0] ? "text-decoration:line-through;color:var(--ink-3)" : ""}">${s[1]}</button></div>`).join("")}
  </div></div>
  ${can("overview", "edit") ? `<div class="card pad"><label class="f">Project name<input type="text" id="pname" data-c="projectName" value="${esc(S.projectName)}"></label></div>` : ""}`;
}

function vScript() {
  const edit = can("scripts", "edit");
  return `${head("Script", "Paste a script or load a .txt / .fountain file. Every save is a new version; earlier versions never change.")}
  ${edit ? `<div class="card pad" style="display:flex;flex-direction:column;gap:12px">
    <label class="f">Script, treatment or idea<textarea id="draft" data-i="draft" rows="14" class="mono" spellcheck="false">${esc(S.draft)}</textarea></label>
    <div class="row">${btn("Save as new version", "saveVersion", "", "")}${btn("Save and analyse", "saveVersion", 'data-v="1"', "primary")}<label class="btn" style="cursor:pointer">Load .txt / .fountain file<input type="file" id="file" data-c="file" accept=".txt,.fountain,.text,.spmd" hidden></label></div>
  </div>` : ro()}
  <div class="card"><div class="ch"><h2>Versions</h2>${badge(S.versions.length + " saved")}</div>
    ${S.versions.length ? S.versions.slice().reverse().map((v, i) => `<div class="person"><div style="flex:1;min-width:160px"><b>Version ${v.v}</b> ${i === 0 ? badge("Latest", "accent") : ""} ${S.breakdowns.some((b) => b.versionNo === v.v) ? badge("Analysed", "ok") : ""}<div class="faint" style="font-size:12px">${v.text.split("\n").length} lines · ${new Date(v.at).toLocaleString()}</div></div>${can("breakdown", "edit") ? btn(S.breakdowns.some((b) => b.versionNo === v.v) ? "Analyse again" : "Analyse", "analyse", `data-v="${v.v}"`, "sm") : ""}</div>`).join("") : `<div class="pad faint">No versions yet.</div>`}
  </div>
  <div class="banner"><b>Rule-based analysis (no AI).</b> This preview uses ShotPilot's screenplay parser: scene headings, interior/exterior, day/night, dialogue characters and keyword-matched elements. The full app can also use Claude, only after the workspace owner allows it.</div>`;
}

function sceneCard(s, edit) {
  const open = S.ui.open.includes(s.id);
  const groups = {}; s.elements.forEach((e) => (groups[e.category] ||= []).push(e));
  const excerpt = (SAMPLE_LINES(curBd())).slice(s.start - 1, Math.min(s.end, s.start + 28)).join("\n");
  return `<details class="scene ${s.confirmation === "rejected" ? "rej" : ""}" data-scene="${s.id}" ${open ? "open" : ""}>
    <summary><span class="chip-num">${esc(s.number)}</span><span style="flex:1;min-width:0"><b style="display:block;overflow-wrap:anywhere">${esc(s.heading)}</b>
      <span class="row" style="gap:6px;margin-top:2px"><span class="badge">${esc(s.intExt)}</span>${todChip(s.timeOfDay)}<span class="faint" style="font-size:12px">${s.characters.length} cast · ${s.elements.filter((e) => e.confirmation !== "rejected").length} elements</span></span></span>${confBadge(s.confirmation)}</summary>
    <div class="body">
      <div class="row">${s.synopsis || s.notes ? originBadge("user") : originBadge("parser", "high")} ${confBadge(s.confirmation)} <span class="faint" style="font-size:12px">Script lines ${s.start}–${s.end} · ${esc(s.location)}</span></div>
      <div class="grid g2">
        <label class="f">Synopsis<textarea rows="2" data-c="sceneField" data-f="synopsis" data-id="${s.id}" ${edit ? "" : "disabled"} placeholder="Not written yet">${esc(s.synopsis)}</textarea></label>
        <label class="f">Production notes<textarea rows="2" data-c="sceneField" data-f="notes" data-id="${s.id}" ${edit ? "" : "disabled"} placeholder="Notes for the team">${esc(s.notes)}</textarea></label>
      </div>
      ${s.characters.length ? `<div class="row"><span class="faint" style="font-size:12px">Cast</span>${s.characters.map((c) => badge(c)).join("")}</div>` : ""}
      <div><h3 style="margin-bottom:6px">Production elements</h3>
        ${Object.keys(groups).length ? `<div class="card" style="overflow:hidden">${Object.entries(groups).map(([c, els]) => `<div class="faint" style="font-size:11.5px;padding:6px 10px 0">${CAT[c] || c}</div>${els.map((e) => `<div class="el ${e.confirmation === "rejected" ? "rej" : ""}"><span class="nm">${esc(e.name)}<span class="ns">${esc(e.notes)}${e.line ? ` · line ${e.line}` : ""}</span></span>${originBadge(e.origin, e.confidence)}${edit ? `<span class="row" style="gap:2px">${e.confirmation !== "confirmed" ? btn("Confirm", "elSet", `data-id="${e.id}" data-v="confirmed" aria-label="Confirm ${esc(e.name)}"`, "sm ghost") : ""}${e.confirmation !== "rejected" ? btn("Reject", "elSet", `data-id="${e.id}" data-v="rejected" aria-label="Reject ${esc(e.name)}"`, "sm ghost") : ""}${e.confirmation !== "unconfirmed" ? btn("Undo", "elSet", `data-id="${e.id}" data-v="unconfirmed"`, "sm ghost") : ""}${e.origin === "user" ? btn("Delete", "elDel", `data-id="${e.id}"`, "sm ghost") : ""}</span>` : confBadge(e.confirmation)}</div>`).join("")}`).join("")}</div>` : `<p class="faint">None identified yet.</p>`}
        ${edit ? `<div class="row" data-form style="margin-top:8px"><select data-c-sel data-cat style="width:auto" aria-label="Category">${Object.entries(CAT).map(([k, v]) => `<option value="${k}" ${k === "prop" ? "selected" : ""}>${v}</option>`).join("")}</select><input type="text" data-n placeholder="Add an element, e.g. vintage camera" aria-label="Element name" style="flex:1;min-width:160px">${btn("Add", "elAdd", `data-id="${s.id}"`, "sm")}</div>` : ""}
      </div>
      <details><summary class="faint" style="cursor:pointer;font-size:12.5px">Original script excerpt</summary><pre class="mono muted" style="white-space:pre-wrap;margin:8px 0 0;overflow-wrap:anywhere">${esc(excerpt)}</pre></details>
      ${edit ? `<div class="row">${s.confirmation !== "confirmed" ? btn("Confirm scene", "sceneSet", `data-id="${s.id}" data-v="confirmed"`, "sm") : ""}${s.confirmation !== "rejected" ? btn("Not a scene / exclude", "sceneSet", `data-id="${s.id}" data-v="rejected"`, "sm ghost") : btn("Include again", "sceneSet", `data-id="${s.id}" data-v="unconfirmed"`, "sm")}</div>` : ""}
    </div></details>`;
}
const SAMPLE_LINES = (bd) => { const v = S.versions.find((x) => x.v === bd.versionNo); return (v ? v.text : "").replace(/\r\n?/g, "\n").split("\n"); };

function vBreakdown() {
  const bd = curBd();
  if (!bd) return head("Breakdown", "") + empty("No breakdown yet", "Add a script and press Analyse. Scenes, cast, locations and production elements will appear here for review.", btn("Go to script", "tab", 'data-v="script"', "primary"));
  const edit = can("breakdown", "edit") && bd.status !== "superseded";
  const act = activeScenes(bd); const unconf = bd.scenes.filter((s) => s.confirmation === "unconfirmed").length;
  const locs = {}; act.forEach((s) => (locs[s.location] ||= []).push(s.number));
  const castScenes = {}; act.forEach((s) => s.characters.forEach((c) => (castScenes[c] ||= []).push(s.number)));
  const tab = S.ui.bdTab;
  return `${head("Breakdown", `Script v${bd.versionNo} · analysed ${new Date(bd.at).toLocaleString()} · ${badge("Rule-based parser (no AI)", "info")}`,
    bd.status === "confirmed" ? badge("Confirmed", "ok") : edit ? btn(`Confirm breakdown${unconf ? ` (${unconf} unreviewed)` : ""}`, "confirmBd", "", "primary") : badge(bd.status, "warn"))}
  ${S.breakdowns.length > 1 ? `<label class="f" style="max-width:340px">Breakdown history<select data-c="pickBd">${S.breakdowns.slice().reverse().map((b) => `<option value="${b.id}" ${b.id === bd.id ? "selected" : ""}>v${b.versionNo} · ${new Date(b.at).toLocaleTimeString()} · ${b.status}</option>`).join("")}</select></label>` : ""}
  ${bd.status === "superseded" ? `<div class="alert warn"><b>Older breakdown.</b> A newer analysis exists. This one is read-only and kept for traceability.</div>` : ""}
  <div class="alert warn"><b>Things to check</b><ul>${bd.warnings.map((w) => `<li>${esc(w)}</li>`).join("")}</ul></div>
  <div class="grid g3">${stat("Scenes", act.length)}${stat("Interior / exterior", `${act.filter((s) => s.intExt === "INT").length} / ${act.filter((s) => s.intExt !== "INT").length}`)}${stat("Day / night", `${act.filter((s) => !["NIGHT", "EVENING", "DUSK"].includes(s.timeOfDay)).length} / ${act.filter((s) => ["NIGHT", "EVENING", "DUSK"].includes(s.timeOfDay)).length}`)}${stat("Speaking cast", bd.characters.filter((c) => c.hasDialogue).length)}${stat("Locations", Object.keys(locs).length)}</div>
  <div class="tabs" role="tablist">${[["scenes", `Scenes (${act.length})`], ["cast", `Cast (${Object.keys(castScenes).length})`], ["locations", `Locations (${Object.keys(locs).length})`]].map(([k, l]) => `<button role="tab" aria-selected="${tab === k}" data-a="bdTab" data-v="${k}">${l}</button>`).join("")}</div>
  ${tab === "scenes" ? `<div style="display:flex;flex-direction:column;gap:8px">${bd.scenes.map((s) => sceneCard(s, edit)).join("") || empty("No scenes found", "No standard scene headings (INT./EXT.) were found. The text may be a treatment rather than a screenplay.")}</div>`
  : tab === "cast" ? `<div class="card">${Object.entries(castScenes).sort((a, b) => b[1].length - a[1].length).map(([n, sc]) => `<div class="person"><span class="av">${esc(n.slice(0, 2))}</span><b style="flex:1;min-width:120px">${esc(n)}</b>${badge(bd.characters.find((c) => c.name === n)?.hasDialogue ? "Speaking" : "Non-speaking")}<span class="faint" style="font-size:12px">Scenes ${sc.join(", ")}</span></div>`).join("") || `<div class="pad faint">No characters identified.</div>`}</div>`
  : `<div class="card">${Object.entries(locs).map(([n, sc]) => `<div class="person"><b style="flex:1;min-width:140px">${esc(n)}</b>${sc.length > 1 ? badge(`Group ${sc.length} scenes`, "accent") : ""}<span class="faint" style="font-size:12px">Scenes ${sc.join(", ")}</span></div>`).join("")}</div>`}
  ${can("budget", "edit") && act.length ? `<div class="card pad row"><div style="flex:1;min-width:200px"><h2>Next: estimate the budget</h2><p class="muted">Builds Lean, Standard or Premium line items from this breakdown.</p></div>${btn("Generate estimate", "tab", 'data-v="budget"', "primary")}</div>` : ""}`;
}

function vBudget() {
  const bd = curBd(); const edit = can("budget", "edit");
  if (!bd) return head("Budget", "") + empty("Analyse a script first", "Budgets are generated from a breakdown so every line traces back to the plan.", btn("Go to script", "tab", 'data-v="script"', "primary"));
  const scen = ["lean", "standard", "premium"].map((k) => { const e = estimateProduction(estimationInput(bd), k, RATES); return { k, e }; });
  const b = S.budgets.find((x) => x.id === S.budgetId) || S.budgets[S.budgets.length - 1];
  let detail = "";
  if (b) {
    const t = budgetTotals(b);
    detail = `<div class="head"><div><h2 style="font-size:17px">${esc(b.name)}</h2><p class="faint" style="font-size:12px">Created ${new Date(b.at).toLocaleString()} · SAR</p></div>${S.budgets.length > 1 ? `<label class="f"><select data-c="pickBudget" aria-label="Choose budget">${S.budgets.map((x) => `<option value="${x.id}" ${x.id === b.id ? "selected" : ""}>${esc(x.name)} · ${new Date(x.at).toLocaleTimeString()}</option>`).join("")}</select></label>` : ""}</div>
    <div class="alert warn"><b>Assumptions</b><ul>${b.assumptions.map((a) => `<li>${esc(a)}</li>`).join("")}</ul></div>
    <div class="grid g3">${stat("Estimated", money(t.estimated))}${stat(`Contingency ${b.contingencyPct}%`, money(t.contingency))}${stat(`Tax ${b.taxPct}%`, money(t.tax))}${stat("Total", money(t.total))}${stat("Committed / actual", money(t.committed), money(t.actual) + " actual")}</div>
    ${SECTIONS.map(([k, label]) => { const ls = b.lines.filter((l) => l.section === k); if (!ls.length) return ""; const inp = (l, f, w = 78) => edit ? `<input type="number" min="0" step="any" data-c="lineField" data-f="${f}" data-id="${l.id}" value="${l[f] ?? ""}" style="width:${w}px;text-align:right;min-height:30px;padding:4px 6px" aria-label="${f} for ${esc(l.label)}">` : (l[f] ?? "—");
      return `<div class="card" style="overflow:hidden"><div class="ch"><h2>${label}</h2><b class="num">${money(ls.reduce((n, l) => n + lineEst(l), 0))}</b></div><div class="tbl-wrap"><table><thead><tr><th>Item</th><th>Qty</th><th>× ${"units"}</th><th>Rate</th><th>Estimated</th><th>Quoted</th><th>Committed</th><th>Actual</th></tr></thead><tbody>${ls.map((l) => `<tr><td><b>${esc(l.label)}</b><span class="basis">${esc(l.basis)}</span></td><td>${inp(l, "quantity", 60)}</td><td>${inp(l, "units", 60)} <span class="faint" style="font-size:11px">${esc(l.unit)}</span></td><td>${inp(l, "rate", 84)}</td><td><b>${money(lineEst(l))}</b></td><td>${inp(l, "quoted", 92)}</td><td>${inp(l, "committed", 92)}</td><td>${inp(l, "actual", 92)}</td></tr>`).join("")}</tbody></table></div></div>`; }).join("")}`;
  }
  return `${head("Budget", "Estimates come from explicit rules and a rate card, never from AI. Each line shows how it was calculated.")}
  ${edit ? `<div class="card pad" style="display:flex;flex-direction:column;gap:12px"><h2>New estimate</h2><div class="alert warn"><b>Sample rate card.</b> “${esc(SAMPLE_SA_RATE_CARD.name)}”. These figures are placeholders for planning, not market quotations.</div>
    <div class="grid g3" role="radiogroup" aria-label="Scenario">${scen.map(({ k, e }) => `<button class="scen ${S.ui.scenario === k ? "on" : ""}" data-a="scenario" data-v="${k}" role="radio" aria-checked="${S.ui.scenario === k}"><b>${k[0].toUpperCase() + k.slice(1)}</b><div class="t">${money(e.total)}</div><div class="faint" style="font-size:12px">${e.shootDays} shoot day${e.shootDays === 1 ? "" : "s"} · ${e.headcount} people on set</div></button>`).join("")}</div>
    <div>${btn(`Create ${S.ui.scenario} budget`, "makeBudget", "", "primary")}</div></div>` : ro()}
  ${detail}`;
}

function vSchedule() {
  const bd = curBd(); const edit = can("schedule", "edit");
  const sched = S.schedule;
  const intro = head("Schedule", "Day and night scenes never share a shoot day, scenes at one location stay together, and Friday and Saturday are skipped (Saudi weekend).",
    edit && bd ? `<label class="f" style="flex-direction:row;align-items:center;gap:8px">Start<input type="date" id="start" data-c="start" value="${S.ui.start}" style="width:auto"></label>${btn(sched ? "Redraft schedule" : "Draft schedule", "draftSchedule", "", "primary")}` : "");
  if (!bd) return intro + empty("Nothing to schedule yet", "Analyse a script first.", btn("Go to script", "tab", 'data-v="script"', "primary"));
  if (!sched) return intro + empty("No schedule yet", "Press “Draft schedule” to group the scenes from your breakdown into shoot days.");
  const rows = sceneRows(bd); const scheduled = new Set(sched.days.flatMap((d) => d.sceneIds));
  const unsched = rows.filter((r) => !scheduled.has(r.id));
  return `${intro}${unsched.length ? `<div class="alert warn"><b>Not scheduled:</b> scenes ${unsched.map((u) => u.number).join(", ")}</div>` : ""}
  ${sched.days.map((d) => {
    const { scenes, conflicts } = dayView(d); const sh = latestSheet(d.id); const outdated = sh && sh.hash !== hash(sheetContent(d));
    return `<div class="card day"><div class="ch"><h2>Day ${d.n} · ${fmtDate(d.date)}</h2>${sh ? (outdated ? badge(`Call sheet r${sh.rev} outdated`, "warn") : badge(`Call sheet r${sh.rev} current`, "ok")) : badge("No call sheet")}</div>
      <div class="pad row">${edit ? `<label class="f" style="flex-direction:row;align-items:center;gap:6px">General call<input type="time" data-c="dayField" data-f="call" data-id="${d.id}" value="${d.call}" style="width:auto"></label><label class="f" style="flex-direction:row;align-items:center;gap:6px">Wrap<input type="time" data-c="dayField" data-f="wrap" data-id="${d.id}" value="${d.wrap}" style="width:auto"></label>` : `<span>General call <b>${d.call}</b> · wrap <b>${d.wrap}</b></span>`}</div>
      ${conflicts.map((c) => `<div class="alert ${c.severity === "error" ? "bad" : "warn"}" style="margin:0 16px 10px"><b>${c.severity === "error" ? "Conflict" : "Heads up"}:</b> ${esc(c.message)}</div>`).join("")}
      ${scenes.map((s) => `<div class="sc"><span class="chip-num" style="min-width:30px;height:30px">${esc(s.number)}</span><span style="flex:1;min-width:160px;overflow-wrap:anywhere"><b>${esc(s.heading)}</b><br><span class="faint" style="font-size:12px">${esc(s.characters.join(", ") || "No cast")}</span></span>${todChip(s.timeOfDay)}${edit ? `<label class="f" style="flex-direction:row;align-items:center;gap:6px;font-weight:400">Move to<select data-c="moveScene" data-id="${s.id}" style="width:auto"><option selected disabled>Day ${d.n}</option>${sched.days.filter((x) => x.id !== d.id).map((x) => `<option value="${x.id}">Day ${x.n}</option>`).join("")}</select></label>` : ""}</div>`).join("") || `<div class="sc faint">No scenes on this day.</div>`}
      ${edit ? `<div class="sc">${btn(sh ? "Generate new revision" : "Generate call sheet", "makeSheet", `data-id="${d.id}"`, "primary sm")}${sh ? btn("View latest", "tab", `data-v="sheets" data-id="${sh.id}"`, "sm") : ""}</div>` : ""}</div>`;
  }).join("")}`;
}

function vSheets() {
  const sheets = S.sheets.slice().sort((a, b) => a.content.dayNumber - b.content.dayNumber || b.rev - a.rev);
  if (!sheets.length) return head("Call sheets", "") + empty("No call sheets yet", "Generate one from a shooting day. Each change creates a new, dated revision.", can("schedule") ? btn("Go to schedule", "tab", 'data-v="schedule"', "primary") : "");
  const sh = sheets.find((x) => x.id === S.sheetId) || sheets[0]; const c = sh.content;
  const day = S.schedule?.days.find((d) => d.id === sh.dayId);
  const latest = latestSheet(sh.dayId); const stale = latest.id !== sh.id;
  const acked = sh.acks.includes(roleName(S.role));
  return `${head("Call sheets", "Frozen snapshots. They contain no budget figures and no email addresses.")}
  <label class="f" style="max-width:360px">Revision<select data-c="pickSheet" aria-label="Choose call sheet">${sheets.map((x) => `<option value="${x.id}" ${x.id === sh.id ? "selected" : ""}>Day ${x.content.dayNumber} · revision ${x.rev}</option>`).join("")}</select></label>
  ${stale ? `<div class="alert warn"><b>Superseded.</b> A newer revision (r${latest.rev}) exists for this day.</div>` : day && latest.hash !== hash(sheetContent(day)) ? `<div class="alert warn"><b>Outdated.</b> The schedule changed after this revision. Generate a new one.</div>` : ""}
  <div class="sheet">
    <div><div class="faint" style="font-size:11px;letter-spacing:.08em;text-transform:uppercase">Call sheet · revision ${sh.rev} · ${new Date(sh.at).toLocaleString()}</div><h1>${esc(c.production)}</h1></div>
    <div class="kv"><div><span>Day</span><b>${c.dayNumber}</b></div><div><span>Date</span><b>${fmtDate(c.date)}</b></div><div><span>General call</span><b>${c.generalCall}</b></div><div><span>Target wrap</span><b>${c.wrapTarget}</b></div></div>
    <div><h3>Schedule</h3>${c.scenes.map((s) => `<div class="row" style="padding:6px 0;border-bottom:1px solid var(--line)"><span class="chip-num" style="min-width:30px;height:30px">${esc(s.number)}</span><span style="flex:1;min-width:160px;overflow-wrap:anywhere">${esc(s.heading)}<br><span class="faint" style="font-size:12px">Cast: ${esc(s.cast.join(", ") || "none")}</span></span>${todChip(s.timeOfDay)}</div>`).join("")}</div>
    <div><h3>Locations</h3><p>${c.locations.map(esc).join(" · ")}</p></div>
    <div><h3>Cast (${c.cast.length})</h3><p>${c.cast.map(esc).join(", ") || "—"}</p></div>
    <div><h3>Crew (${c.crew.length})</h3><div class="tbl-wrap"><table><thead><tr><th>Name</th><th>Role</th><th>Call</th></tr></thead><tbody>${c.crew.map((m) => `<tr><td>${esc(m.name)}</td><td style="text-align:left;white-space:normal">${esc(roleName(m.role))}${m.title ? " · " + esc(m.title) : ""}</td><td>${m.call}</td></tr>`).join("")}</tbody></table></div></div>
  </div>
  <div class="card pad row"><div style="flex:1;min-width:200px"><h2>Acknowledgements</h2><p class="muted">${sh.acks.length ? esc(sh.acks.join(", ")) + " acknowledged." : "Nobody has acknowledged this revision yet."}</p></div>${acked ? badge("You acknowledged", "ok") : btn(`Acknowledge as ${esc(roleName(S.role))}`, "ack", `data-id="${sh.id}"`, "primary")}</div>`;
}

function vCrew() {
  const edit = can("crew", "edit");
  return `${head("Crew", "Everyone on this project and what their role lets them see. Switch “View as” in the sidebar to experience each role.")}
  <div class="card">${S.crew.map((m) => { const secs = PROJECT_SECTIONS.filter((s) => sectionAccess({ workspaceRole: null, projectRole: m.role }, s) !== "none"); return `<div class="person"><span class="av">${esc(m.name.split(" ").map((p) => p[0]).slice(0, 2).join(""))}</span><div style="flex:1;min-width:150px"><b>${esc(m.name)}</b><div class="faint" style="font-size:12px">${esc(roleName(m.role))}${m.title ? " · " + esc(m.title) : ""}</div></div><div class="access">${secs.map((s) => badge(SECTION_LABEL[s], sectionAccess({ workspaceRole: null, projectRole: m.role }, s) === "edit" ? "accent" : "")).join("")}</div>${edit && m.role !== "producer" ? btn("Remove", "rmPerson", `data-id="${m.id}"`, "sm ghost") : ""}</div>`; }).join("")}</div>
  <div class="faint" style="font-size:12px">Orange = can edit · grey = can view. Budgets stay hidden from crew, cast and clients by default.</div>
  ${edit ? `<div class="card pad" data-form><h2 style="margin-bottom:10px">Add someone</h2><div class="row"><input type="text" data-n placeholder="Name" aria-label="Name" style="flex:1;min-width:140px"><select data-r aria-label="Role" style="width:auto">${ROLES.map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}</select><input type="text" data-t placeholder="Title (optional)" aria-label="Title" style="flex:1;min-width:120px">${btn("Add", "addPerson", "", "primary")}</div></div>` : ""}`;
}

const VIEWS = { overview: vOverview, script: vScript, breakdown: vBreakdown, budget: vBudget, schedule: vSchedule, sheets: vSheets, crew: vCrew };

const LOGO = `<svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="#0b0c0f" stroke="#2c3038"/><path d="M8 21.5 16 7l8 14.5" fill="none" stroke="#f0a04b" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/><circle cx="16" cy="21" r="2.6" fill="#f0a04b"/></svg>`;
function render() {
  const app = document.getElementById("app");
  const scrollY = window.scrollY;
  const nav = (cls) => TABS.map(([k, l, sec]) => { const ok = can(sec); return `<button class="nav" data-a="${ok ? "tab" : ""}" data-v="${k}" ${ok ? "" : "disabled"} ${S.tab === k ? 'aria-current="page"' : ""} title="${ok ? "" : "Your role can't see this section"}"><span class="dot"></span>${l}${ok ? "" : '<span class="lock">no access</span>'}</button>`; }).join("");
  const roleSel = `<select data-c="role" aria-label="View as">${ROLES.map(([k, l]) => `<option value="${k}" ${k === S.role ? "selected" : ""}>${l}</option>`).join("")}</select>`;
  app.innerHTML = `<div class="topbar"><div class="row"><span class="brand">${LOGO}ShotPilot</span>${roleSel}</div><div class="strip">${nav()}</div></div>
  <div class="shell"><aside class="rail"><div class="brand">${LOGO}ShotPilot</div>
    <div class="label">Project</div><div class="mini" style="color:var(--rail-ink);font-weight:550">${esc(S.projectName)}</div>
    <div class="label">Sections</div>${nav()}
    <div class="spacer"></div><div class="label">View as</div>${roleSel}
    <div class="mini">Permissions follow the real role matrix. A camera operator or client can't open the budget.</div>
    <button class="linkbtn" data-a="theme">Toggle light / dark</button><button class="linkbtn" data-a="reset">Restore sample project</button><button class="linkbtn" data-a="clearAll">Start with an empty project</button></aside>
  <main class="main"><div class="wrap"><div class="banner"><span class="badge ai">Browser preview</span><span><b>Everything runs in this page.</b> No accounts or server: your changes are saved in this browser only. The full app adds sign-in, a shared database, PDF/Word upload and Claude analysis.</span></div>${(VIEWS[S.tab] || vOverview)()}</div></main></div>${S.ui.toast ? `<div class="toast" role="status">${esc(S.ui.toast)}</div>` : ""}`;
  window.scrollTo(0, scrollY);
  save();
}

/* ------------------------------ events ------------------------------ */
document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-a]"); if (!t || t.disabled || !t.dataset.a) return;
  const fn = A[t.dataset.a]; if (!fn) return;
  const r = fn(t, t.dataset.id ?? t.dataset.v, t.dataset.v);
  Promise.resolve(r).then(() => render());
});
document.addEventListener("change", async (e) => {
  const t = e.target.closest("[data-c]"); if (!t) return;
  const fn = A[t.dataset.c]; if (!fn) return;
  await fn(t, t.dataset.id ?? t.dataset.v, t.dataset.v); render();
});
document.addEventListener("input", (e) => { const t = e.target; if (t.dataset && t.dataset.i === "draft") A.draft(t); });
document.addEventListener("toggle", (e) => {
  const d = e.target; if (!d.dataset || !d.dataset.scene) return;
  const id = d.dataset.scene; const i = S.ui.open.indexOf(id);
  if (d.open && i < 0) S.ui.open.push(id); else if (!d.open && i >= 0) S.ui.open.splice(i, 1);
  save();
}, true);

if (!TABS.some((t) => t[0] === S.tab && can(t[2]))) S.tab = "overview";
render();
