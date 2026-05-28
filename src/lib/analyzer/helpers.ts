import type { CssNode } from "css-tree"
import { csstree } from "../css-parser"

/**
 * Detecta si una regla CSS corresponde a un helper utility con !important
 * intencional (estilo Tailwind/Bootstrap), p. ej. `.p-0\!`, `.mb-0\!`,
 * `.md\:hidden\!`, `.hover\:text-center\!`, etc.
 *
 * Estas clases acaban en `!` (escapado como `\!` en el CSS fuente) para
 * indicar que la utility aplica `!important` de forma deliberada. Por tanto,
 * sus declaraciones `!important` no deben contabilizarse como un problema
 * de especificidad ni como warning de calidad.
 *
 * Criterio: la regla se considera helper si alguno de sus selectores de
 * clase termina con el carácter `!` (con o sin el backslash de escape).
 */
export function isHelperImportantRule(prelude: CssNode | null | undefined): boolean {
  if (!prelude) return false
  let isHelper = false
  csstree.walk(prelude, {
    enter(node: CssNode) {
      if (isHelper) return
      if (node.type === "ClassSelector") {
        // El AST de css-tree conserva el backslash: name === "p-0\\!" → ends with "!".
        // Comprobamos solo el carácter final para cubrir ambas representaciones.
        if (node.name.endsWith("!")) {
          isHelper = true
        }
      }
    },
  })
  return isHelper
}
