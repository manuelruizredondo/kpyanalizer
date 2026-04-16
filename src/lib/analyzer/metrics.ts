import type { CssNode } from "css-tree"
import { csstree } from "../css-parser"

export interface BasicMetrics {
  classCount: number
  idCount: number
  importantCount: number
  variableCount: number
  totalSelectors: number
  totalDeclarations: number
}

export function extractBasicMetrics(ast: CssNode): BasicMetrics {
  let classCount = 0
  let idCount = 0
  let importantCount = 0
  const variableNames = new Set<string>()
  let totalSelectors = 0
  let totalDeclarations = 0

  csstree.walk(ast, {
    enter(node: import("css-tree").CssNode) {
      switch (node.type) {
        case "ClassSelector":
          classCount++
          break
        case "IdSelector":
          idCount++
          break
        case "Declaration":
          totalDeclarations++
          if (node.important) {
            importantCount++
          }
          if (node.property.startsWith("--")) {
            variableNames.add(node.property)
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
  }
}
