import type { CssNode } from "css-tree"
import { csstree } from "../css-parser"
import type { DuplicateGroup, MediaQueryInfo, KeyframeInfo } from "@/types/analysis"

export interface DuplicateResults {
  duplicateSelectors: DuplicateGroup[]
  duplicateDeclarations: DuplicateGroup[]
  mediaQueries: MediaQueryInfo[]
  keyframes: KeyframeInfo[]
  uniqueDeclarations: number
  deepestNesting: number
}

// Selectors to exclude from duplicate detection (common structural selectors)
const IGNORED_SELECTORS = new Set([':root', '*', 'html', 'body'])

function calculateMaxNestingDepth(node: CssNode, depth: number = 0): number {
  let maxDepth = depth

  const child = node.children?.head
  if (child) {
    let current: any = child
    while (current) {
      if (current.data.type === "Rule" || current.data.type === "Atrule") {
        const childDepth = calculateMaxNestingDepth(current.data, depth + 1)
        maxDepth = Math.max(maxDepth, childDepth)
      }
      current = current.next
    }
  }

  return maxDepth
}

export function extractDuplicates(ast: CssNode): DuplicateResults {
  const selectorMap = new Map<string, { line: number; column: number; selector: string }[]>()
  const declarationMap = new Map<string, { line: number; column: number; selector: string; property: string }[]>()
  const mediaMap = new Map<string, { line: number }[]>()
  const keyframeList: KeyframeInfo[] = []
  const uniqueDecls = new Set<string>()

  let currentSelector = ""
  let insideKeyframes = false
  let deepestNesting = 0

  csstree.walk(ast, {
    enter(node: import("css-tree").CssNode) {
      // Track nesting depth for @media and @supports rules
      if ((node.type === "Atrule" || node.type === "Rule") && node.children) {
        const depth = calculateMaxNestingDepth(node)
        deepestNesting = Math.max(deepestNesting, depth)
      }

      // Track when we enter a @keyframes block
      if (node.type === "Atrule") {
        const name = node.name.toLowerCase()
        if (name === "keyframes" || name === "-webkit-keyframes") {
          insideKeyframes = true
        }
      }

      if (node.type === "Rule" && node.prelude) {
        currentSelector = csstree.generate(node.prelude)

        // Skip keyframe stops (to, from, 0%, 50%, 100%, etc.) and ignored selectors
        if (!insideKeyframes && !IGNORED_SELECTORS.has(currentSelector)) {
          const line = node.loc?.start?.line ?? 0
          const column = node.loc?.start?.column ?? 0

          const existing = selectorMap.get(currentSelector)
          if (existing) {
            existing.push({ line, column, selector: currentSelector })
          } else {
            selectorMap.set(currentSelector, [{ line, column, selector: currentSelector }])
          }
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
    leave(node: import("css-tree").CssNode) {
      // Reset flag when leaving a @keyframes block
      if (node.type === "Atrule") {
        const name = node.name.toLowerCase()
        if (name === "keyframes" || name === "-webkit-keyframes") {
          insideKeyframes = false
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
    deepestNesting,
  }
}
