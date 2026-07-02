import type { DsTokenSet, DsCoverageResult, DsCategoryResult, DsMismatch, DsRedundant } from "@/types/design-system"
import type { HardcodedValue } from "@/types/analysis"

export function compareDsTokens(
  colors: HardcodedValue[],
  fontSizes: HardcodedValue[],
  spacingValues: HardcodedValue[],
  zIndexValues: HardcodedValue[],
  tokens: DsTokenSet
): DsCoverageResult {
  const colorsResult = compareCategory(
    colors.map(c => c.normalized),
    tokens.colors,
    colors,
    (a, b) => colorDistance(a, b)
  )

  const fontSizesResult = compareCategory(
    fontSizes.map(f => f.normalized),
    tokens.fontSizes,
    fontSizes,
    (a, b) => numericDistance(a, b)
  )

  const spacingResult = compareCategory(
    spacingValues.map(s => s.normalized),
    tokens.spacing,
    spacingValues,
    (a, b) => numericDistance(a, b)
  )

  const zIndexResult = compareCategoryNumeric(
    zIndexValues,
    tokens.zIndex
  )

  const totalUsed = colorsResult.totalUsed + fontSizesResult.totalUsed + spacingResult.totalUsed + zIndexResult.totalUsed
  const totalMatched = colorsResult.matchedToDs + fontSizesResult.matchedToDs + spacingResult.matchedToDs + zIndexResult.matchedToDs
  const overallCoverage = totalUsed > 0 ? (totalMatched / totalUsed) * 100 : 100

  return {
    colors: colorsResult,
    fontSizes: fontSizesResult,
    spacing: spacingResult,
    zIndex: zIndexResult,
    overallCoverage,
  }
}

function compareCategory(
  usedValues: string[],
  dsValues: string[],
  hardcoded: HardcodedValue[],
  distanceFn: (a: string, b: string) => number
): DsCategoryResult {
  const unique = [...new Set(usedValues)]
  const dsSet = new Set(dsValues.map(v => v.toLowerCase()))
  let matched = 0
  const mismatches: DsMismatch[] = []
  const redundant: DsRedundant[] = []

  for (const val of unique) {
    if (dsSet.has(val)) {
      matched++
      const hv = hardcoded.find(h => h.normalized === val)
      if (hv) {
        redundant.push({
          value: val,
          locations: hv.locations,
          count: hv.count,
        })
      }
    } else {
      const closest = findClosest(val, dsValues, distanceFn)
      const hv = hardcoded.find(h => h.normalized === val)
      mismatches.push({
        value: val,
        closestDsValue: closest,
        distance: closest ? distanceFn(val, closest) : Infinity,
        locations: hv?.locations ?? [],
      })
    }
  }

  return {
    totalUsed: unique.length,
    matchedToDs: matched,
    coverage: unique.length > 0 ? (matched / unique.length) * 100 : 100,
    mismatches,
    redundant,
  }
}

function compareCategoryNumeric(
  values: HardcodedValue[],
  dsValues: number[]
): DsCategoryResult {
  const dsSet = new Set(dsValues)
  let matched = 0
  const mismatches: DsMismatch[] = []
  const redundant: DsRedundant[] = []

  for (const hv of values) {
    const num = parseInt(hv.normalized)
    if (dsSet.has(num)) {
      matched++
      redundant.push({
        value: hv.normalized,
        locations: hv.locations,
        count: hv.count,
      })
    } else {
      // Solo candidatos finitos: un token DS no numérico (NaN) envenenaría el
      // reduce y produciría closestDsValue/distance = NaN.
      const finiteDs = dsValues.filter(Number.isFinite)
      const closest = (Number.isFinite(num) && finiteDs.length > 0)
        ? finiteDs.reduce((a, b) => Math.abs(b - num) < Math.abs(a - num) ? b : a)
        : null
      mismatches.push({
        value: hv.normalized,
        closestDsValue: closest !== null ? String(closest) : null,
        distance: closest !== null ? Math.abs(num - closest) : Infinity,
        locations: hv.locations,
      })
    }
  }

  return {
    totalUsed: values.length,
    matchedToDs: matched,
    coverage: values.length > 0 ? (matched / values.length) * 100 : 100,
    mismatches,
    redundant,
  }
}

function findClosest(value: string, candidates: string[], distanceFn: (a: string, b: string) => number): string | null {
  if (candidates.length === 0) return null
  let best: string | null = null
  let bestDist = Infinity
  for (const candidate of candidates) {
    const d = distanceFn(value, candidate)
    if (d < bestDist) {
      bestDist = d
      best = candidate
    }
  }
  // Si ningún candidato es comparable (todos Infinity), no hay "más cercano".
  return bestDist === Infinity ? null : best
}

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)))
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  s /= 100
  l /= 100
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return [clampByte(f(0) * 255), clampByte(f(8) * 255), clampByte(f(4) * 255)]
}

/**
 * Convierte un color CSS a [r,g,b]. Soporta #RGB, #RRGGBB, #RGBA y #RRGGBBAA
 * (se ignora el alfa), rgb()/rgba() y hsl()/hsla(). Devuelve null si no se
 * puede interpretar, en cuyo caso la distancia será Infinity.
 */
function colorToRgb(input: string): [number, number, number] | null {
  const v = input.trim().toLowerCase()

  if (v.startsWith("#")) {
    let hex = v.slice(1)
    if (hex.length === 3 || hex.length === 4) {
      hex = hex.split("").map(c => c + c).join("")
    }
    if (hex.length !== 6 && hex.length !== 8) return null
    const r = parseInt(hex.slice(0, 2), 16)
    const g = parseInt(hex.slice(2, 4), 16)
    const b = parseInt(hex.slice(4, 6), 16)
    if (isNaN(r) || isNaN(g) || isNaN(b)) return null
    return [r, g, b]
  }

  const rgbMatch = v.match(/^rgba?\(([^)]+)\)$/)
  if (rgbMatch) {
    const parts = rgbMatch[1].split(/[,/\s]+/).filter(Boolean).slice(0, 3).map(p =>
      p.endsWith("%") ? (parseFloat(p) / 100) * 255 : parseFloat(p)
    )
    if (parts.length < 3 || parts.some(isNaN)) return null
    return [clampByte(parts[0]), clampByte(parts[1]), clampByte(parts[2])]
  }

  const hslMatch = v.match(/^hsla?\(([^)]+)\)$/)
  if (hslMatch) {
    const parts = hslMatch[1].split(/[,/\s]+/).filter(Boolean)
    const h = parseFloat(parts[0])
    const s = parseFloat(parts[1])
    const l = parseFloat(parts[2])
    if ([h, s, l].some(isNaN)) return null
    return hslToRgb(((h % 360) + 360) % 360, s, l)
  }

  return null
}

function colorDistance(a: string, b: string): number {
  const rgbA = colorToRgb(a)
  const rgbB = colorToRgb(b)
  if (!rgbA || !rgbB) return Infinity
  return Math.sqrt(
    (rgbA[0] - rgbB[0]) ** 2 +
    (rgbA[1] - rgbB[1]) ** 2 +
    (rgbA[2] - rgbB[2]) ** 2
  )
}

function numericDistance(a: string, b: string): number {
  const numA = parseFloat(a)
  const numB = parseFloat(b)
  if (isNaN(numA) || isNaN(numB)) return Infinity
  return Math.abs(numA - numB)
}
