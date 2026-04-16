import type { CssNode } from "css-tree"
import { csstree } from "../css-parser"

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

  csstree.walk(ast, {
    enter(node: import("css-tree").CssNode) {
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
          pseudoClassCount++
          break
        case "PseudoElementSelector":
          pseudoElementCount++
          break
        case "Declaration":
          totalDeclarations++
          if (node.important) {
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
          totalSelectors++
          break
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
