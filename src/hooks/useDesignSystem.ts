import { useState, useCallback, useRef } from "react"
import { parseDsTokens } from "@/lib/ds-token-parser"
import { compareDsTokens } from "@/lib/ds-comparator"
import { fetchViaCorsProxy, parseHttpUrl } from "@/lib/edge-functions"
import type { DsTokenSet, DsCoverageResult } from "@/types/design-system"
import type { AnalysisResult } from "@/types/analysis"

export function useDesignSystem() {
  const [tokens, setTokens] = useState<DsTokenSet | null>(null)
  const [coverage, setCoverage] = useState<DsCoverageResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  // Solo la carga más reciente puede escribir estado (otra URL o un fichero
  // soltado mientras tanto invalidan la anterior).
  const loadIdRef = useRef(0)

  const loadTokens = useCallback((content: string, name: string) => {
    loadIdRef.current++
    setLoading(false)
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

  const loadFromUrl = useCallback(async (url: string) => {
    const id = ++loadIdRef.current
    setError(null)
    setLoading(true)
    try {
      const resp = await fetchViaCorsProxy(url)
      if (!resp.ok) throw new Error(`Error ${resp.status}: ${resp.statusText}`)
      const content = await resp.text()
      if (id !== loadIdRef.current) return null
      const name = parseHttpUrl(url)?.pathname.split('/').pop() || 'framework.css'
      const parsed = parseDsTokens(content, name)
      setTokens(parsed)
      setFileName(name)
      return parsed
    } catch (e) {
      if (id === loadIdRef.current) setError(e instanceof Error ? e.message : "Error al cargar la URL")
      return null
    } finally {
      if (id === loadIdRef.current) setLoading(false)
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
    loadIdRef.current++
    setTokens(null)
    setCoverage(null)
    setError(null)
    setFileName(null)
    setLoading(false)
  }, [])

  return { tokens, coverage, error, fileName, loading, loadTokens, loadFromUrl, compare, reset }
}
