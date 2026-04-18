import { useMemo } from "react"
import type { AnalysisResult } from "@/types/analysis"
import {
  Hash, AtSign, AlertTriangle, Copy,
  Layers, Monitor, Play, FileText, Variable, Percent, Code, Zap, Package, Info,
} from "lucide-react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { LucideIcon } from "lucide-react"

// ─── Palette ──────────────────────────────────────────────────────
const C = {
  green: "#006c48",
  green2: "#2a9d6e",
  green3: "#5cc49a",
  yellow: "#a67c00",
  red: "#9e2b25",
  dark: "#1a2e23",
  muted: "#3d5a4a",
  bg: "#f8f9fa",
  bg2: "#f0f2f1",
}

const PIE_COLORS = [C.green2, C.yellow, C.red, "#8b5cf6", "#10b981"]
const TT_STYLE = { borderRadius: 12, border: "none", boxShadow: "0 4px 16px rgba(0,0,0,0.08)", fontSize: 12 } as const

// ─── Helpers ──────────────────────────────────────────────────────
function scoreColor(s: number) {
  if (s >= 70) return { ring: C.green, text: "text-[#006c48]", label: "Bueno", bg: "bg-[#e0f5ec]" }
  if (s >= 40) return { ring: C.yellow, text: "text-[#a67c00]", label: "Mejorable", bg: "bg-[#fef6e0]" }
  return { ring: C.red, text: "text-[#9e2b25]", label: "Critico", bg: "bg-[#fef2f1]" }
}

function complexityConfig(r: string) {
  const map: Record<string, { label: string; color: string; bg: string; desc: string }> = {
    low:      { label: "Baja",    color: C.green,  bg: "bg-[#e0f5ec] text-[#006c48]", desc: "CSS bien estructurado" },
    medium:   { label: "Media",   color: C.yellow, bg: "bg-[#fef6e0] text-[#a67c00]", desc: "Considera optimizaciones" },
    high:     { label: "Alta",    color: C.red,    bg: "bg-[#fef2f1] text-[#9e2b25]", desc: "Se recomienda refactorizar" },
    critical: { label: "Critica", color: C.red,    bg: "bg-[#fef2f1] text-[#9e2b25]", desc: "Refactorizacion urgente" },
  }
  return map[r] || map.medium
}

// ─── Info Tooltip ─────────────────────────────────────────────────
function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="relative group inline-flex">
      <Info size={12} className="text-[#3d5a4a]/40 hover:text-[#006c48] cursor-help transition-colors" />
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 rounded-lg bg-[#1a2e23] text-white text-[10px] leading-relaxed px-2.5 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-lg">
        {text}
        <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#1a2e23]" />
      </span>
    </span>
  )
}

// ─── Mini Metric Card ─────────────────────────────────────────────
interface MiniMetricProps {
  label: string
  value: number | string
  icon: LucideIcon
  severity: "good" | "neutral" | "warn" | "bad"
  tooltip?: string
}

const SEV_STYLES = {
  bad:     { border: "border-[#9e2b25]/20", iconColor: "#9e2b25", valueColor: "text-[#9e2b25]", dot: "bg-[#9e2b25]" },
  warn:    { border: "border-[#a67c00]/20", iconColor: "#a67c00", valueColor: "text-[#a67c00]", dot: "bg-[#a67c00]" },
  neutral: { border: "border-[#f0f2f1]",    iconColor: "#3d5a4a", valueColor: "text-[#1a2e23]", dot: "bg-[#3d5a4a]" },
  good:    { border: "border-[#006c48]/20", iconColor: "#006c48", valueColor: "text-[#006c48]", dot: "bg-[#006c48]" },
}

function MiniMetric({ label, value, icon: Icon, severity, tooltip }: MiniMetricProps) {
  const s = SEV_STYLES[severity]
  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border ${s.border} bg-white hover:shadow-sm transition-shadow`}>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${s.iconColor}10` }}>
        <Icon size={16} style={{ color: s.iconColor }} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <p className="text-[10px] text-[#3d5a4a] truncate">{label}</p>
          {tooltip && <InfoTooltip text={tooltip} />}
        </div>
        <p className={`text-lg font-bold leading-tight ${s.valueColor}`}>{typeof value === "number" ? value.toLocaleString() : value}</p>
      </div>
      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.dot}`} />
    </div>
  )
}

// ─── Score Ring ───────────────────────────────────────────────────
function ScoreRing({ score }: { score: number }) {
  const size = 140
  const r = 58
  const circ = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ
  const sc = scoreColor(score)

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f0f2f1" strokeWidth={10} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={sc.ring} strokeWidth={10}
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-4xl font-bold ${sc.text}`}>{score}</span>
        <span className="text-xs text-[#3d5a4a]">/ 100</span>
      </div>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────
interface OverviewTabProps {
  result: AnalysisResult
}

export function OverviewTab({ result }: OverviewTabProps) {
  const sc = scoreColor(result.healthScore)
  const cx = complexityConfig(result.complexityRating)
  const shorthandRatio = result.shorthandCount + result.longhandCount > 0
    ? (result.shorthandCount / (result.shorthandCount + result.longhandCount)) * 100
    : 0

  // ── Build ordered metrics: bad → warn → neutral → good ──
  type Metric = MiniMetricProps & { sortOrder: number }

  function sev(val: number, badThreshold: number, warnThreshold: number, invert = false): "good" | "neutral" | "warn" | "bad" {
    if (invert) {
      // Higher is worse (IDs, !important, etc.)
      if (val >= badThreshold) return "bad"
      if (val >= warnThreshold) return "warn"
      if (val > 0) return "neutral"
      return "good"
    }
    // Higher is better (classes, variables, reuse)
    if (val >= badThreshold) return "good"
    if (val >= warnThreshold) return "neutral"
    return "warn"
  }

  const sevOrder = { bad: 0, warn: 1, neutral: 2, good: 3 }

  const metrics: Metric[] = [
    // Problems (likely bad/warn)
    { label: "!important", value: result.importantCount, icon: AlertTriangle, severity: sev(result.importantCount, 20, 5, true), tooltip: "Fuerza prioridad CSS. Indica problemas de especificidad.", sortOrder: 0 },
    { label: "IDs como selector", value: result.idCount, icon: AtSign, severity: sev(result.idCount, 10, 3, true), tooltip: "Selectores #id — muy alta especificidad, dificultan mantenimiento.", sortOrder: 0 },
    { label: "Duplicados selector", value: result.duplicateSelectors.length, icon: Copy, severity: sev(result.duplicateSelectors.length, 20, 5, true), tooltip: "Misma regla repetida en el CSS. Se puede unificar.", sortOrder: 0 },
    { label: "Duplicados declaracion", value: result.duplicateDeclarations.length, icon: Copy, severity: sev(result.duplicateDeclarations.length, 20, 5, true), tooltip: "Misma propiedad:valor repetida en distintas reglas.", sortOrder: 0 },
    { label: "Prefijos vendor", value: result.vendorPrefixCount, icon: AlertTriangle, severity: sev(result.vendorPrefixCount, 30, 10, true), tooltip: "-webkit-, -moz-... Usa autoprefixer para automatizarlos.", sortOrder: 0 },
    { label: "Selector universal", value: result.universalSelectorCount, icon: Zap, severity: sev(result.universalSelectorCount, 15, 5, true), tooltip: "Uso de * — puede afectar rendimiento si se abusa.", sortOrder: 0 },
    { label: "Max especificidad", value: `${result.maxSpecificity[0]},${result.maxSpecificity[1]},${result.maxSpecificity[2]}`, icon: Zap, severity: result.maxSpecificity[0] > 0 ? "bad" : result.maxSpecificity[1] > 5 ? "warn" : "neutral", tooltip: "Especificidad mas alta encontrada (a,b,c). Si a > 0, hay IDs.", sortOrder: 0 },

    // Structure (neutral)
    { label: "Peso", value: `${(result.fileSize / 1024).toFixed(1)} KB`, icon: FileText, severity: "neutral", tooltip: "Tamano del archivo CSS.", sortOrder: 0 },
    { label: "Lineas", value: result.lineCount, icon: Code, severity: "neutral", tooltip: "Total de lineas de codigo.", sortOrder: 0 },
    { label: "Selectores", value: result.totalSelectors, icon: Hash, severity: "neutral", tooltip: "Reglas CSS definidas.", sortOrder: 0 },
    { label: "Declaraciones", value: result.totalDeclarations, icon: Zap, severity: "neutral", tooltip: "Propiedades CSS escritas en total.", sortOrder: 0 },
    { label: "Decl. unicas", value: result.uniqueDeclarations, icon: Package, severity: "neutral", tooltip: "Declaraciones no repetidas.", sortOrder: 0 },
    { label: "Prom. especificidad", value: result.avgSpecificity.toFixed(1), icon: Code, severity: "neutral", tooltip: "Media ponderada de especificidad.", sortOrder: 0 },
    { label: "Anidamiento max", value: result.deepestNesting, icon: Layers, severity: sev(result.deepestNesting, 6, 4, true), tooltip: "Profundidad maxima de reglas anidadas.", sortOrder: 0 },
    { label: "Pseudo-clases", value: result.pseudoClassCount, icon: Code, severity: "neutral", tooltip: ":hover, :focus, :nth-child...", sortOrder: 0 },
    { label: "Pseudo-elementos", value: result.pseudoElementCount, icon: Code, severity: "neutral", tooltip: "::before, ::after, ::placeholder...", sortOrder: 0 },
    { label: "Selector atributo", value: result.attributeSelectorCount, icon: Hash, severity: "neutral", tooltip: "Selectores tipo [type='text'].", sortOrder: 0 },
    { label: "Media queries", value: result.mediaQueries.length, icon: Monitor, severity: "neutral", tooltip: "Breakpoints responsive definidos.", sortOrder: 0 },
    { label: "Keyframes", value: result.keyframes.length, icon: Play, severity: "neutral", tooltip: "Animaciones @keyframes definidas.", sortOrder: 0 },

    // Good metrics
    { label: "Clases", value: result.classCount, icon: Hash, severity: "good", tooltip: "Selectores .clase — la forma recomendada.", sortOrder: 0 },
    { label: "Variables CSS", value: result.variableCount, icon: Variable, severity: result.variableCount > 0 ? "good" : "neutral", tooltip: "Custom properties --var. Mejoran consistencia.", sortOrder: 0 },
    { label: "Reutilizacion", value: `${(result.reuseRatio * 100).toFixed(0)}%`, icon: Percent, severity: result.reuseRatio >= 0.5 ? "good" : result.reuseRatio >= 0.3 ? "neutral" : "warn", tooltip: "% de declaraciones reutilizadas. Mas alto = mejor.", sortOrder: 0 },
    { label: "Shorthand", value: result.shorthandCount, icon: Package, severity: "good", tooltip: "margin, padding, background... Mas limpio que longhand.", sortOrder: 0 },
    { label: "Longhand", value: result.longhandCount, icon: Code, severity: "neutral", tooltip: "margin-top, padding-left... Podrian unificarse con shorthand.", sortOrder: 0 },
  ]

  // Sort: bad first, then warn, neutral, good
  const sorted = metrics
    .map(m => ({ ...m, sortOrder: sevOrder[m.severity] }))
    .sort((a, b) => a.sortOrder - b.sortOrder)

  // Charts
  const specificityData = getSpecificityBuckets(result)
  const hardcodedData = [
    { name: "Colores", value: result.colors.length },
    { name: "Font sizes", value: result.fontSizes.length },
    { name: "Spacing", value: result.spacingValues.length },
    { name: "Z-index", value: result.zIndexValues.length },
    { name: "!important", value: result.importantCount },
  ].filter(d => d.value > 0)

  // Summary stats for the hero
  const summaryItems = [
    { label: "Selectores", value: result.totalSelectors.toLocaleString() },
    { label: "Declaraciones", value: result.totalDeclarations.toLocaleString() },
    { label: "Reutilizacion", value: `${(result.reuseRatio * 100).toFixed(0)}%` },
    { label: "Peso", value: `${(result.fileSize / 1024).toFixed(1)} KB` },
    { label: "Lineas", value: result.lineCount.toLocaleString() },
  ]

  // ── CSS Composition pie ──
  const compositionData = [
    { name: "Clases", value: result.classCount },
    { name: "IDs", value: result.idCount },
    { name: "!important", value: result.importantCount },
    { name: "Variables", value: result.variableCount },
  ].filter(d => d.value > 0)

  // ── Top 10 colors bar ──
  const topColors = useMemo(() =>
    [...result.colors].sort((a, b) => b.count - a.count).slice(0, 12),
    [result.colors]
  )

  // ── Spacing: grid-8 analysis ──
  const spacingAnalysis = useMemo(() => {
    let grid8 = 0, nonGrid8 = 0, pctOther = 0
    for (const sv of result.spacingValues) {
      const n = parseFloat(sv.normalized)
      const isPx = /px$/i.test(sv.normalized) || sv.normalized === '0' || /^\d+$/.test(sv.normalized)
      if (!isPx) { pctOther += sv.count; continue }
      if (isNaN(n)) continue
      if (n === 0 || n % 8 === 0) grid8 += sv.count
      else nonGrid8 += sv.count
    }
    return [
      { name: "Grid 8px", value: grid8 },
      { name: "Fuera de grid", value: nonGrid8 },
      { name: "% / rem / otros", value: pctOther },
    ].filter(d => d.value > 0)
  }, [result.spacingValues])

  // ── Z-index depth layers ──
  const zLayerData = useMemo(() => {
    const layers: Record<string, number> = {}
    for (const z of result.zIndexValues) {
      const n = parseInt(z.value, 10)
      if (isNaN(n)) continue
      const depth = n < 0 ? -1 : Math.min(Math.floor(n / 1000), 9)
      const label = depth === -1 ? 'Negativos' : `${depth * 1000}-${depth * 1000 + 999}`
      layers[label] = (layers[label] || 0) + z.count
    }
    return Object.entries(layers)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => {
        const numA = a.name === 'Negativos' ? -1 : parseInt(a.name)
        const numB = b.name === 'Negativos' ? -1 : parseInt(b.name)
        return numA - numB
      })
  }, [result.zIndexValues])

  // ── Typography: font families ──
  const familyData = useMemo(() =>
    [...result.fontFamilies].sort((a, b) => b.count - a.count).slice(0, 8).map(f => ({
      name: f.normalized.length > 16 ? f.normalized.slice(0, 14) + '...' : f.normalized,
      full: f.normalized,
      value: f.count,
    })),
    [result.fontFamilies]
  )

  // ── Typography: font weights ──
  const weightData = useMemo(() =>
    [...result.fontWeights].sort((a, b) => {
      const na = parseInt(a.normalized) || 0
      const nb = parseInt(b.normalized) || 0
      return na - nb
    }).map(w => ({
      name: w.normalized,
      value: w.count,
    })),
    [result.fontWeights]
  )

  // ── Media queries distribution ──
  const mqData = useMemo(() =>
    [...result.mediaQueries].sort((a, b) => b.count - a.count).slice(0, 8).map(mq => ({
      name: mq.query.length > 25 ? mq.query.slice(0, 23) + '...' : mq.query,
      full: mq.query,
      value: mq.count,
    })),
    [result.mediaQueries]
  )

  // ── Duplicates summary ──
  const dupsData = [
    { name: "Selectores duplicados", value: result.duplicateSelectors.length },
    { name: "Declaraciones duplicadas", value: result.duplicateDeclarations.length },
  ].filter(d => d.value > 0)

  return (
    <div className="space-y-6">
      {/* ══════════════════════════════════════════════════════════════
           HERO — Health Score + Summary + Complexity
         ══════════════════════════════════════════════════════════════ */}
      <Card className="p-0 overflow-hidden">
        <div className="flex flex-col lg:flex-row">
          {/* Left: Score Ring */}
          <div className={`flex flex-col items-center justify-center gap-3 p-8 ${sc.bg}`}>
            <p className="text-xs font-semibold text-[#3d5a4a] uppercase tracking-wider">CSS Health Score</p>
            <ScoreRing score={result.healthScore} />
            <Badge className={`${sc.bg} ${sc.text} text-sm px-4 py-1`}>
              {sc.label}
            </Badge>
          </div>

          {/* Center: Summary Stats */}
          <div className="flex-1 p-6 flex flex-col justify-center">
            <p className="text-xs font-semibold text-[#3d5a4a] uppercase tracking-wider mb-4">Resumen del CSS</p>
            <div className="grid grid-cols-5 gap-4">
              {summaryItems.map((item) => (
                <div key={item.label} className="text-center">
                  <p className="text-2xl font-bold text-[#1a2e23]">{item.value}</p>
                  <p className="text-[10px] text-[#3d5a4a] mt-0.5">{item.label}</p>
                </div>
              ))}
            </div>

            {/* Shorthand bar inline */}
            <div className="mt-5 pt-4 border-t border-[#f0f2f1]">
              <div className="flex items-center justify-between text-[10px] text-[#3d5a4a] mb-1.5">
                <span>Shorthand vs Longhand</span>
                <span>{shorthandRatio.toFixed(0)}% shorthand</span>
              </div>
              <div className="h-2 bg-[#f0f2f1] rounded-full overflow-hidden flex">
                <div className="bg-[#006c48] rounded-l-full transition-all" style={{ width: `${shorthandRatio}%` }} />
                <div className="bg-[#a67c00] rounded-r-full" style={{ width: `${100 - shorthandRatio}%` }} />
              </div>
              <div className="flex justify-between text-[10px] text-[#3d5a4a] mt-1">
                <span>Shorthand: {result.shorthandCount}</span>
                <span>Longhand: {result.longhandCount}</span>
              </div>
            </div>
          </div>

          {/* Right: Complexity */}
          <div className="flex flex-col items-center justify-center gap-3 p-6 border-l border-[#f0f2f1] min-w-[160px]">
            <p className="text-xs font-semibold text-[#3d5a4a] uppercase tracking-wider">Complejidad</p>
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center"
              style={{ backgroundColor: `${cx.color}15` }}
            >
              <Zap size={32} style={{ color: cx.color }} />
            </div>
            <Badge className={`${cx.bg} text-sm px-4 py-1`}>
              {cx.label}
            </Badge>
            <p className="text-[10px] text-[#3d5a4a] text-center max-w-[140px]">{cx.desc}</p>
          </div>
        </div>
      </Card>

      {/* ══════════════════════════════════════════════════════════════
           SEVERITY LEGEND
         ══════════════════════════════════════════════════════════════ */}
      <div className="flex items-center gap-4 text-[10px] text-[#3d5a4a]">
        <span className="font-semibold uppercase tracking-wider">KPIs ordenados por severidad:</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#9e2b25]" /> Problemas</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#a67c00]" /> Warnings</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#3d5a4a]" /> Neutros</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#006c48]" /> Buenos</span>
      </div>

      {/* ══════════════════════════════════════════════════════════════
           KPI GRID — sorted bad → good
         ══════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
        {sorted.map((m, i) => (
          <MiniMetric
            key={i}
            label={m.label}
            value={m.value}
            icon={m.icon}
            severity={m.severity}
            tooltip={m.tooltip}
          />
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════
           CHARTS ROW 1 — Specificity + Hardcoded Breakdown
         ══════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {specificityData.length > 0 && (
          <Card className="p-5">
            <div className="flex items-center gap-1.5 mb-1">
              <h4 className="text-sm font-semibold text-[#1a2e23]">Distribucion de Especificidad</h4>
              <InfoTooltip text="Como se reparten tus selectores: tipo (div), clase (.btn) o ID (#header). Menos IDs = mejor." />
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={specificityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f1" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: C.muted }} />
                <YAxis tick={{ fontSize: 11, fill: C.muted }} />
                <Tooltip contentStyle={TT_STYLE} />
                <Bar dataKey="count" fill={C.green2} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}

        {hardcodedData.length > 0 && (
          <Card className="p-5">
            <div className="flex items-center gap-1.5 mb-1">
              <h4 className="text-sm font-semibold text-[#1a2e23]">Valores Hardcodeados</h4>
              <InfoTooltip text="Valores escritos directamente en vez de usar variables CSS o tokens del Design System." />
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={hardcodedData} cx="50%" cy="50%" outerRadius={80} innerRadius={35} dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`} labelLine={{ stroke: C.muted, strokeWidth: 1 }}>
                  {hardcodedData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TT_STYLE} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════
           CHARTS ROW 2 — Composition + Top Colors
         ══════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {compositionData.length > 0 && (
          <Card className="p-5">
            <div className="flex items-center gap-1.5 mb-1">
              <h4 className="text-sm font-semibold text-[#1a2e23]">Composicion del CSS</h4>
              <InfoTooltip text="Proporcion entre clases, IDs, !important y variables CSS. Mas clases y variables = mejor." />
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={compositionData} cx="50%" cy="50%" outerRadius={80} innerRadius={35} dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`} labelLine={{ stroke: C.muted, strokeWidth: 1 }}>
                  {compositionData.map((entry, i) => (
                    <Cell key={i} fill={
                      entry.name === 'Clases' ? C.green :
                      entry.name === 'Variables' ? C.green2 :
                      entry.name === 'IDs' ? C.yellow :
                      C.red
                    } />
                  ))}
                </Pie>
                <Tooltip contentStyle={TT_STYLE} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        )}

        {topColors.length > 0 && (
          <Card className="p-5">
            <div className="flex items-center gap-1.5 mb-1">
              <h4 className="text-sm font-semibold text-[#1a2e23]">Top Colores Hardcodeados</h4>
              <InfoTooltip text="Los colores mas usados directamente en el CSS. Deberian ser variables del Design System." />
            </div>
            <div className="space-y-1.5 mt-3">
              {topColors.map((c, i) => {
                const maxCount = topColors[0]?.count || 1
                const pct = (c.count / maxCount) * 100
                return (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded border shrink-0" style={{ backgroundColor: c.normalized }} />
                    <span className="text-[10px] font-mono w-20 shrink-0 text-[#3d5a4a]">{c.normalized}</span>
                    <div className="flex-1 h-5 bg-[#f0f2f1] rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: c.normalized === '#ffffff' || c.normalized === 'white' ? '#d1d5db' : c.normalized }} />
                    </div>
                    <span className="text-[10px] font-semibold text-[#1a2e23] w-8 text-right">{c.count}</span>
                  </div>
                )
              })}
            </div>
          </Card>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════
           CHARTS ROW 3 — Spacing + Z-index
         ══════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {spacingAnalysis.length > 0 && (
          <Card className="p-5">
            <div className="flex items-center gap-1.5 mb-1">
              <h4 className="text-sm font-semibold text-[#1a2e23]">Spacing: Alineacion al Grid de 8px</h4>
              <InfoTooltip text="Cuantos valores de spacing siguen la escala de 8px (multiplos de 8) vs los que no. El objetivo es que todos sean multiplos de 8." />
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={spacingAnalysis} cx="50%" cy="50%" outerRadius={80} innerRadius={35} dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`} labelLine={{ stroke: C.muted, strokeWidth: 1 }}>
                  {spacingAnalysis.map((entry, i) => (
                    <Cell key={i} fill={
                      entry.name === 'Grid 8px' ? C.green :
                      entry.name === 'Fuera de grid' ? C.red :
                      C.yellow
                    } />
                  ))}
                </Pie>
                <Tooltip contentStyle={TT_STYLE} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        )}

        {zLayerData.length > 0 && (
          <Card className="p-5">
            <div className="flex items-center gap-1.5 mb-1">
              <h4 className="text-sm font-semibold text-[#1a2e23]">Z-index por Capas</h4>
              <InfoTooltip text="Distribucion de z-index agrupados en capas de 1000. Cada capa tiene un proposito: 0-999 contenido, 1000-1999 elevados, 2000+ overlays." />
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={zLayerData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f1" />
                <XAxis type="number" tick={{ fontSize: 10, fill: C.muted }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: C.muted }} width={90} />
                <Tooltip contentStyle={TT_STYLE} />
                <Bar dataKey="value" fill={C.yellow} radius={[0, 4, 4, 0]} name="Usos" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════
           CHARTS ROW 4 — Font Families + Font Weights
         ══════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {familyData.length > 0 && (
          <Card className="p-5">
            <div className="flex items-center gap-1.5 mb-1">
              <h4 className="text-sm font-semibold text-[#1a2e23]">Familias Tipograficas</h4>
              <InfoTooltip text="Distribucion de font-family. Solo deberia usarse Suisse y genericas (sans-serif, monospace)." />
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={familyData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f1" />
                <XAxis type="number" tick={{ fontSize: 10, fill: C.muted }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: C.muted }} width={120} />
                <Tooltip contentStyle={TT_STYLE} formatter={(val: any, _: any, props: any) => [val, props?.payload?.full || 'Usos']} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} name="Usos">
                  {familyData.map((f, i) => {
                    const lower = f.full.toLowerCase()
                    const isSuisse = /suisse/.test(lower)
                    const isGeneric = /^(sans-serif|serif|monospace|cursive|fantasy|system-ui|ui-serif|ui-sans-serif|ui-monospace|ui-rounded)$/.test(lower)
                    return <Cell key={i} fill={isSuisse ? C.green : isGeneric ? C.green3 : C.red} />
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}

        {weightData.length > 0 && (
          <Card className="p-5">
            <div className="flex items-center gap-1.5 mb-1">
              <h4 className="text-sm font-semibold text-[#1a2e23]">Pesos Tipograficos</h4>
              <InfoTooltip text="Distribucion de font-weight. Los pesos aprobados del DS son 100, 400, 600 y 700." />
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={weightData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f1" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: C.muted }} />
                <YAxis tick={{ fontSize: 10, fill: C.muted }} />
                <Tooltip contentStyle={TT_STYLE} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} name="Usos">
                  {weightData.map((w, i) => {
                    const n = parseInt(w.name) || 0
                    const approved = [100, 400, 600, 700].includes(n)
                    return <Cell key={i} fill={approved ? C.green : C.yellow} />
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════
           CHARTS ROW 5 — Media Queries + Duplicates
         ══════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {mqData.length > 0 && (
          <Card className="p-5">
            <div className="flex items-center gap-1.5 mb-1">
              <h4 className="text-sm font-semibold text-[#1a2e23]">Media Queries</h4>
              <InfoTooltip text="Breakpoints responsive y sus usos. Muchos breakpoints distintos pueden indicar falta de sistema." />
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={mqData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f1" />
                <XAxis type="number" tick={{ fontSize: 10, fill: C.muted }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 9, fill: C.muted }} width={160} />
                <Tooltip contentStyle={TT_STYLE} formatter={(val: any, _: any, props: any) => [val, props?.payload?.full || 'Usos']} />
                <Bar dataKey="value" fill={C.green3} radius={[0, 4, 4, 0]} name="Usos" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}

        {dupsData.length > 0 && (
          <Card className="p-5">
            <div className="flex items-center gap-1.5 mb-1">
              <h4 className="text-sm font-semibold text-[#1a2e23]">Duplicados</h4>
              <InfoTooltip text="Selectores y declaraciones repetidos. Reducir duplicados baja el peso del CSS y mejora mantenimiento." />
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={dupsData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f1" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: C.muted }} />
                <YAxis tick={{ fontSize: 10, fill: C.muted }} />
                <Tooltip contentStyle={TT_STYLE} />
                <Bar dataKey="value" fill={C.red} radius={[4, 4, 0, 0]} name="Grupos duplicados" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}
      </div>
    </div>
  )
}

function getSpecificityBuckets(result: AnalysisResult) {
  const buckets = { "Solo tipo (0,0,c)": 0, "Clase (0,b,c)": 0, "ID (a,b,c)": 0 }
  for (const entry of result.specificityDistribution) {
    const [a, b] = entry.specificity
    if (a > 0) buckets["ID (a,b,c)"]++
    else if (b > 0) buckets["Clase (0,b,c)"]++
    else buckets["Solo tipo (0,0,c)"]++
  }
  return Object.entries(buckets).map(([name, count]) => ({ name, count })).filter(b => b.count > 0)
}
