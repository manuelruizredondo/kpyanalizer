import type { CssNode } from "css-tree"
import { csstree } from "../css-parser"
import type { DuplicateGroup, MediaQueryInfo, KeyframeInfo } from "@/types/analysis"

export interface DuplicateResults {
  duplicateSelectors: DuplicateGroup[]
  duplicateDeclarations: DuplicateGroup[]
  mediaQueries: MediaQueryInfo[]
  keyframes: KeyframeInfo[]
  uniqueDeclarations: number
}

export function extractDuplicates(ast: CssNode): DuplicateResults {
  const selectorMap = new Map<string, { line: number; column: number; selector: string }[]>()
  const declarationMap = new Map<string, { line: number; column: number; selector: string; property: string }[]>()
  const mediaMap = new Map<string, { line: number }[]>()
  const keyframeList: KeyframeInfo[] = []
  const uniqueDecls = new Set<string>()

  let currentSelector = ""

  csstree.walk(ast, {
    enter(node: import("css-tree").CssNode) {
      if (node.type === "Rule" && node.prelude) {
        currentSelector = csstree.generate(node.prelude)
        const line = node.loc?.start?.line ?? 0
        const column = node.loc?.start?.column ?? 0

        const existing = selectorMap.get(currentSelector)
        if (existing) {
          existing.push({ line, column, selector: currentSelector })
        } else {
          selectorMap.set(currentSelector, [{ line, column, selector: currentSelector }])
        }
      }

      if (node.type === "Declaration") {
        const key = `${node.property}: ${csstree.generate(node.value)}`
        uniqueDecls.add(key)
        const line = node.loc?.start?.line ?? 0
        const column = node.loc?.start?.column ?? 0

        const existing = declarationMap.get(key)
        if (existing) {
          existing.push({ line, column, selector: currentSelector, property: node.property })
        } else {
          declarationMap.set(key, [{ line, column, selector: currentSelector, property: node.property }])
        }
      }

      if (node.type === "Atrule") {
        const name = node.name.toLowerCase()
        if (name === "media" && node.prelude) {
          const query = csstree.generate(node.prelude)
          const line = node.loc?.start?.line ?? 0
          const existing = mediaMap.get(query)
          if (existing) {
            existing.push({ line })
          } else {
            mediaMap.set(query, [{ line }])
          }
        }
        if (name === "keyframes" || name === "-webkit-keyframes") {
          const kfName = node.prelude ? csstree.generate(node.prelude) : "unknown"
          keyframeList.push({
            name: kfName,
            line: node.loc?.start?.line ?? 0,
          })
        }
      }
    },
  })

  const duplicateSelectors: DuplicateGroup[] = []
  for (const [key, occurrences] of selectorMap) {
    if (occurrences.length > 1) {
      duplicateSelectors.push({
        key,
        occurrences: occurrences.map(o => ({
          line: o.line,
          column: o.column,
          selector: o.selector,
          property: "",
          rule: key,
        })),
      })
    }
  }

  const duplicateDeclarations: DuplicateGroup[] = []
  for (const [key, occurrences] of declarationMap) {
    if (occurrences.length > 1) {
      duplicateDeclarations.push({
        key,
        occurrences: occurrences.map(o => ({
          line: o.line,
          column: o.column,
          selector: o.selector,
          property: o.property,
          rule: key,
        })),
      })
    }
  }

  const mediaQueries: MediaQueryInfo[] = Array.from(mediaMap.entries()).map(([query, locs]) => ({
    query,
    count: locs.length,
    locations: locs,
  }))

  return {
    duplicateSelectors: duplicateSelectors.sort((a, b) => b.occurrences.length - a.occurrences.length),
    duplicateDeclarations: duplicateDeclarations.sort((a, b) => b.occurrences.length - a.occurrences.length),
    mediaQueries: mediaQueries.sort((a, b) => b.count - a.count),
    keyframes: keyframeList,
    uniqueDeclarations: uniqueDecls.size,
  }
}
