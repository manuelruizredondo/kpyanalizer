/**
 * KPY CSS Analyzer — Editorial Design System palette
 *
 * Single source of truth for every color used across the app.
 * Import `C` wherever you need a palette token.
 */

export const C = {
  // ── Core editorial palette ─────────────────────────────────
  deepGreen: "#012d1d",   // brand / darkest bg
  green:     "#006c48",   // primary / success / positive
  dark:      "#1a2e23",   // headings
  muted:     "#3d5a4a",   // secondary text
  olive:     "#52695b",   // muted / tertiary
  red:       "#9e2b25",   // error / danger / negative
  yellow:    "#a67c00",   // warning / caution

  // ── Derived shades (charts only) ───────────────────────────
  green2:    "#2a9d6e",   // chart mid-green
  green3:    "#5cc49a",   // chart light-green

  // ── Neutral backgrounds ────────────────────────────────────
  bg:        "#f8f9fa",
  bg2:       "#f0f2f1",

  // ── Semantic backgrounds ───────────────────────────────────
  successBg: "#e0f5ec",
  warnBg:    "#fef6e0",
  dangerBg:  "#fef2f1",
  neutralBg: "#f0f2f1",
} as const

/** Standard pie / bar chart color series */
export const CHART_COLORS = [C.green2, C.yellow, C.red, C.olive, C.green3]

/** Tooltip style reused across recharts components */
export const TT_STYLE = {
  borderRadius: 12,
  border: "none",
  boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
  fontSize: 12,
} as const
