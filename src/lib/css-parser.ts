import * as csstree from "css-tree"

export function parseCss(css: string) {
  return csstree.parse(css, {
    positions: true,
    parseAtrulePrelude: true,
    parseRulePrelude: true,
    parseValue: true,
    parseCustomProperty: true,
  })
}

export { csstree }
