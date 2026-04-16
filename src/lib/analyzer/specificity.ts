import type { CssNode } from "css-tree"
import { csstree } from "../css-parser"
import type { SpecificityEntry } from "@/types/analysis"

function computeSpecificity(selectorNode: CssNode): [number, number, number] {
  let a = 0 // IDs
  let b = 0 // Classes, attributes, pseudo-classes
  let c = 0 // Types, pseudo-elements

  csstree.walk(selectorNode, {
    enter(node: import("css-tree").CssNode) {
      switch (node.type) {
        case "IdSelector":
          a++
          break
        case "ClassSelector":
        case "AttributeSelector":
          b++
          break
        case "PseudoClassSelector":
          if (node.name !== "not" && node.name !== "is" && node.name !== "where" && node.name !== "has") {
            b++
          }
          break
        case "TypeSelector":
          if (node.name !== "*") {
            c++
          }
          break
        case "PseudoElementSelector":
          c++
          break
      }
    },
  })

  return [a, b, c]
}

export function extractSpecificity(ast: CssNode): SpecificityEntry[] {
  const entries: SpecificityEntry[] = []

  csstree.walk(ast, {
    enter(node: import("css-tree").CssNode) {
      if (node.type === "Selector") {
        const selectorText = csstree.generate(node)
        const specificity = computeSpecificity(node)
        entries.push({
          selector: selectorText,
          specificity,
          line: node.loc?.start?.line ?? 0,
        })
      }
    },
  })

  return entries
}
