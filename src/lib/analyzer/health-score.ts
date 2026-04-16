import type { AnalysisResult } from "@/types/analysis"

export function computeHealthScore(partial: Omit<AnalysisResult, "healthScore">): number {
  let score = 100

  // !important penalty: -1 per occurrence, max -15
  score -= Math.min(partial.importantCount, 15)

  // Duplicate selectors: -2 per group, max -15
  score -= Math.min(partial.duplicateSelectors.length * 2, 15)

  // Duplicate declarations: -1 per group, max -10
  score -= Math.min(partial.duplicateDeclarations.length, 10)

  // ID selectors: -1 per ID, max -10
  score -= Math.min(partial.idCount, 10)

  // Hardcoded colors: penalty based on unique colors vs variable usage
  const colorPenalty = partial.colors.length > 0
    ? Math.min(Math.floor(partial.colors.length * 0.5), 10)
    : 0
  score -= colorPenalty

  // Hardcoded font-sizes: -1 per unique, max -10
  score -= Math.min(partial.fontSizes.length, 10)

  // Low reuse ratio (many unique declarations)
  if (partial.reuseRatio > 0.85) {
    score -= Math.min(Math.floor((partial.reuseRatio - 0.85) * 66), 10)
  }

  // Hardcoded z-index: -1 per unique, max -5
  score -= Math.min(partial.zIndexValues.length, 5)

  // Hardcoded spacing: penalty scales with unique count
  score -= Math.min(Math.floor(partial.spacingValues.length * 0.3), 10)

  // Deep specificity: penalty if many selectors use IDs
  const highSpecSelectors = partial.specificityDistribution.filter(s => s.specificity[0] > 0)
  score -= Math.min(Math.floor(highSpecSelectors.length * 0.5), 5)

  return Math.max(0, Math.min(100, score))
}
