import type { AnalysisResult } from "@/types/analysis"

/**
 * El health score se calcula sobre DENSIDADES (problemas por declaración o por
 * selector), no sobre conteos absolutos. Esto es clave: un archivo grande y otro
 * pequeño con la misma *proporción* de problemas obtienen la misma nota.
 *
 * Cada penalización aporta como mucho su `weight`, y los pesos suman 100. La
 * severidad de cada métrica es `clamp(densidad / umbral, 0, 1)`: cuando la
 * densidad alcanza el umbral, esa métrica resta su peso completo. Así el score
 * vive siempre en [0, 100] y solo un CSS genuinamente malo se acerca a 0.
 */

interface ScorePenalty {
  key: string
  label: string
  weight: number
  /** Severidad 0..1 ya normalizada */
  severity: number
  /** Puntos restados = weight * severity */
  points: number
}

export interface HealthScoreBreakdown {
  score: number
  penalties: ScorePenalty[]
}

/** clamp(value, 0, 1) */
function clamp01(value: number): number {
  if (Number.isNaN(value) || !Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}

function sumCounts(values: { count: number }[]): number {
  return values.reduce((acc, v) => acc + (v.count || 0), 0)
}

export function computeHealthScoreBreakdown(
  partial: Omit<AnalysisResult, "healthScore" | "complexityRating">
): HealthScoreBreakdown {
  // Denominadores con guarda para no dividir por cero.
  const decl = Math.max(partial.totalDeclarations, 1)
  const sel = Math.max(partial.totalSelectors, 1)

  // Ocurrencias totales de valores hardcoded (no nº de valores únicos): un color
  // usado 50 veces pesa más que uno usado una vez.
  const colorOcc = sumCounts(partial.colors)
  const fontSizeOcc = sumCounts(partial.fontSizes)
  const spacingOcc = sumCounts(partial.spacingValues)
  const zIndexOcc = sumCounts(partial.zIndexValues)

  // Selectores con especificidad alta = los que usan algún ID (a > 0).
  const highSpecCount = partial.specificityDistribution.filter(s => s.specificity[0] > 0).length

  // Ratio longhand sobre el total de propiedades con forma corta disponible.
  const shortLongTotal = partial.shorthandCount + partial.longhandCount
  const longhandRatio = shortLongTotal > 0 ? partial.longhandCount / shortLongTotal : 0

  // Cada entrada: [clave, etiqueta, peso, densidad, umbral-de-penalización-plena]
  const specs: Array<[string, string, number, number, number]> = [
    // — Valores hardcoded (núcleo de la herramienta) —
    ["colors",        "Colores hardcoded",        14, colorOcc / decl,                       0.20],
    ["fontSizes",     "Font-sizes hardcoded",      8, fontSizeOcc / decl,                     0.10],
    ["spacing",       "Spacing hardcoded",         8, spacingOcc / decl,                      0.25],
    ["zIndex",        "z-index hardcoded",         4, zIndexOcc / decl,                       0.05],

    // — Higiene / mantenibilidad —
    ["important",     "Uso de !important",        12, partial.importantCount / decl,          0.10],
    ["dupSelectors",  "Selectores duplicados",     9, partial.duplicateSelectors.length / sel, 0.15],
    ["dupDecls",      "Declaraciones duplicadas",  7, partial.duplicateDeclarations.length / decl, 0.20],
    ["idSelectors",   "Selectores ID",             9, partial.idCount / sel,                  0.10],
    ["highSpec",      "Especificidad alta",        9, highSpecCount / sel,                    0.15],
    ["universal",     "Selector universal (*)",    3, partial.universalSelectorCount / sel,   0.05],
    ["vendor",        "Prefijos de vendor",        3, partial.vendorPrefixCount / decl,       0.40],

    // — Angular ViewEncapsulation leaks (:host, ::ng-deep, /deep/, >>>) —
    ["angular",       "Fugas de encapsulación Angular", 10, partial.angularEncapsulationCount / decl, 0.05],
  ]

  const penalties: ScorePenalty[] = specs.map(([key, label, weight, density, threshold]) => {
    const severity = clamp01(density / threshold)
    return { key, label, weight, severity, points: weight * severity }
  })

  // Longhand vs shorthand: solo penaliza por encima de 0.5 (mitad longhand es
  // normal), llegando a peso pleno en 0.90. Peso 4.
  {
    const severity = clamp01((longhandRatio - 0.5) / (0.9 - 0.5))
    penalties.push({
      key: "longhand",
      label: "Propiedades longhand vs shorthand",
      weight: 4,
      severity,
      points: 4 * severity,
    })
  }

  const totalPenalty = penalties.reduce((acc, p) => acc + p.points, 0)
  const score = Math.round(Math.max(0, Math.min(100, 100 - totalPenalty)))

  return { score, penalties }
}

export function computeHealthScore(partial: Omit<AnalysisResult, "healthScore" | "complexityRating">): number {
  return computeHealthScoreBreakdown(partial).score
}

export function getComplexityRating(score: number): 'low' | 'medium' | 'high' | 'critical' {
  if (score >= 80) return 'low'
  if (score >= 60) return 'medium'
  if (score >= 35) return 'high'
  return 'critical'
}
