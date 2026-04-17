import { useState, useCallback } from "react"
import { validateCssLocal } from "@/lib/css-validator"
import { validateCssW3c } from "@/lib/w3c-validator"
import type { W3cValidationResult } from "@/types/w3c"

export type ValidationMode = "local" | "w3c"

export function useW3cValidation() {
  const [result, setResult] = useState<W3cValidationResult | null>(null)
  const [isValidating, setIsValidating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<ValidationMode>("local")

  const validate = useCallback(async (css: string, useMode?: ValidationMode) => {
    if (!css.trim()) return
    const selectedMode = useMode || mode
    setIsValidating(true)
    setError(null)
    try {
      if (selectedMode === "local") {
        const r = validateCssLocal(css)
        setResult(r)
      } else {
        const r = await validateCssW3c(css)
        setResult(r)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al validar")
    } finally {
      setIsValidating(false)
    }
  }, [mode])

  const reset = useCallback(() => {
    setResult(null)
    setError(null)
  }, [])

  return { result, isValidating, error, validate, reset, mode, setMode }
}
