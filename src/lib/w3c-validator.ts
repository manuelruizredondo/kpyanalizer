import type { W3cValidationResult, W3cIssue } from "@/types/w3c"

const W3C_PROXY = "https://lqgdrkwabcjrnnthlrmi.supabase.co/functions/v1/w3c-validator"

export async function validateCssW3c(css: string): Promise<W3cValidationResult> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000)

  try {
    const response = await fetch(W3C_PROXY, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ css }),
    })

    clearTimeout(timeout)

    if (!response.ok) {
      const errBody = await response.text().catch(() => "")
      throw new Error(`W3C validator respondio con status ${response.status}${errBody ? `: ${errBody.slice(0, 200)}` : ""}`)
    }

    const data = await response.json()
    return parseW3cResponse(data)
  } catch (err) {
    clearTimeout(timeout)
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("La validacion W3C tardo demasiado (timeout 30s). Intenta con un CSS mas pequeno.")
    }
    throw err
  }
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
