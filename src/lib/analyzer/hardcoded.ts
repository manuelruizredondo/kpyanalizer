import type { CssNode } from "css-tree"
import { csstree } from "../css-parser"
import type { HardcodedValue, LocationReference } from "@/types/analysis"

const CSS_NAMED_COLORS = new Set([
  "aliceblue","antiquewhite","aqua","aquamarine","azure","beige","bisque","black",
  "blanchedalmond","blue","blueviolet","brown","burlywood","cadetblue","chartreuse",
  "chocolate","coral","cornflowerblue","cornsilk","crimson","cyan","darkblue",
  "darkcyan","darkgoldenrod","darkgray","darkgreen","darkgrey","darkkhaki",
  "darkmagenta","darkolivegreen","darkorange","darkorchid","darkred","darksalmon",
  "darkseagreen","darkslateblue","darkslategray","darkslategrey","darkturquoise",
  "darkviolet","deeppink","deepskyblue","dimgray","dimgrey","dodgerblue","firebrick",
  "floralwhite","forestgreen","fuchsia","gainsboro","ghostwhite","gold","goldenrod",
  "gray","green","greenyellow","grey","honeydew","hotpink","indianred","indigo",
  "ivory","khaki","lavender","lavenderblush","lawngreen","lemonchiffon","lightblue",
  "lightcoral","lightcyan","lightgoldenrodyellow","lightgray","lightgreen","lightgrey",
  "lightpink","lightsalmon","lightseagreen","lightskyblue","lightslategray",
  "lightslategrey","lightsteelblue","lightyellow","lime","limegreen","linen","magenta",
  "maroon","mediumaquamarine","mediumblue","mediumorchid","mediumpurple",
  "mediumseagreen","mediumslateblue","mediumspringgreen","mediumturquoise",
  "mediumvioletred","midnightblue","mintcream","mistyrose","moccasin","navajowhite",
  "navy","oldlace","olive","olivedrab","orange","orangered","orchid","palegoldenrod",
  "palegreen","paleturquoise","palevioletred","papayawhip","peachpuff","peru","pink",
  "plum","powderblue","purple","rebeccapurple","red","rosybrown","royalblue",
  "saddlebrown","salmon","sandybrown","seagreen","seashell","sienna","silver",
  "skyblue","slateblue","slategray","slategrey","snow","springgreen","steelblue",
  "tan","teal","thistle","tomato","turquoise","violet","wheat","white","whitesmoke",
  "yellow","yellowgreen",
])

const SPACING_PROPERTIES = new Set([
  "margin","margin-top","margin-right","margin-bottom","margin-left",
  "padding","padding-top","padding-right","padding-bottom","padding-left",
  "gap","row-gap","column-gap","inset","top","right","bottom","left",
])

const COLOR_PROPERTIES = new Set([
  "color","background-color","border-color","border-top-color","border-right-color",
  "border-bottom-color","border-left-color","outline-color","text-decoration-color",
  "fill","stroke","box-shadow","text-shadow","background",
])

function makeLocation(node: CssNode, selector: string, property: string): LocationReference {
  return {
    line: node.loc?.start?.line ?? 0,
    column: node.loc?.start?.column ?? 0,
    selector,
    property,
    rule: `${property}: ${csstree.generate(node)}`,
  }
}

function normalizeColor(value: string): string {
  const v = value.toLowerCase().trim()
  if (v.startsWith("#")) {
    const hex = v.slice(1)
    if (hex.length === 3) {
      return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`
    }
    return `#${hex.padEnd(6, "0")}`
  }
  return v
}

function groupValues(items: { value: string; normalized: string; location: LocationReference }[]): HardcodedValue[] {
  const map = new Map<string, { value: string; locations: LocationReference[] }>()
  for (const item of items) {
    const existing = map.get(item.normalized)
    if (existing) {
      existing.locations.push(item.location)
    } else {
      map.set(item.normalized, { value: item.value, locations: [item.location] })
    }
  }
  return Array.from(map.entries()).map(([normalized, data]) => ({
    value: data.value,
    normalized,
    count: data.locations.length,
    locations: data.locations,
  })).sort((a, b) => b.count - a.count)
}

export interface HardcodedResults {
  colors: HardcodedValue[]
  fontSizes: HardcodedValue[]
  spacingValues: HardcodedValue[]
  zIndexValues: HardcodedValue[]
  fontWeights: HardcodedValue[]
  fontFamilies: HardcodedValue[]
  importants: LocationReference[]
}

// Normalize font-weight keywords to numeric equivalents for grouping
const FONT_WEIGHT_KEYWORDS: Record<string, string> = {
  thin: "100", hairline: "100",
  extralight: "200", "ultra-light": "200",
  light: "300",
  normal: "400", regular: "400",
  medium: "500",
  semibold: "600", "semi-bold": "600", demibold: "600",
  bold: "700",
  extrabold: "800", "ultra-bold": "800", "extra-bold": "800",
  black: "900", heavy: "900",
}

function normalizeFontWeight(val: string): string {
  const lower = val.toLowerCase().trim()
  return FONT_WEIGHT_KEYWORDS[lower] || lower
}

function normalizeFontFamily(val: string): string {
  // Remove quotes and normalize whitespace
  return val
    .replace(/["']/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
}

export function extractHardcoded(ast: CssNode): HardcodedResults {
  const rawColors: { value: string; normalized: string; location: LocationReference }[] = []
  const rawFontSizes: { value: string; normalized: string; location: LocationReference }[] = []
  const rawSpacing: { value: string; normalized: string; location: LocationReference }[] = []
  const rawZIndex: { value: string; normalized: string; location: LocationReference }[] = []
  const rawFontWeights: { value: string; normalized: string; location: LocationReference }[] = []
  const rawFontFamilies: { value: string; normalized: string; location: LocationReference }[] = []
  const importants: LocationReference[] = []

  let currentSelector = ""
  let inCustomProperty = false

  csstree.walk(ast, {
    enter(node: import("css-tree").CssNode) {
      if (node.type === "Rule" && node.prelude) {
        currentSelector = csstree.generate(node.prelude)
      }

      if (node.type === "Declaration") {
        inCustomProperty = node.property.startsWith("--")

        if (node.important) {
          importants.push({
            line: node.loc?.start?.line ?? 0,
            column: node.loc?.start?.column ?? 0,
            selector: currentSelector,
            property: node.property,
            rule: `${node.property}: ${csstree.generate(node.value)} !important`,
          })
        }

        if (inCustomProperty) return

        // z-index
        if (node.property === "z-index") {
          const val = csstree.generate(node.value).trim()
          if (/^-?\d+$/.test(val)) {
            rawZIndex.push({
              value: val,
              normalized: val,
              location: makeLocation(node, currentSelector, node.property),
            })
          }
        }

        // font-size
        if (node.property === "font-size") {
          const val = csstree.generate(node.value).trim()
          if (!val.includes("var(")) {
            rawFontSizes.push({
              value: val,
              normalized: val.toLowerCase(),
              location: makeLocation(node, currentSelector, node.property),
            })
          }
        }

        // font-weight
        if (node.property === "font-weight") {
          const val = csstree.generate(node.value).trim()
          if (!val.includes("var(") && val !== "inherit" && val !== "initial" && val !== "unset") {
            rawFontWeights.push({
              value: val,
              normalized: normalizeFontWeight(val),
              location: makeLocation(node, currentSelector, node.property),
            })
          }
        }

        // font-family
        if (node.property === "font-family") {
          const val = csstree.generate(node.value).trim()
          if (!val.includes("var(") && val !== "inherit" && val !== "initial" && val !== "unset") {
            // Split by comma to extract each family individually
            const families = val.split(",").map(f => f.trim()).filter(Boolean)
            for (const family of families) {
              rawFontFamilies.push({
                value: family.replace(/["']/g, ""),
                normalized: normalizeFontFamily(family),
                location: makeLocation(node, currentSelector, node.property),
              })
            }
          }
        }

        // spacing
        if (SPACING_PROPERTIES.has(node.property)) {
          const val = csstree.generate(node.value).trim()
          if (!val.includes("var(") && val !== "0" && val !== "auto" && val !== "inherit") {
            rawSpacing.push({
              value: val,
              normalized: val.toLowerCase(),
              location: makeLocation(node, currentSelector, node.property),
            })
          }
        }

        // colors from declarations
        if (COLOR_PROPERTIES.has(node.property)) {
          extractColorsFromValue(node.value, node, rawColors)
        }
      }
    },
  })

  return {
    colors: groupValues(rawColors),
    fontSizes: groupValues(rawFontSizes),
    spacingValues: groupValues(rawSpacing),
    zIndexValues: groupValues(rawZIndex),
    fontWeights: groupValues(rawFontWeights),
    fontFamilies: groupValues(rawFontFamilies),
    importants,
  }
}

function extractColorsFromValue(
  valueNode: CssNode,
  declNode: CssNode,
  results: { value: string; normalized: string; location: LocationReference }[]
) {
  csstree.walk(valueNode, {
    enter(node: import("css-tree").CssNode) {
      if (node.type === "Hash") {
        const hex = `#${node.value}`
        results.push({
          value: hex,
          normalized: normalizeColor(hex),
          location: makeLocation(declNode, "", (declNode as { property?: string }).property ?? ""),
        })
      }
      if (node.type === "Function") {
        const name = node.name.toLowerCase()
        if (["rgb", "rgba", "hsl", "hsla", "oklch", "oklab", "lch", "lab"].includes(name)) {
          const val = csstree.generate(node)
          results.push({
            value: val,
            normalized: val.toLowerCase().replace(/\s+/g, ""),
            location: makeLocation(declNode, "", (declNode as { property?: string }).property ?? ""),
          })
        }
      }
      if (node.type === "Identifier") {
        const name = node.name.toLowerCase()
        if (CSS_NAMED_COLORS.has(name)) {
          results.push({
            value: node.name,
            normalized: name,
            location: makeLocation(declNode, "", (declNode as { property?: string }).property ?? ""),
          })
        }
      }
    },
  })
}
