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

export interface SpecificityStats {
  max: [number, number, number]
  avg: number
  distribution: SpecificityEntry[]
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

export function computeSpecificityStats(entries: SpecificityEntry[]): SpecificityStats {
  if (entries.length === 0) {
    return {
      max: [0, 0, 0],
      avg: 0,
      distribution: entries,
    }
  }

  // Find max specificity
  let max: [number, number, number] = [0, 0, 0]
  let totalWeightedSum = 0

  for (const entry of entries) {
    const [a, b, c] = entry.specificity

    // Compare tuples: a*100 + b*10 + c
    const currentWeight = a * 100 + b * 10 + c
    const maxWeight = max[0] * 100 + max[1] * 10 + max[2]

    if (currentWeight > maxWeight) {
      max = [a, b, c]
    }

    totalWeightedSum += currentWeight
  }

  const avg = entries.length > 0 ? Math.round(totalWeightedSum / entries.length) : 0

  return {
    max,
    avg,
    distribution: entries,
  }
}
