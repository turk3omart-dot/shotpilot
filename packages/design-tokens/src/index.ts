/** Token names mirrored for native clients (SwiftUI) and documentation. Values live in tokens.css. */
export const colorTokens = [
  "bg", "surface", "surface-2", "border", "border-strong", "text", "text-2", "text-3",
  "rail", "rail-2", "rail-text", "rail-text-2",
  "accent", "accent-strong", "accent-soft", "accent-contrast",
  "info", "info-soft", "ok", "ok-soft", "warn", "warn-soft", "danger", "danger-soft", "ai", "ai-soft",
] as const;

export const light = {
  bg: "#f6f5f2", surface: "#ffffff", text: "#1b1d22", accent: "#d9822b", rail: "#16181d", ai: "#7c4dde",
} as const;
export const dark = {
  bg: "#111317", surface: "#181b20", text: "#ecebe7", accent: "#f0a04b", rail: "#0b0c0f", ai: "#a688f0",
} as const;
