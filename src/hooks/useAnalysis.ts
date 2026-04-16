import { useState, useCallback } from "react"
import { analyzeCss } from "@/lib/analyzer"
import type { AnalysisResult } from "@/types/analysis"

export function useAnalysis() {
  const [css, setCss] = useState("")
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  const analyze = useCallback((cssText: string) => {
    setCss(cssText)
    if (!cssText.trim()) {
      setResult(null)
      setError(null)
      return
    }
    setIsAnalyzing(true)
    setError(null)
    try {
      const r = analyzeCss(cssText)
      setResult(r)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al analizar el CSS")
      setResult(null)
    } finally {
      setIsAnalyzing(false)
    }
  }, [])

  return { css, result, error, isAnalyzing, analyze }
}
