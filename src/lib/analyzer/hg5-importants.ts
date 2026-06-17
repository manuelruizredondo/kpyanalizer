import { makeImportantFingerprint } from "./important-fingerprint"
import { HG5_IMPORTANT_FINGERPRINTS } from "./hg5-importants.generated"

const HG5_SET = new Set(HG5_IMPORTANT_FINGERPRINTS)

/**
 * ¿Esta declaración `!important` proviene literalmente de HolyGrail/HG5?
 * Coincidencia exacta por selector + propiedad + valor contra el CSS de HG5
 * bundleado. Si lo es, NO debe contabilizarse como un `!important` del usuario.
 */
export function isHg5Important(selector: string, property: string, value: string): boolean {
  return HG5_SET.has(makeImportantFingerprint(selector, property, value))
}
