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
  const tokens: DsTokenSet = { colors: [], fontSizes: [], spacing: [], zIndex: [] }

  function extractValues(obj: Record<string, unknown>, category?: string): void {
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        const inferredCategory = inferCategory(key) ?? category
        extractValues(value as Record<string, unknown>, inferredCategory)
      } else if (typeof value === "string" || typeof value === "number") {
        const cat = inferCategory(key) ?? category
        const val = String(value)
        switch (cat) {
          case "color":
            tokens.colors.push(val.toLowerCase())
            break
          case "fontSize":
            tokens.fontSizes.push(val.toLowerCase())
            break
          case "spacing":
            tokens.spacing.push(val.toLowerCase())
            break
          case "zIndex":
            tokens.zIndex.push(Number(value))
            break
        }
      }
    }
  }

  extractValues(data)
  return tokens
}

function parseCssVarTokens(content: string): DsTokenSet {
  const tokens: DsTokenSet = { colors: [], fontSizes: [], spacing: [], zIndex: [] }

  try {
    const ast = parseCss(content)
    csstree.walk(ast, {
      enter(node: import("css-tree").CssNode) {
        if (node.type === "Declaration" && node.property.startsWith("--")) {
          const name = node.property.toLowerCase()
          const value = csstree.generate(node.value).trim().toLowerCase()
          const cat = inferCategory(name)
          switch (cat) {
            case "color":
              tokens.colors.push(value)
              break
            case "fontSize":
              tokens.fontSizes.push(value)
              break
            case "spacing":
              tokens.spacing.push(value)
              break
            case "zIndex":
              tokens.zIndex.push(Number(value))
              break
          }
        }
      },
    })
  } catch {
    // If parsing fails, try simple regex
    const varRegex = /--([\w-]+)\s*:\s*([^;]+)/g
    let match
    while ((match = varRegex.exec(content)) !== null) {
      const name = match[1].toLowerCase()
      const value = match[2].trim().toLowerCase()
      const cat = inferCategory(name)
      switch (cat) {
        case "color":
          tokens.colors.push(value)
          break
        case "fontSize":
          tokens.fontSizes.push(value)
          break
        case "spacing":
          tokens.spacing.push(value)
          break
        case "zIndex":
          tokens.zIndex.push(Number(value))
          break
      }
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
