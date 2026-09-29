export interface W3cIssue {
  line: number
  message: string
  context: string
  type: string
}

export interface W3cValidationResult {
  valid: boolean
  errorCount: number
  warningCount: number
  errors: W3cIssue[]
  warnings: W3cIssue[]
  /** Modo que produjo ESTE resultado (no el seleccionado ahora en la UI). */
  mode?: "local" | "w3c"
}
