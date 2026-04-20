/**
 * Font classification utilities — shared across TypographyTab,
 * DashboardPage, and ConfrontarTab.
 */

/** The only approved custom font family */
export const DS_FONT_KEYWORD = "suisse"

/** CSS generic / web-safe families that are acceptable fallbacks */
export const GENERIC_FAMILIES = new Set([
  "serif", "sans-serif", "monospace", "cursive", "fantasy",
  "system-ui", "ui-serif", "ui-sans-serif", "ui-monospace", "ui-rounded",
  "emoji", "math", "fangsong",
  "inherit", "initial", "unset", "revert",
  // Web-safe system fonts
  "arial", "helvetica", "times new roman", "times", "courier new",
  "courier", "georgia", "verdana", "tahoma", "trebuchet ms",
  "palatino linotype", "palatino", "impact", "lucida console",
  "lucida sans unicode", "lucida grande", "segoe ui", "roboto",
])

export type FamilyTier = "ds" | "generic" | "eliminate"

/**
 * Classify a font-family value into one of three tiers:
 * - `ds`        — contains "suisse" (approved design-system font)
 * - `generic`   — CSS generic / web-safe (acceptable fallback)
 * - `eliminate`  — custom font that should be removed
 */
export function classifyFamily(normalized: string): FamilyTier {
  const lower = normalized.toLowerCase().replace(/['"]/g, "").trim()
  if (lower.includes(DS_FONT_KEYWORD)) return "ds"
  if (GENERIC_FAMILIES.has(lower)) return "generic"
  return "eliminate"
}

/** Human-readable label for a CSS font-weight value */
export function getWeightLabel(normalized: string): string {
  const map: Record<string, string> = {
    "100": "Thin", "200": "Extra Light", "300": "Light",
    "400": "Normal", "500": "Medium", "600": "Semi Bold",
    "700": "Bold", "800": "Extra Bold", "900": "Black",
  }
  return map[normalized] || normalized
}
