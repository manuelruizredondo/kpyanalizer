export interface LocationReference {
  line: number
  column: number
  selector: string
  property: string
  rule: string
}

export interface HardcodedValue {
  value: string
  normalized: string
  count: number
  locations: LocationReference[]
}

export interface DuplicateGroup {
  key: string
  occurrences: LocationReference[]
}

export interface MediaQueryInfo {
  query: string
  count: number
  locations: { line: number }[]
}

export interface KeyframeInfo {
  name: string
  line: number
}

export interface SpecificityEntry {
  selector: string
  specificity: [number, number, number]
  line: number
}

export interface AnalysisResult {
  raw: string
  fileSize: number
  lineCount: number

  classCount: number
  idCount: number
  importantCount: number
  variableCount: number

  colors: HardcodedValue[]
  fontSizes: HardcodedValue[]
  spacingValues: HardcodedValue[]
  zIndexValues: HardcodedValue[]
  importants: LocationReference[]

  duplicateSelectors: DuplicateGroup[]
  duplicateDeclarations: DuplicateGroup[]
  mediaQueries: MediaQueryInfo[]
  keyframes: KeyframeInfo[]

  specificityDistribution: SpecificityEntry[]

  reuseRatio: number
  healthScore: number

  totalSelectors: number
  totalDeclarations: number
  uniqueDeclarations: number

  // New metrics
  maxSpecificity: [number, number, number]
  avgSpecificity: number
  deepestNesting: number
  universalSelectorCount: number
  attributeSelectorCount: number
  pseudoClassCount: number
  pseudoElementCount: number
  vendorPrefixCount: number
  shorthandCount: number
  longhandCount: number

  // Typography
  fontWeights: HardcodedValue[]
  fontFamilies: HardcodedValue[]

  // Complexity summary
  complexityRating: 'low' | 'medium' | 'high' | 'critical'
}
