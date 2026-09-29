import type { CssNode } from "css-tree"
import { csstree } from "../css-parser"
import type {
  AngularEncapsulationBreakdown,
  AngularEncapsulationLocation,
} from "@/types/analysis"

export interface AngularEncapsulationResults {
  count: number
  breakdown: AngularEncapsulationBreakdown
  locations: AngularEncapsulationLocation[]
}

/**
 * Detect Angular ViewEncapsulation leftovers in a CSS:
 *  - :host                  (PseudoClassSelector)
 *  - :host-context(...)     (PseudoClassSelector)
 *  - ::ng-deep              (PseudoElementSelector)
 *  - /deep/ and >>>         (legacy combinators — non-standard, parsed via regex
 *                            because css-tree may not represent them as nodes)
 *
 * These selectors only have meaning inside an Angular component's scoped styles
 * and don't belong in a plain global CSS. Each occurrence is reported as a
 * separate location so the UI can list them.
 */
export function extractAngularEncapsulation(
  ast: CssNode,
  raw: string,
): AngularEncapsulationResults {
  const locations: AngularEncapsulationLocation[] = []
  const breakdown: AngularEncapsulationBreakdown = {
    host: 0,
    hostContext: 0,
    ngDeep: 0,
    deepCombinator: 0,
  }

  // Pass 1: walk the AST for :host / :host-context / ::ng-deep
  csstree.walk(ast, {
    enter(node: CssNode) {
      if (node.type === "PseudoClassSelector") {
        if (node.name === "host") {
          breakdown.host++
          locations.push({
            line: node.loc?.start?.line ?? 0,
            column: node.loc?.start?.column ?? 0,
            selector: serializeSelectorSafely(node, ":host"),
            kind: "host",
          })
        } else if (node.name === "host-context") {
          breakdown.hostContext++
          locations.push({
            line: node.loc?.start?.line ?? 0,
            column: node.loc?.start?.column ?? 0,
            selector: serializeSelectorSafely(node, ":host-context"),
            kind: "host-context",
          })
        }
      } else if (node.type === "PseudoElementSelector") {
        if (node.name === "ng-deep") {
          breakdown.ngDeep++
          locations.push({
            line: node.loc?.start?.line ?? 0,
            column: node.loc?.start?.column ?? 0,
            selector: serializeSelectorSafely(node, "::ng-deep"),
            kind: "ng-deep",
          })
        }
      }
    },
  })

  // Pass 2: regex over the raw CSS for the legacy combinators (/deep/ and >>>),
  // which css-tree may either reject or silently drop. Comments, strings and
  // url(...) are blanked first so `url(/deep/a.png)` or `content: ">>>"` don't
  // count as false positives.
  const cleaned = blankNonSelectorText(raw)
  const deepRegex = /\/deep\/|>>>/g
  let match: RegExpExecArray | null
  // Line/column tracked incrementally (matches arrive in order) instead of
  // re-splitting the whole prefix on every match.
  let line = 1
  let lineStart = 0
  let scanned = 0
  while ((match = deepRegex.exec(cleaned)) !== null) {
    const idx = match.index
    for (let i = scanned; i < idx; i++) {
      if (cleaned.charCodeAt(i) === 10) {
        line++
        lineStart = i + 1
      }
    }
    scanned = idx
    const column = idx - lineStart
    breakdown.deepCombinator++
    locations.push({
      line,
      column,
      selector: match[0],
      kind: "deep-combinator",
    })
  }

  // Sort locations by line number for stable presentation
  locations.sort((a, b) => a.line - b.line || a.column - b.column)

  const count =
    breakdown.host +
    breakdown.hostContext +
    breakdown.ngDeep +
    breakdown.deepCombinator

  return { count, breakdown, locations }
}

function serializeSelectorSafely(node: CssNode, fallback: string): string {
  try {
    return csstree.generate(node)
  } catch {
    return fallback
  }
}

/**
 * Replace block comments, quoted strings and url(...) with whitespace of the
 * same length, preserving offsets so line/column math still matches the
 * original source.
 */
function blankNonSelectorText(css: string): string {
  return css.replace(
    /\/\*[\s\S]*?\*\/|"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|url\([^)]*\)/gi,
    (m) => m.replace(/[^\n]/g, " "),
  )
}
