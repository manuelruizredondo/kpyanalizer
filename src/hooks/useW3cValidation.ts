import { useState, useCallback, useRef, useEffect } from "react"
import { validateCssLocal } from "@/lib/css-validator"
import { validateCssW3c } from "@/lib/w3c-validator"
import type { W3cValidationResult } from "@/types/w3c"

export type ValidationMode = "local" | "w3c"

// La validación local hace un parse + lexer completo del CSS; en un fichero de
// varios MB bloquea el hilo cientos de ms, así que no puede ir en cada tecla.
const LOCAL_DEBOUNCE_MS = 500

export function useW3cValidation() {
  const [result, setResult] = useState<W3cValidationResult | null>(null)
  const [isValidating, setIsValidating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<ValidationMode>("local")
  // Cada petición recibe un id; solo la más reciente puede escribir estado.
  // Evita que una respuesta W3C lenta (hasta 30s) pise el resultado del CSS
  // que el usuario pegó después.
  const requestIdRef = useRef(0)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => () => clearTimeout(debounceRef.current), [])

  const run = useCallback(async (css: string, selectedMode: ValidationMode) => {
    const id = ++requestIdRef.current
    setIsValidating(true)
    setError(null)
    try {
      const r = selectedMode === "local" ? validateCssLocal(css) : await validateCssW3c(css)
      if (id === requestIdRef.current) setResult({ ...r, mode: selectedMode })
    } catch (e) {
      if (id === requestIdRef.current) setError(e instanceof Error ? e.message : "Error al validar")
    } finally {
      if (id === requestIdRef.current) setIsValidating(false)
    }
  }, [])

  const validate = useCallback((css: string, useMode?: ValidationMode) => {
    clearTimeout(debounceRef.current)
    if (!css.trim()) return
    void run(css, useMode || mode)
  }, [mode, run])

  /** Validación local diferida, para lanzarla mientras el usuario escribe. */
  const validateLocalDebounced = useCallback((css: string) => {
    clearTimeout(debounceRef.current)
    // Invalida cualquier petición en curso: su resultado ya no corresponde.
    requestIdRef.current++
    if (!css.trim()) return
    setIsValidating(true)
    debounceRef.current = setTimeout(() => void run(css, "local"), LOCAL_DEBOUNCE_MS)
  }, [run])

  const reset = useCallback(() => {
    clearTimeout(debounceRef.current)
    requestIdRef.current++
    setResult(null)
    setError(null)
    setIsValidating(false)
  }, [])

  return { result, isValidating, error, validate, validateLocalDebounced, reset, mode, setMode }
}
