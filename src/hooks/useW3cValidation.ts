import { useState, useCallback } from "react"
import { validateCssW3c } from "@/lib/w3c-validator"
import type { W3cValidationResult } from "@/types/w3c"

export function useW3cValidation() {
  const [result, setResult] = useState<W3cValidationResult | null>(null)
  const [isValidating, setIsValidating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const validate = useCallback(async (css: string) => {
    if (!css.trim()) return
    setIsValidating(true)
    setError(null)
    try {
      const r = await validateCssW3c(css)
      setResult(r)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al validar con W3C")
    } finally {
      setIsValidating(false)
    }
  }, [])

  const reset = useCallback(() => {
    setResult(null)
    setError(null)
  }, [])

  return { result, isValidating, error, validate, reset }
}
