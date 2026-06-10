import type { CssNode } from "css-tree"
import { csstree } from "../css-parser"
import type { SpecificityEntry } from "@/types/analysis"

const FUNCTIONAL_PSEUDOS = new Set(["not", "is", "where", "has"])

/**
 * Acumula la especificidad de un nodo de selector de forma recursiva,
 * respetando la semántica de los pseudo-class funcionales:
 *  - :where(...) NO aporta especificidad (sus argumentos cuentan como 0).
 *  - :not()/:is()/:has() aportan la especificidad de sus argumentos.
 *  - el resto de pseudo-clases cuentan como una clase (columna b).
 */
function accumulate(node: CssNode, acc: [number, number, number], inWhere: boolean): void {
  switch (node.type) {
    case "IdSelector":
      if (!inWhere) acc[0]++
      return
    case "ClassSelector":
    case "AttributeSelector":
      if (!inWhere) acc[1]++
      return
    case "PseudoElementSelector":
      if (!inWhere) acc[2]++
      return
    case "TypeSelector":
      if (node.name !== "*" && !inWhere) acc[2]++
      return
    case "PseudoClassSelector": {
      const name = (node.name || "").toLowerCase()
      if (FUNCTIONAL_PSEUDOS.has(name)) {
        // Descendemos en los argumentos; :where() los neutraliza.
        const childWhere = inWhere || name === "where"
        if ("children" in node && node.children) {
          ;(node.children as { forEach: (cb: (c: CssNode) => void) => void }).forEach(c =>
            accumulate(c, acc, childWhere)
          )
        }
      } else if (!inWhere) {
        acc[1]++
      }
      return
    }
  }

  // Contenedores (Selector, SelectorList, etc.): seguimos descendiendo.
  if ("children" in node && node.children) {
    ;(node.children as { forEach: (cb: (c: CssNode) => void) => void }).forEach(c =>
      accumulate(c, acc, inWhere)
    )
  }
}

function computeSpecificity(selectorNode: CssNode): [number, number, number] {
  const acc: [number, number, number] = [0, 0, 0]
  accumulate(selectorNode, acc, false)
  return acc
}

export interface SpecificityStats {
  max: [number, number, number]
  avg: number
  distribution: SpecificityEntry[]
}

export function extractSpecificity(ast: CssNode): SpecificityEntry[] {
  const entries: SpecificityEntry[] = []
  // Profundidad dentro de argumentos de pseudo-clases funcionales
  // (:not, :is, :where, :has). css-tree emite un nodo `Selector` por cada
  // argumento; esos NO son reglas reales y no deben contarse como selectores
  // de nivel superior (inflaría totalSelectors y la distribución).
  let pseudoArgDepth = 0

  csstree.walk(ast, {
    enter(node: import("css-tree").CssNode) {
      if (node.type === "PseudoClassSelector" && FUNCTIONAL_PSEUDOS.has((node.name || "").toLowerCase())) {
        pseudoArgDepth++
        return
      }
      if (node.type === "Selector" && pseudoArgDepth === 0) {
        entries.push({
          selector: csstree.generate(node),
          specificity: computeSpecificity(node),
          line: node.loc?.start?.line ?? 0,
        })
      }
    },
    leave(node: import("css-tree").CssNode) {
      if (node.type === "PseudoClassSelector" && FUNCTIONAL_PSEUDOS.has((node.name || "").toLowerCase())) {
        pseudoArgDepth--
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
