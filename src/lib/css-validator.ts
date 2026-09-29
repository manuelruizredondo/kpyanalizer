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
import { isHelperImportantRule } from "./analyzer/helpers"

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

/**
 * Descriptores propios de otras at-rules (no son propiedades CSS y el lexer
 * los marcaría como "Propiedad desconocida"). Clave: nombre de la at-rule.
 */
const AT_RULE_DESCRIPTORS: Record<string, Set<string>> = {
  "font-face": FONT_FACE_DESCRIPTORS,
  property: new Set(["syntax", "inherits", "initial-value"]),
  "counter-style": new Set([
    "system", "symbols", "additive-symbols", "negative", "prefix", "suffix",
    "range", "pad", "fallback", "speak-as",
  ]),
  page: new Set(["size", "marks", "bleed", "page-orientation"]),
  "font-palette-values": new Set(["font-family", "base-palette", "override-colors"]),
}

/** Valor que usa una función/keyword con prefijo vendor (-webkit-linear-gradient(…), -webkit-box…) */
const VENDOR_VALUE_RE = /(^|[\s,(])-(webkit|moz|ms|o)-/i

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

  // Add parse errors (el CSS se parte en líneas una sola vez, no por error)
  if (parseErrors.length > 0) {
    const lines = css.split("\n")
    for (const pe of parseErrors) {
      errors.push({
        line: pe.line,
        message: `Error de sintaxis: ${pe.message}`,
        context: getLineContext(lines, pe.line),
        type: "parse-error",
      })
    }
  }

  // ── Phase 2: Lexer validation (property + value checking) ──
  const lexer = csstree.lexer
  let currentSelector = ""
  let firstRuleSeen = false
  // Helpers utility (.p-0\!, .mb-0\!, etc.) tienen !important deliberado
  // — no se emite warning sobre ellos.
  let inHelperRule = false
  // Pila de contextos (reglas y at-rules): al entrar en una at-rule como
  // @font-face/@page se resetean selector y helper (antes arrastraban los de
  // la regla anterior) y al salir se restaura el contexto exterior.
  interface Ctx { selector: string; helper: boolean; atrule: string | null }
  const ctxStack: Ctx[] = []
  const restoreCtx = () => {
    const top = ctxStack[ctxStack.length - 1]
    currentSelector = top?.selector ?? ""
    inHelperRule = top?.helper ?? false
  }

  csstree.walk(ast, {
    enter(node: import("css-tree").CssNode) {
      // Track at-rule context (@font-face, @page, @property, @media…)
      if (node.type === "Atrule" && node.block) {
        const prelude = node.prelude ? csstree.generate(node.prelude) : ""
        ctxStack.push({
          selector: `@${node.name}${prelude ? ` ${prelude}` : ""}`,
          helper: false,
          atrule: node.name.toLowerCase(),
        })
        restoreCtx()
      }

      // Track current selector for context
      if (node.type === "Rule" && node.prelude) {
        ctxStack.push({
          selector: csstree.generate(node.prelude),
          helper: isHelperImportantRule(node.prelude),
          atrule: null,
        })
        restoreCtx()

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

        // Skip at-rule descriptors (@font-face src, @property syntax, @page size…)
        const innerAtrule = ctxStack[ctxStack.length - 1]?.atrule
        if (innerAtrule && AT_RULE_DESCRIPTORS[innerAtrule]?.has(property.toLowerCase())) return

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

        // !important warning (excluye helpers .p-0\!, .mb-0\!, etc.)
        if (node.important && !inHelperRule) {
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
      if ((node.type === "Atrule" && node.block) || (node.type === "Rule" && node.prelude)) {
        ctxStack.pop()
        restoreCtx()
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
            if (prev.value === value) {
              // Duplicado redundante: el segundo es código muerto.
              warnings.push({
                line,
                message: `Propiedad "${prop}" duplicada con el mismo valor en la misma regla (linea ${prev.line})`,
                context: `${selector} { ${prop}: ${value} }`,
                type: "duplicate-property",
              })
            } else if (VENDOR_VALUE_RE.test(prev.value)) {
              // Fallback intencional: el valor anterior usa una función/keyword
              // con prefijo vendor (`background:-webkit-linear-gradient(…)` y
              // luego `background:linear-gradient(…)`, `display:-webkit-box;
              // display:flex`). No se avisa.
            } else {
              // Sobrescritura: misma propiedad con valor distinto en la misma
              // regla. El segundo valor gana; suele ser un error.
              warnings.push({
                line,
                message: `Propiedad "${prop}" sobrescrita en la misma regla (linea ${prev.line}): gana "${value}" sobre "${prev.value}"`,
                context: `${selector} { ${prop}: ${prev.value} → ${value} }`,
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
 * Get the source line for context display (recibe las líneas ya partidas).
 */
function getLineContext(lines: string[], line: number): string {
  if (line <= 0) return ""
  if (line > lines.length) return ""
  return lines[line - 1]?.trim().slice(0, 120) || ""
}
