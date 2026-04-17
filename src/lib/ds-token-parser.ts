import type { DsTokenSet } from "@/types/design-system"
import { parseCss, csstree } from "./css-parser"

export function parseDsTokens(content: string, fileName: string): DsTokenSet {
  if (fileName.endsWith(".json")) {
    return parseJsonTokens(content)
  }
  return parseCssVarTokens(content)
}

function parseJsonTokens(content: string): DsTokenSet {
  const data = JSON.parse(content)
  const tokens: DsTokenSet = { colors: [], fontSizes: [], spacing: [], zIndex: [], varNames: {} }

  function extractValues(obj: Record<string, unknown>, category?: string, path: string[] = []): void {
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        const inferredCategory = inferCategory(key) ?? category
        extractValues(value as Record<string, unknown>, inferredCategory, [...path, key])
      } else if (typeof value === "string" || typeof value === "number") {
        const cat = inferCategory(key) ?? category
        const val = String(value).toLowerCase()
        const varName = [...path, key].join(".")
        switch (cat) {
          case "color":
            tokens.colors.push(val)
            tokens.varNames[val] = varName
            break
          case "fontSize":
            tokens.fontSizes.push(val)
            tokens.varNames[val] = varName
            break
          case "spacing":
            tokens.spacing.push(val)
            tokens.varNames[val] = varName
            break
          case "zIndex":
            tokens.zIndex.push(Number(value))
            tokens.varNames[val] = varName
            break
        }
      }
    }
  }

  extractValues(data)
  return tokens
}

function parseCssVarTokens(content: string): DsTokenSet {
  const tokens: DsTokenSet = { colors: [], fontSizes: [], spacing: [], zIndex: [], varNames: {} }

  function addToken(cat: string, varName: string, value: string) {
    switch (cat) {
      case "color":
        tokens.colors.push(value)
        tokens.varNames[value] = varName
        break
      case "fontSize":
        tokens.fontSizes.push(value)
        tokens.varNames[value] = varName
        break
      case "spacing":
        tokens.spacing.push(value)
        tokens.varNames[value] = varName
        break
      case "zIndex":
        tokens.zIndex.push(Number(value))
        tokens.varNames[value] = varName
        break
    }
  }

  try {
    const ast = parseCss(content)
    csstree.walk(ast, {
      enter(node: import("css-tree").CssNode) {
        if (node.type === "Declaration" && node.property.startsWith("--")) {
          const name = node.property.toLowerCase()
          const value = csstree.generate(node.value).trim().toLowerCase()
          const cat = inferCategory(name)
          if (cat) addToken(cat, node.property, value)
        }
      },
    })
  } catch {
    const varRegex = /--([\w-]+)\s*:\s*([^;]+)/g
    let match
    while ((match = varRegex.exec(content)) !== null) {
      const name = match[1].toLowerCase()
      const value = match[2].trim().toLowerCase()
      const cat = inferCategory(name)
      if (cat) addToken(cat, `--${match[1]}`, value)
    }
  }

  return tokens
}

function inferCategory(key: string): "color" | "fontSize" | "spacing" | "zIndex" | null {
  const k = key.toLowerCase()
  if (/color|bg|background|text-color|border-color|fill|stroke|accent|brand|palette/.test(k)) return "color"
  if (/colors?$/.test(k)) return "color"
  if (/font.?size|text.?size|typography|type.?scale/.test(k)) return "fontSize"
  if (/fontsize/.test(k)) return "fontSize"
  if (/space|spacing|gap|margin|padding|gutter|inset/.test(k)) return "spacing"
  if (/z.?index|z-index|layer|elevation/.test(k)) return "zIndex"
  return null
}
