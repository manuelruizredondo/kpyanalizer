import { C } from "./colors"

/**
 * Fuente única de verdad para mapear un health score (0-100) a su color,
 * etiqueta y fondo. Los umbrales coinciden EXACTAMENTE con
 * `getComplexityRating` (80 / 60 / 35) para que el anillo de score y la
 * insignia de complejidad nunca se contradigan.
 */
export interface ScoreBand {
  rating: "low" | "medium" | "high" | "critical"
  label: string
  /** Color principal (texto / trazo del anillo) */
  color: string
  /** Fondo semántico suave para chips/insignias */
  bg: string
}

export function getScoreBand(score: number): ScoreBand {
  if (score >= 80) return { rating: "low", label: "Excelente", color: C.green, bg: C.successBg }
  if (score >= 60) return { rating: "medium", label: "Bueno", color: C.green2, bg: C.successBg }
  if (score >= 35) return { rating: "high", label: "Regular", color: C.yellow, bg: C.warnBg }
  return { rating: "critical", label: "Necesita mejoras", color: C.red, bg: C.dangerBg }
}

/** Atajo cuando solo se necesita el color. */
export function scoreColor(score: number): string {
  return getScoreBand(score).color
}
