import { parseCss } from "../css-parser"
import { extractBasicMetrics } from "./metrics"
import { extractHardcoded } from "./hardcoded"
import { extractDuplicates } from "./duplicates"
import { extractSpecificity } from "./specificity"
import { computeHealthScore } from "./health-score"
import type { AnalysisResult } from "@/types/analysis"

export function analyzeCss(css: string): AnalysisResult {
  const ast = parseCss(css)
  const basic = extractBasicMetrics(ast)
  const hardcoded = extractHardcoded(ast)
  const dupes = extractDuplicates(ast)
  const specificity = extractSpecificity(ast)

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
  }

  const healthScore = computeHealthScore(partial)

  return { ...partial, healthScore }
}
