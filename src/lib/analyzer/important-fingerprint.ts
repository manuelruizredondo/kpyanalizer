/**
 * Huella (fingerprint) de una declaración `!important`, usada para excluir del
 * conteo los `!important` que provienen literalmente de HolyGrail/HG5.
 *
 * Formato: `selector|||propiedad|||valor`, todo normalizado (whitespace
 * colapsado, minúsculas) para que la MISMA regla produzca la MISMA huella tanto
 * al generar el set de referencia de HG5 como al analizar el CSS del usuario.
 *
 * Este módulo NO importa nada generado a propósito: lo usan tanto el analizador
 * como el script generador `scripts/gen-hg5-importants.ts`.
 */
export function makeImportantFingerprint(selector: string, property: string, value: string): string {
  const s = selector.replace(/\s+/g, " ").trim().toLowerCase()
  const p = property.replace(/\s+/g, " ").trim().toLowerCase()
  const v = value.replace(/\s+/g, " ").trim().toLowerCase()
  return `${s}|||${p}|||${v}`
}
