/**
 * Genera src/lib/analyzer/hg5-importants.generated.ts con el set de huellas de
 * todas las declaraciones `!important` presentes en el CSS de HolyGrail/HG5
 * bundleado (public/hg5/output.css + public/hg5/themes/*.css).
 *
 * El analizador usa ese set para NO contabilizar los `!important` que vienen de
 * HG5 (coincidencia exacta selector+propiedad+valor).
 *
 * Uso: npx tsx scripts/gen-hg5-importants.ts
 * Se ejecuta también tras `npm run update-hg5`.
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import * as csstree from "css-tree"
import { makeImportantFingerprint } from "../src/lib/analyzer/important-fingerprint.ts"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")

function hg5Files(): string[] {
  const files: string[] = []
  const output = resolve(root, "public/hg5/output.css")
  if (existsSync(output)) files.push(output)
  const themesDir = resolve(root, "public/hg5/themes")
  if (existsSync(themesDir)) {
    for (const f of readdirSync(themesDir)) {
      if (f.endsWith(".css")) files.push(resolve(themesDir, f))
    }
  }
  return files
}

function extractFingerprints(css: string, set: Set<string>): void {
  const ast = csstree.parse(css)
  let currentSelector = ""
  csstree.walk(ast, {
    enter(node) {
      if (node.type === "Rule" && node.prelude) {
        currentSelector = csstree.generate(node.prelude)
      }
      if (node.type === "Declaration" && node.important) {
        const value = csstree.generate(node.value)
        set.add(makeImportantFingerprint(currentSelector, node.property, value))
      }
    },
  })
}

const set = new Set<string>()
const files = hg5Files()
for (const file of files) {
  extractFingerprints(readFileSync(file, "utf8"), set)
}

const sorted = [...set].sort()
const out = `// AUTO-GENERADO por scripts/gen-hg5-importants.ts — NO editar a mano.
// Huellas de las declaraciones !important presentes en el CSS de HG5.
// Regenerar con: npx tsx scripts/gen-hg5-importants.ts (o npm run update-hg5).
export const HG5_IMPORTANT_FINGERPRINTS: string[] = ${JSON.stringify(sorted, null, 2)}
`

const target = resolve(root, "src/lib/analyzer/hg5-importants.generated.ts")
writeFileSync(target, out, "utf8")
console.log(`Generadas ${sorted.length} huellas !important de HG5 desde ${files.length} archivo(s) → ${target}`)
