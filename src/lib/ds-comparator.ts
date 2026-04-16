import type { DsTokenSet, DsCoverageResult, DsCategoryResult, DsMismatch } from "@/types/design-system"
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

  for (const val of unique) {
    if (dsSet.has(val)) {
      matched++
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
  }
}

function compareCategoryNumeric(
  values: HardcodedValue[],
  dsValues: number[]
): DsCategoryResult {
  const dsSet = new Set(dsValues)
  let matched = 0
  const mismatches: DsMismatch[] = []

  for (const hv of values) {
    const num = parseInt(hv.normalized)
    if (dsSet.has(num)) {
      matched++
    } else {
      const closest = dsValues.length > 0
        ? dsValues.reduce((a, b) => Math.abs(b - num) < Math.abs(a - num) ? b : a)
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
  }
}

function findClosest(value: string, candidates: string[], distanceFn: (a: string, b: string) => number): string | null {
  if (candidates.length === 0) return null
  let best = candidates[0]
  let bestDist = distanceFn(value, candidates[0])
  for (let i = 1; i < candidates.length; i++) {
    const d = distanceFn(value, candidates[i])
    if (d < bestDist) {
      bestDist = d
      best = candidates[i]
    }
  }
  return best
}

function hexToRgb(hex: string): [number, number, number] | null {
  const clean = hex.replace("#", "")
  if (clean.length !== 6) return null
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  if (isNaN(r) || isNaN(g) || isNaN(b)) return null
  return [r, g, b]
}

function colorDistance(a: string, b: string): number {
  const rgbA = hexToRgb(a)
  const rgbB = hexToRgb(b)
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
