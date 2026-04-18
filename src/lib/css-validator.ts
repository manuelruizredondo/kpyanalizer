/**
 * Local CSS Validator — powered by css-tree's lexer.
 * Replaces the W3C Jigsaw dependency with instant, offline validation.
 *
 * Detects:
 *  - CSS syntax/parse errors
 *  - Unknown properties (e.g. "colr" instead of "color")
 *  - Invalid values (e.g. "font-size: abc")
 *  - Vendor-prefixed properties (as warnings — may need autoprefixer)
 *  - Empty rules (selector with no declarations)
 *  - Duplicate properties within the same rule
 *  - !important usage (as warnings)
 *  - @charset must be first rule
 */

import { csstree } from "./css-parser"
import type { W3cValidationResult, W3cIssue } from "@/types/w3c"

/**
 * Descriptors valid inside @font-face — these are NOT regular CSS properties
 * and should not be flagged as "unknown property".
 */
const FONT_FACE_DESCRIPTORS = new Set([
  "src",
  "font-display",
  "unicode-range",
  "font-stretch",
  "font-variation-settings",
  "ascent-override",
  "descent-override",
  "line-gap-override",
  "size-adjust",
])

interface ParseErrorInfo {
  message: string
  line: number
  column: number
}

export function validateCssLocal(css: string): W3cValidationResult {
  const errors: W3cIssue[] = []
  const warnings: W3cIssue[] = []

  // ── Phase 1: Parse errors ──
  const parseErrors: ParseErrorInfo[] = []
  let ast: ReturnType<typeof csstree.parse>

  try {
    ast = csstree.parse(css, {
      positions: true,
      parseAtrulePrelude: true,
      parseRulePrelude: true,
      parseValue: true,
      parseCustomProperty: false, // Don't validate custom property values
      onParseError: (err: any) => {
        parseErrors.push({
          message: err.message ?? String(err),
          line: err.line ?? err.offset ?? 0,
          column: err.column ?? 0,
        })
      },
    })
  } catch (e) {
    // Fatal parse error — CSS is completely broken
    return {
      valid: false,
      errorCount: 1,
      warningCount: 0,
      errors: [{
        line: 0,
        message: `Error fatal de sintaxis: ${e instanceof Error ? e.message : String(e)}`,
        context: "",
        type: "error",
      }],
      warnings: [],
    }
  }

  // Add parse errors
  for (const pe of parseErrors) {
    errors.push({
      line: pe.line,
      message: `Error de sintaxis: ${pe.message}`,
      context: getLineContext(css, pe.line),
      type: "parse-error",
    })
  }

  // ── Phase 2: Lexer validation (property + value checking) ──
  const lexer = csstree.lexer
  let currentSelector = ""
  let charsetFound = false
  void charsetFound // used below as write-only flag
  let firstRuleSeen = false
  let insideFontFace = false

  csstree.walk(ast, {
    enter(node: import("css-tree").CssNode) {
      // Track @font-face context
      if (node.type === "Atrule" && node.name === "font-face") {
        insideFontFace = true
      }

      // Track current selector for context
      if (node.type === "Rule" && node.prelude) {
        currentSelector = csstree.generate(node.prelude)

        // Check for empty rules
        if (node.block && node.block.type === "Block") {
          const hasDeclarations = node.block.children.some(
            (child: import("css-tree").CssNode) => child.type === "Declaration"
          )
          if (!hasDeclarations) {
            warnings.push({
              line: node.loc?.start?.line ?? 0,
              message: `Regla vacia: el selector no contiene declaraciones`,
              context: currentSelector,
              type: "empty-rule",
            })
          }
        }
      }

      // @charset check
      if (node.type === "Atrule") {
        if (!firstRuleSeen && node.name !== "charset") {
          firstRuleSeen = true
        }
        if (node.name === "charset") {
          if (firstRuleSeen) {
            errors.push({
              line: node.loc?.start?.line ?? 0,
              message: "@charset debe ser la primera regla del archivo CSS",
              context: `@charset`,
              type: "charset-position",
            })
          }
          charsetFound = true
          firstRuleSeen = true
        }
      }

      if (node.type === "Rule") {
        firstRuleSeen = true
      }

      // Validate declarations
      if (node.type === "Declaration") {
        const property = node.property

        // Skip custom properties (--var)
        if (property.startsWith("--")) return

        // Skip @font-face descriptors (src, font-display, etc.)
        if (insideFontFace && FONT_FACE_DESCRIPTORS.has(property.toLowerCase())) return

        // Vendor-prefixed property warning
        if (
          property.startsWith("-webkit-") ||
          property.startsWith("-moz-") ||
          property.startsWith("-ms-") ||
          property.startsWith("-o-")
        ) {
          warnings.push({
            line: node.loc?.start?.line ?? 0,
            message: `Propiedad con prefijo vendor "${property}". Considera usar autoprefixer.`,
            context: `${currentSelector} { ${property}: ${csstree.generate(node.value)} }`,
            type: "vendor-prefix",
          })
          return // Don't validate vendor-prefixed values further
        }

        // !important warning
        if (node.important) {
          warnings.push({
            line: node.loc?.start?.line ?? 0,
            message: `Uso de !important en "${property}". Puede causar problemas de especificidad.`,
            context: `${currentSelector} { ${property}: ${csstree.generate(node.value)} !important }`,
            type: "important",
          })
        }

        // Lexer validation: unknown property + invalid value
        const matchResult = lexer.matchDeclaration(node)
        if (matchResult.error) {
          const errMsg = matchResult.error.message || ""

          if (errMsg.startsWith("Unknown property")) {
            errors.push({
              line: node.loc?.start?.line ?? 0,
              message: `Propiedad desconocida "${property}"`,
              context: `${currentSelector} { ${property}: ${csstree.generate(node.value)} }`,
              type: "unknown-property",
            })
          } else if (errMsg.includes("Mismatch")) {
            // Extract the expected syntax for a useful message
            const syntaxMatch = errMsg.match(/syntax:\s*(.+?)[\n\r]/)
            const expectedSyntax = syntaxMatch ? syntaxMatch[1].trim() : ""
            const valueStr = csstree.generate(node.value)

            errors.push({
              line: node.loc?.start?.line ?? 0,
              message: `Valor invalido para "${property}": "${valueStr}"${expectedSyntax ? `. Esperado: ${expectedSyntax.slice(0, 80)}` : ""}`,
              context: `${currentSelector} { ${property}: ${valueStr} }`,
              type: "invalid-value",
            })
          }
        }
      }
    },
    leave(node: import("css-tree").CssNode) {
      if (node.type === "Atrule" && node.name === "font-face") {
        insideFontFace = false
      }
    },
  })

  // ── Phase 3: Duplicate property detection within same rule ──
  checkDuplicateProperties(ast, warnings, css)

  // Sort by line number
  errors.sort((a, b) => a.line - b.line)
  warnings.sort((a, b) => a.line - b.line)

  return {
    valid: errors.length === 0,
    errorCount: errors.length,
    warningCount: warnings.length,
    errors,
    warnings,
  }
}

/**
 * Detect duplicate properties within the same rule block.
 * Duplicate properties are usually accidental (except for fallback patterns).
 */
function checkDuplicateProperties(
  ast: ReturnType<typeof csstree.parse>,
  warnings: W3cIssue[],
  _css: string
) {
  csstree.walk(ast, {
    visit: "Rule",
    enter(node: import("css-tree").CssNode) {
      if (node.type !== "Rule" || !node.block) return

      const seen = new Map<string, { line: number; value: string }>()
      let selector = ""
      if (node.prelude) {
        selector = csstree.generate(node.prelude)
      }

      node.block.children.forEach((child: import("css-tree").CssNode) => {
        if (child.type === "Declaration" && !child.property.startsWith("--")) {
          const prop = child.property.toLowerCase()
          const value = csstree.generate(child.value)
          const line = child.loc?.start?.line ?? 0

          if (seen.has(prop)) {
            const prev = seen.get(prop)!
            // Only warn if the values are the same (true duplicate, not fallback)
            if (prev.value === value) {
              warnings.push({
                line,
                message: `Propiedad "${prop}" duplicada con el mismo valor en la misma regla (linea ${prev.line})`,
                context: `${selector} { ${prop}: ${value} }`,
                type: "duplicate-property",
              })
            }
          }
          seen.set(prop, { line, value })
        }
      })
    },
  })
}

/**
 * Get the source line for context display.
 */
function getLineContext(css: string, line: number): string {
  if (line <= 0) return ""
  const lines = css.split("\n")
  if (line > lines.length) return ""
  return lines[line - 1]?.trim().slice(0, 120) || ""
}
