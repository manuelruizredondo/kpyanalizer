import { useState, useCallback } from "react"
import { parseDsTokens } from "@/lib/ds-token-parser"
import { compareDsTokens } from "@/lib/ds-comparator"
import type { DsTokenSet, DsCoverageResult } from "@/types/design-system"
import type { AnalysisResult } from "@/types/analysis"

export function useDesignSystem() {
  const [tokens, setTokens] = useState<DsTokenSet | null>(null)
  const [coverage, setCoverage] = useState<DsCoverageResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)

  const loadTokens = useCallback((content: string, name: string) => {
    setError(null)
    try {
      const parsed = parseDsTokens(content, name)
      setTokens(parsed)
      setFileName(name)
      return parsed
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al parsear tokens DS")
      return null
    }
  }, [])

  const compare = useCallback((analysis: AnalysisResult, dsTokens: DsTokenSet) => {
    const result = compareDsTokens(
      analysis.colors,
      analysis.fontSizes,
      analysis.spacingValues,
      analysis.zIndexValues,
      dsTokens
    )
    setCoverage(result)
    return result
  }, [])

  const reset = useCallback(() => {
    setTokens(null)
    setCoverage(null)
    setError(null)
    setFileName(null)
  }, [])

  return { tokens, coverage, error, fileName, loadTokens, compare, reset }
}
