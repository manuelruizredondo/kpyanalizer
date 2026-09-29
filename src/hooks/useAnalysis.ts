import { useState, useCallback, useEffect, useRef } from "react"
import { analyzeCss } from "@/lib/analyzer"
import type { AnalysisResult } from "@/types/analysis"
import { LAST_CSS_STORAGE_KEY } from "@/lib/storage-keys"

const DEBOUNCE_MS = 500

function persistCss(css: string) {
  try {
    if (css) {
      sessionStorage.setItem(LAST_CSS_STORAGE_KEY, css)
    } else {
      sessionStorage.removeItem(LAST_CSS_STORAGE_KEY)
    }
  } catch { /* ignore quota errors */ }
}

export function useAnalysis() {
  const [css, setCss] = useState(() => {
    try {
      return sessionStorage.getItem(LAST_CSS_STORAGE_KEY) || ""
    } catch {
      return ""
    }
  })
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(() => css.trim() !== "")
  const hasRestoredRef = useRef(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const analysisIdRef = useRef(0)

  // Re-analiza el CSS restaurado al montar. Se difiere un tick para que la
  // página pinte antes de que analyzeCss (síncrono) ocupe el hilo.
  useEffect(() => {
    if (hasRestoredRef.current || !css.trim()) return
    hasRestoredRef.current = true
    const thisId = ++analysisIdRef.current
    const t = setTimeout(() => {
      if (thisId !== analysisIdRef.current) return
      try {
        setResult(analyzeCss(css))
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al restaurar el análisis")
      } finally {
        setIsAnalyzing(false)
      }
    }, 0)
    return () => {
      clearTimeout(t)
      // En StrictMode el efecto se monta dos veces: permite reintentar.
      hasRestoredRef.current = false
    }
    // Solo al montar: `css` es el valor restaurado de sessionStorage.
  }, [])

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const analyze = useCallback((cssText: string) => {
    setCss(cssText)
    if (!cssText.trim()) {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      analysisIdRef.current++
      persistCss("")
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
      // Persistir también con debounce: copiar MBs a sessionStorage en cada
      // tecla es tan caro como el propio análisis.
      persistCss(cssText)
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
