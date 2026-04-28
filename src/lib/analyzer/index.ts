import { parseCss } from "../css-parser"
import { extractBasicMetrics } from "./metrics"
import { extractHardcoded } from "./hardcoded"
import { extractDuplicates } from "./duplicates"
import { extractSpecificity, computeSpecificityStats } from "./specificity"
import { extractAngularEncapsulation } from "./angular-encapsulation"
import { computeHealthScore, getComplexityRating } from "./health-score"
import type { AnalysisResult } from "@/types/analysis"

export function analyzeCss(css: string): AnalysisResult {
  const ast = parseCss(css)
  const basic = extractBasicMetrics(ast)
  const hardcoded = extractHardcoded(ast)
  const dupes = extractDuplicates(ast)
  const specificity = extractSpecificity(ast)
  const specificityStats = computeSpecificityStats(specificity)
  const angular = extractAngularEncapsulation(ast, css)

  const fileSize = new Blob([css]).size
  const lineCount = css.split("\n").length
  const reuseRatio = basic.totalDeclarations > 0
    ? dupes.uniqueDeclarations / basic.totalDeclarations
    : 0

  const partial = {
    raw: css,
    fileSize,
    lineCount,
    classCount: basic.classCount,
    idCount: basic.idCount,
    importantCount: basic.importantCount,
    variableCount: basic.variableCount,
    colors: hardcoded.colors,
    fontSizes: hardcoded.fontSizes,
    spacingValues: hardcoded.spacingValues,
    zIndexValues: hardcoded.zIndexValues,
    fontWeights: hardcoded.fontWeights,
    fontFamilies: hardcoded.fontFamilies,
    importants: hardcoded.importants,
    duplicateSelectors: dupes.duplicateSelectors,
    duplicateDeclarations: dupes.duplicateDeclarations,
    mediaQueries: dupes.mediaQueries,
    keyframes: dupes.keyframes,
    specificityDistribution: specificity,
    reuseRatio,
    totalSelectors: basic.totalSelectors,
    totalDeclarations: basic.totalDeclarations,
    uniqueDeclarations: dupes.uniqueDeclarations,
    maxSpecificity: specificityStats.max,
    avgSpecificity: specificityStats.avg,
    deepestNesting: dupes.deepestNesting,
    universalSelectorCount: basic.universalSelectorCount,
    attributeSelectorCount: basic.attributeSelectorCount,
    pseudoClassCount: basic.pseudoClassCount,
    pseudoElementCount: basic.pseudoElementCount,
    vendorPrefixCount: basic.vendorPrefixCount,
    shorthandCount: basic.shorthandCount,
    longhandCount: basic.longhandCount,
    angularEncapsulationCount: angular.count,
    angularEncapsulationBreakdown: angular.breakdown,
    angularEncapsulationLocations: angular.locations,
  }

  const healthScore = computeHealthScore(partial)
  const complexityRating = getComplexityRating(healthScore)

  return { ...partial, healthScore, complexityRating }
}
