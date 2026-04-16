import { useState, useCallback, useEffect, useRef } from "react"
import { analyzeCss } from "@/lib/analyzer"
import type { AnalysisResult } from "@/types/analysis"

const STORAGE_KEY = "kpy_last_css"
const DEBOUNCE_MS = 500

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
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const analysisIdRef = useRef(0)

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

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const analyze = useCallback((cssText: string) => {
    setCss(cssText)
    if (!cssText.trim()) {
      setResult(null)
      setError(null)
      setIsAnalyzing(false)
      return
    }

    // Debounce analysis for typing
    setIsAnalyzing(true)
    setError(null)
    if (debounceRef.current) clearTimeout(debounceRef.current)

    const thisId = ++analysisIdRef.current

    debounceRef.current = setTimeout(() => {
      // Use requestIdleCallback if available, else requestAnimationFrame
      const scheduleAnalysis = (cb: () => void) => {
        if ('requestIdleCallback' in window) {
          requestIdleCallback(cb, { timeout: 2000 })
        } else {
          requestAnimationFrame(cb)
        }
      }

      scheduleAnalysis(() => {
        // Skip if a newer analysis was requested
        if (thisId !== analysisIdRef.current) return

        try {
          const r = analyzeCss(cssText)
          if (thisId === analysisIdRef.current) {
            setResult(r)
            setIsAnalyzing(false)
          }
        } catch (e) {
          if (thisId === analysisIdRef.current) {
            setError(e instanceof Error ? e.message : "Error al analizar el CSS")
            setResult(null)
            setIsAnalyzing(false)
          }
        }
      })
    }, DEBOUNCE_MS)
  }, [])

  return { css, result, error, isAnalyzing, analyze }
}
