/**
 * Font classification utilities — shared across TypographyTab,
 * DashboardPage, and ConfrontarTab.
 */

/** The only approved custom font family */
export const DS_FONT_KEYWORD = "suisse"

/**
 * HG5 design-system typography tokens — fuente única de verdad.
 * (Fuentes Suisse + sus grosores y variables CSS reales del framework HG5.)
 */
export interface Hg5TypoToken {
  /** Nombre del token (p.ej. "primary-thin") */
  name: string
  /** font-weight numérico */
  weight: number
  /** Valor completo de font-family */
  value: string
  /** Variable CSS asociada en HG5 */
  cssVar: string
}

export const HG5_TYPOGRAPHY: Hg5TypoToken[] = [
  { name: "primary-thin",    weight: 100, value: '"suisse-thin", Arial, Helvetica, sans-serif',     cssVar: "--hg-typo-font-family-primary-thin" },
  { name: "primary-light",   weight: 300, value: '"suisse-light", Arial, Helvetica, sans-serif',    cssVar: "--hg-typo-font-family-primary-light" },
  { name: "primary-regular", weight: 400, value: '"suisse-regular", Arial, Helvetica, sans-serif',  cssVar: "--hg-typo-font-family-primary-regular" },
  { name: "primary-bold",    weight: 600, value: '"suisse-semibold", Arial, Helvetica, sans-serif', cssVar: "--hg-typo-font-family-primary-bold" },
  { name: "secondary",       weight: 500, value: '"suisse-medium", Arial, Helvetica, sans-serif',   cssVar: "--hg-typo-font-family-secondary" },
  { name: "mono-regular",    weight: 400, value: '"suisse-mono-regular", ui-monospace, monospace',  cssVar: "--hg-typo-font-family-mono-regular" },
  { name: "mono-bold",       weight: 700, value: '"suisse-mono-bold", ui-monospace, monospace',     cssVar: "--hg-typo-font-family-mono-bold" },
]

/**
 * Grosores aprobados por HG5, derivados de los tokens reales.
 * → [100, 300, 400, 500, 600, 700]
 */
export const DS_APPROVED_WEIGHTS: number[] = Array.from(
  new Set(HG5_TYPOGRAPHY.map(t => t.weight)),
).sort((a, b) => a - b)

/** ¿Es `weight` un grosor aprobado por HG5? */
export function isApprovedWeight(weight: number): boolean {
  return DS_APPROVED_WEIGHTS.includes(weight)
}

/**
 * Grosor aprobado más cercano (para sugerencias de migración). En caso de
 * empate devuelve el menor.
 */
export function nearestApprovedWeight(weight: number): number {
  return DS_APPROVED_WEIGHTS.reduce(
    (best, w) => (Math.abs(w - weight) < Math.abs(best - weight) ? w : best),
    DS_APPROVED_WEIGHTS[0],
  )
}

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
