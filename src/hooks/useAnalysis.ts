import { useState, useCallback, useEffect, useRef } from "react"
import { analyzeCss } from "@/lib/analyzer"
import type { AnalysisResult } from "@/types/analysis"

const STORAGE_KEY = "kpy_last_css"

export function useAnalysis() {
  const [css, setCss] = useState(() => {
    try {
      return sessionStorage.getItem(STORAGE_KEY) || ""
    } catch {
      return ""
    }
  })
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const hasRestoredRef = useRef(false)

  // Re-analyze restored CSS on mount
  useEffect(() => {
    if (!hasRestoredRef.current && css.trim()) {
      hasRestoredRef.current = true
      try {
        const r = analyzeCss(css)
        setResult(r)
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al restaurar el análisis")
      }
    }
  }, [])

  // Persist CSS to sessionStorage
  useEffect(() => {
    try {
      if (css) {
        sessionStorage.setItem(STORAGE_KEY, css)
      } else {
        sessionStorage.removeItem(STORAGE_KEY)
      }
    } catch { /* ignore quota errors */ }
  }, [css])

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
