import type { LocationReference } from "./analysis"

export interface DsTokenSet {
  colors: string[]
  fontSizes: string[]
  spacing: string[]
  zIndex: number[]
}

export interface DsMismatch {
  value: string
  closestDsValue: string | null
  distance: number
  locations: LocationReference[]
}

export interface DsCategoryResult {
  totalUsed: number
  matchedToDs: number
  coverage: number
  mismatches: DsMismatch[]
}

export interface DsCoverageResult {
  colors: DsCategoryResult
  fontSizes: DsCategoryResult
  spacing: DsCategoryResult
  zIndex: DsCategoryResult
  overallCoverage: number
}
