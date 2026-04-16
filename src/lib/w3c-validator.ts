import type { W3cValidationResult, W3cIssue } from "@/types/w3c"

const W3C_ENDPOINT = "https://jigsaw.w3.org/css-validator/validator"
const CORS_PROXY = "https://corsproxy.io/?"

export async function validateCssW3c(css: string): Promise<W3cValidationResult> {
  const params = new URLSearchParams({
    text: css,
    output: "json",
    profile: "css3",
    warning: "2",
  })

  const response = await fetch(
    `${CORS_PROXY}${encodeURIComponent(W3C_ENDPOINT)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    }
  )

  if (!response.ok) {
    throw new Error(`W3C validator respondio con status ${response.status}`)
  }

  const data = await response.json()
  return parseW3cResponse(data)
}

interface W3cRawResponse {
  cssvalidation?: {
    validity?: boolean
    errors?: Array<{
      line?: number
      message?: string
      context?: string
      type?: string
    }>
    warnings?: Array<{
      line?: number
      message?: string
      context?: string
      type?: string
    }>
  }
}

function parseW3cResponse(data: W3cRawResponse): W3cValidationResult {
  const validation = data.cssvalidation ?? {}

  const errors: W3cIssue[] = (validation.errors ?? []).map((e) => ({
    line: e.line ?? 0,
    message: cleanMessage(e.message ?? ""),
    context: e.context ?? "",
    type: e.type ?? "error",
  }))

  const warnings: W3cIssue[] = (validation.warnings ?? []).map((w) => ({
    line: w.line ?? 0,
    message: cleanMessage(w.message ?? ""),
    context: w.context ?? "",
    type: w.type ?? "warning",
  }))

  return {
    valid: validation.validity ?? errors.length === 0,
    errorCount: errors.length,
    warningCount: warnings.length,
    errors,
    warnings,
  }
}

function cleanMessage(msg: string): string {
  return msg.replace(/<[^>]*>/g, "").trim()
}
