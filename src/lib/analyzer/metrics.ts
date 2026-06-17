import type { CssNode } from "css-tree"
import { csstree } from "../css-parser"
import { isHelperImportantRule } from "./helpers"
import { isHg5Important } from "./hg5-importants"

export interface BasicMetrics {
  classCount: number
  idCount: number
  importantCount: number
  variableCount: number
  totalSelectors: number
  totalDeclarations: number
  universalSelectorCount: number
  attributeSelectorCount: number
  pseudoClassCount: number
  pseudoElementCount: number
  vendorPrefixCount: number
  shorthandCount: number
  longhandCount: number
}

const SHORTHAND_PROPERTIES = new Set([
  'margin', 'padding', 'background', 'border', 'font', 'flex', 'grid', 'gap',
  'overflow', 'transition', 'animation', 'outline', 'list-style', 'text-decoration',
  'place-items', 'place-content', 'place-self', 'inset'
])

function isVendorPrefixed(property: string): boolean {
  return property.startsWith('-webkit-') || property.startsWith('-moz-') ||
         property.startsWith('-ms-') || property.startsWith('-o-')
}

function isShorthandProperty(property: string): boolean {
  return SHORTHAND_PROPERTIES.has(property)
}

function isLonghandProperty(property: string): boolean {
  for (const shorthand of SHORTHAND_PROPERTIES) {
    if (property.startsWith(shorthand + '-')) {
      return true
    }
  }
  return false
}

export function extractBasicMetrics(ast: CssNode): BasicMetrics {
  let classCount = 0
  let idCount = 0
  let importantCount = 0
  const variableNames = new Set<string>()
  let totalSelectors = 0
  let totalDeclarations = 0
  let universalSelectorCount = 0
  let attributeSelectorCount = 0
  let pseudoClassCount = 0
  let pseudoElementCount = 0
  let vendorPrefixCount = 0
  let shorthandCount = 0
  let longhandCount = 0
  // Pista para saber si la declaración actual vive dentro de una regla
  // helper (.p-0\!, .mb-0\!, etc.) cuyos !important son intencionales y no
  // deben contabilizar como abuso de especificidad.
  let inHelperRule = false
  // Selector actual, necesario para identificar (por coincidencia exacta) los
  // !important que provienen de HolyGrail/HG5 y excluirlos del conteo.
  let currentSelector = ""
  // Profundidad dentro de argumentos de pseudo-clases funcionales
  // (:not, :is, :where, :has). Sus `Selector` internos no son reglas reales
  // y no deben inflar totalSelectors (denominador de varias penalizaciones).
  let pseudoArgDepth = 0
  const FUNCTIONAL_PSEUDOS = new Set(["not", "is", "where", "has"])

  csstree.walk(ast, {
    enter(node: import("css-tree").CssNode) {
      if (node.type === "Rule") {
        inHelperRule = isHelperImportantRule(node.prelude)
        currentSelector = node.prelude ? csstree.generate(node.prelude) : ""
      }
      if (node.type === "PseudoClassSelector" && FUNCTIONAL_PSEUDOS.has(node.name.toLowerCase())) {
        pseudoArgDepth++
      }
      switch (node.type) {
        case "ClassSelector":
          classCount++
          break
        case "IdSelector":
          idCount++
          break
        case "TypeSelector":
          if (node.name === "*") {
            universalSelectorCount++
          }
          break
        case "AttributeSelector":
          attributeSelectorCount++
          break
        case "PseudoClassSelector":
          // Angular ViewEncapsulation pseudos are tracked separately so they
          // don't double-count against generic pseudo-class hygiene.
          if (node.name !== "host" && node.name !== "host-context") {
            pseudoClassCount++
          }
          break
        case "PseudoElementSelector":
          if (node.name !== "ng-deep") {
            pseudoElementCount++
          }
          break
        case "Declaration":
          totalDeclarations++
          if (
            node.important &&
            !inHelperRule &&
            !isHg5Important(currentSelector, node.property, csstree.generate(node.value))
          ) {
            importantCount++
          }
          if (node.property.startsWith("--")) {
            variableNames.add(node.property)
          }
          if (isVendorPrefixed(node.property)) {
            vendorPrefixCount++
          }
          if (isShorthandProperty(node.property)) {
            shorthandCount++
          } else if (isLonghandProperty(node.property)) {
            longhandCount++
          }
          break
        case "Selector":
          if (pseudoArgDepth === 0) {
            totalSelectors++
          }
          break
      }
    },
    leave(node: import("css-tree").CssNode) {
      if (node.type === "PseudoClassSelector" && FUNCTIONAL_PSEUDOS.has(node.name.toLowerCase())) {
        pseudoArgDepth--
      }
    },
  })

  return {
    classCount,
    idCount,
    importantCount,
    variableCount: variableNames.size,
    totalSelectors,
    totalDeclarations,
    universalSelectorCount,
    attributeSelectorCount,
    pseudoClassCount,
    pseudoElementCount,
    vendorPrefixCount,
    shorthandCount,
    longhandCount,
  }
}
