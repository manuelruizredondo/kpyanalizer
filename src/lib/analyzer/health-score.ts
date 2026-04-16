import type { AnalysisResult } from "@/types/analysis"

export function computeHealthScore(partial: Omit<AnalysisResult, "healthScore" | "complexityRating">): number {
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

  // Vendor prefix ratio: if >30% of declarations have vendor prefixes, penalty up to -5
  if (partial.totalDeclarations > 0) {
    const vendorPrefixRatio = partial.vendorPrefixCount / partial.totalDeclarations
    if (vendorPrefixRatio > 0.3) {
      score -= Math.min(Math.floor((vendorPrefixRatio - 0.3) * 50), 5)
    }
  }

  // Universal selector usage: -1 per usage, max -5
  score -= Math.min(partial.universalSelectorCount, 5)

  // Very high specificity: if max specificity has a>0, -2 per selector with a>0, max -10
  score -= Math.min(Math.floor(highSpecSelectors.length * 2), 10)

  // Shorthand efficiency: if longhand > shorthand*3, penalty up to -5
  if (partial.shorthandCount + partial.longhandCount > 0) {
    const longhandRatio = partial.longhandCount / (partial.shorthandCount + partial.longhandCount)
    if (longhandRatio > 0.75) {
      score -= Math.min(Math.floor((longhandRatio - 0.75) * 20), 5)
    }
  }

  return Math.max(0, Math.min(100, score))
}

export function getComplexityRating(score: number): 'low' | 'medium' | 'high' | 'critical' {
  if (score >= 80) return 'low'
  if (score >= 60) return 'medium'
  if (score >= 35) return 'high'
  return 'critical'
}
