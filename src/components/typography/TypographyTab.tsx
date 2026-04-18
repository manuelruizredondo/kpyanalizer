import { useMemo } from "react"
import type { AnalysisResult, HardcodedValue } from "@/types/analysis"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
  AreaChart, Area, Legend,
} from "recharts"
import { Type, Bold, AlertTriangle, Info, CheckCircle, XCircle, Minus } from "lucide-react"

interface TypographyTabProps {
  result: AnalysisResult
}

const COLORS = {
  green: "#006c48",
  lightGreen1: "#2a9d6e",
  lightGreen2: "#5cc49a",
  yellow: "#a67c00",
  red: "#9e2b25",
  dark: "#1a2e23",
  muted: "#3d5a4a",
  gray: "#94a3b8",
}

// ─── Design System font ──────────────────────────────────────────
// The approved font family — everything else custom is flagged for elimination
const DS_FONT_KEYWORD = "suisse"

// ─── Info Tooltip ──────────────────────────────────────────────────
function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="relative group inline-flex ml-1">
      <Info size={13} className="text-[#3d5a4a]/50 hover:text-[#006c48] cursor-help transition-colors" />
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 rounded-lg bg-[#1a2e23] text-white text-xs leading-relaxed px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-lg">
        {text}
        <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#1a2e23]" />
      </span>
    </span>
  )
}

// ─── Weight label helper ──────────────────────────────────────────
function getWeightLabel(normalized: string): string {
  const map: Record<string, string> = {
    "100": "Thin", "200": "Extra Light", "300": "Light",
    "400": "Normal", "500": "Medium", "600": "Semi Bold",
    "700": "Bold", "800": "Extra Bold", "900": "Black",
  }
  return map[normalized] || normalized
}

function getWeightBarColor(normalized: string): string {
  const n = parseInt(normalized, 10)
  if (isNaN(n)) return COLORS.muted
  if (n <= 300) return COLORS.lightGreen2
  if (n <= 500) return COLORS.lightGreen1
  if (n <= 700) return COLORS.green
  return COLORS.dark
}

// ─── Font family classification (3 tiers) ─────────────────────────
type FamilyTier = "ds" | "generic" | "eliminate"

const GENERIC_FAMILIES = new Set([
  "serif", "sans-serif", "monospace", "cursive", "fantasy",
  "system-ui", "ui-serif", "ui-sans-serif", "ui-monospace", "ui-rounded",
  "emoji", "math", "fangsong",
])

function classifyFamily(normalized: string): FamilyTier {
  if (GENERIC_FAMILIES.has(normalized)) return "generic"
  if (normalized.includes(DS_FONT_KEYWORD)) return "ds"
  return "eliminate"
}

const TIER_CONFIG: Record<FamilyTier, { label: string; color: string; bg: string; icon: typeof CheckCircle }> = {
  ds:        { label: "Design System", color: COLORS.green, bg: "bg-[#e0f5ec] text-[#006c48]", icon: CheckCircle },
  generic:   { label: "Fallback generico", color: COLORS.gray, bg: "bg-[#f0f2f1] text-[#3d5a4a]", icon: Minus },
  eliminate: { label: "A eliminar", color: COLORS.red, bg: "bg-[#fef2f1] text-[#9e2b25]", icon: XCircle },
}

// ─── Value list component ─────────────────────────────────────────
function ValueList({ items, renderValue }: { items: HardcodedValue[]; renderValue?: (item: HardcodedValue) => React.ReactNode }) {
  if (items.length === 0) {
    return <p className="text-sm text-[#3d5a4a] py-4 text-center">No se encontraron valores.</p>
  }
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-[#f8f9fa] hover:bg-[#f0f2f1] transition-colors">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {renderValue ? renderValue(item) : (
              <code className="text-sm font-mono text-[#1a2e23] truncate">{item.value}</code>
            )}
          </div>
          <Badge variant="secondary" className="shrink-0 text-xs">
            {item.count}x
          </Badge>
        </div>
      ))}
    </div>
  )
}

export function TypographyTab({ result }: TypographyTabProps) {
  const { fontWeights, fontFamilies, fontSizes } = result

  // ── Classify all font families ──
  const classified = useMemo(() => {
    const ds: (HardcodedValue & { tier: FamilyTier })[] = []
    const generic: (HardcodedValue & { tier: FamilyTier })[] = []
    const eliminate: (HardcodedValue & { tier: FamilyTier })[] = []

    for (const f of fontFamilies) {
      const tier = classifyFamily(f.normalized)
      const entry = { ...f, tier }
      if (tier === "ds") ds.push(entry)
      else if (tier === "generic") generic.push(entry)
      else eliminate.push(entry)
    }
    return { ds, generic, eliminate, all: [...ds, ...generic, ...eliminate] }
  }, [fontFamilies])

  // ── Summary stats ──
  const totalWeightUsages = fontWeights.reduce((s, w) => s + w.count, 0)
  const totalFamilyUsages = fontFamilies.reduce((s, f) => s + f.count, 0)
  const dsUsages = classified.ds.reduce((s, f) => s + f.count, 0)
  const genericUsages = classified.generic.reduce((s, f) => s + f.count, 0)
  const eliminateUsages = classified.eliminate.reduce((s, f) => s + f.count, 0)

  // ── Elimination chart data (stacked area) ──
  // One data point per family, sorted: DS first, then generic, then eliminate
  const eliminationChartData = useMemo(() => {
    const sorted = [...classified.all].sort((a, b) => {
      const order: Record<FamilyTier, number> = { ds: 0, generic: 1, eliminate: 2 }
      return order[a.tier] - order[b.tier] || b.count - a.count
    })
    return sorted.map((f, i) => ({
      index: i + 1,
      name: f.value,
      "Design System": f.tier === "ds" ? f.count : 0,
      "Fallback generico": f.tier === "generic" ? f.count : 0,
      "A eliminar": f.tier === "eliminate" ? f.count : 0,
      total: f.count,
      tier: f.tier,
    }))
  }, [classified])

  // ── Pie data for the 3-tier breakdown ──
  const tierPieData = useMemo(() => [
    { name: "Design System (Suisse)", value: dsUsages, fill: COLORS.green },
    { name: "Fallback generico", value: genericUsages, fill: COLORS.gray },
    { name: "A eliminar", value: eliminateUsages, fill: COLORS.red },
  ].filter(d => d.value > 0), [dsUsages, genericUsages, eliminateUsages])

  // ── Weight chart data ──
  const weightChartData = useMemo(() =>
    fontWeights.map(w => ({
      name: getWeightLabel(w.normalized),
      weight: w.normalized,
      count: w.count,
      fill: getWeightBarColor(w.normalized),
    })).sort((a, b) => {
      const na = parseInt(a.weight, 10)
      const nb = parseInt(b.weight, 10)
      if (!isNaN(na) && !isNaN(nb)) return na - nb
      return a.weight.localeCompare(b.weight)
    }), [fontWeights])

  // ── Assessments ──
  const tooManyWeights = fontWeights.length > 5
  const hasEliminable = classified.eliminate.length > 0
  const eliminatePercent = totalFamilyUsages > 0 ? (eliminateUsages / totalFamilyUsages * 100) : 0

  return (
    <div className="space-y-6">
      {/* ══════════════════════════════════════════════════════════════
           SUMMARY CARDS
         ══════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Bold size={16} className="text-[#006c48]" />
            <p className="text-xs text-[#3d5a4a]">Font-weights</p>
          </div>
          <p className="text-2xl font-bold text-[#1a2e23]">{fontWeights.length}</p>
          <p className="text-xs text-[#3d5a4a] mt-0.5">{totalWeightUsages} usos</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle size={16} className="text-[#006c48]" />
            <p className="text-xs text-[#3d5a4a]">Suisse (DS)</p>
          </div>
          <p className="text-2xl font-bold text-[#006c48]">{classified.ds.length}</p>
          <p className="text-xs text-[#3d5a4a] mt-0.5">{dsUsages} usos</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Minus size={16} className="text-[#94a3b8]" />
            <p className="text-xs text-[#3d5a4a]">Genericas</p>
          </div>
          <p className="text-2xl font-bold text-[#3d5a4a]">{classified.generic.length}</p>
          <p className="text-xs text-[#3d5a4a] mt-0.5">{genericUsages} usos</p>
        </Card>

        <Card className="p-4 border-[#fef2f1]">
          <div className="flex items-center gap-2 mb-1">
            <XCircle size={16} className="text-[#9e2b25]" />
            <p className="text-xs text-[#9e2b25]">A eliminar</p>
          </div>
          <p className="text-2xl font-bold text-[#9e2b25]">{classified.eliminate.length}</p>
          <p className="text-xs text-[#9e2b25] mt-0.5">{eliminateUsages} usos ({eliminatePercent.toFixed(0)}%)</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Type size={16} className="text-[#3d5a4a]" />
            <p className="text-xs text-[#3d5a4a]">Font-sizes</p>
          </div>
          <p className="text-2xl font-bold text-[#1a2e23]">{fontSizes.length}</p>
          <p className="text-xs text-[#3d5a4a] mt-0.5">tamanos distintos</p>
        </Card>
      </div>

      {/* ── Alert: fonts to eliminate ── */}
      {hasEliminable && (
        <Card className="p-4 border-[#9e2b25]/20 bg-[#fef2f1]/50">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="text-[#9e2b25] shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-[#9e2b25] mb-1">
                {classified.eliminate.length} fuente{classified.eliminate.length !== 1 ? 's' : ''} fuera del Design System
              </p>
              <p className="text-xs text-[#3d5a4a] leading-relaxed">
                Solo <strong>Suisse</strong> deberia usarse como fuente principal. Las genericas (sans-serif, serif, monospace) son aceptables como fallback.
                Las siguientes fuentes deben ser reemplazadas por Suisse:
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {classified.eliminate.map((f, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 bg-white rounded-lg px-2.5 py-1 border border-[#9e2b25]/20">
                    <XCircle size={12} className="text-[#9e2b25]" />
                    <code className="text-xs font-mono text-[#1a2e23]">{f.value}</code>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{f.count}x</Badge>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      {tooManyWeights && (
        <Card className="p-4 border-[#a67c00]/20 bg-[#fef6e0]/50">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="text-[#a67c00] shrink-0 mt-0.5" />
            <p className="text-xs text-[#a67c00]">
              <strong>Demasiados font-weights ({fontWeights.length}).</strong> Se recomiendan 2-4 grosores para mantener jerarquia tipografica clara.
            </p>
          </div>
        </Card>
      )}

      {/* ══════════════════════════════════════════════════════════════
           ELIMINATION LINE CHART
         ══════════════════════════════════════════════════════════════ */}
      {eliminationChartData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-1.5">
              <CardTitle className="text-sm">Mapa de Eliminacion Tipografica</CardTitle>
              <InfoTooltip text="Cada barra representa una familia tipografica. Verde = Suisse (mantener), gris = generica (fallback aceptable), rojo = a eliminar. El objetivo es que no quede rojo." />
            </div>
            <p className="text-xs text-[#3d5a4a]">
              Distribucion de usos por categoria — {eliminatePercent > 0 ? `${eliminatePercent.toFixed(0)}% de los usos deben eliminarse` : "todo alineado con el DS"}
            </p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={eliminationChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="gradDS" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.green} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={COLORS.green} stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="gradGeneric" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.gray} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={COLORS.gray} stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="gradEliminate" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.red} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={COLORS.red} stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f1" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 9, fill: COLORS.muted }}
                  tickLine={false}
                  angle={-35}
                  textAnchor="end"
                  height={60}
                  interval={0}
                />
                <YAxis tick={{ fontSize: 10, fill: COLORS.muted }} tickLine={false} axisLine={false} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length > 0) {
                      const d = payload[0]?.payload
                      if (!d) return null
                      const tierKey = d.tier as FamilyTier
                      const cfg = TIER_CONFIG[tierKey]
                      return (
                        <div className="bg-white rounded-lg p-3 shadow-lg text-xs border-0" style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }}>
                          <p className="font-semibold text-[#1a2e23] mb-1">{d.name}</p>
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cfg.color }} />
                            <span style={{ color: cfg.color }}>{cfg.label}</span>
                          </div>
                          <p className="text-[#3d5a4a] mt-1">{d.total} usos en el CSS</p>
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 11 }}
                  formatter={(value: string) => <span className="text-xs text-[#3d5a4a]">{value}</span>}
                />
                <Area
                  type="monotone"
                  dataKey="Design System"
                  stroke={COLORS.green}
                  strokeWidth={2}
                  fill="url(#gradDS)"
                  stackId="1"
                  dot={false}
                />
                <Area
                  type="monotone"
                  dataKey="Fallback generico"
                  stroke={COLORS.gray}
                  strokeWidth={2}
                  fill="url(#gradGeneric)"
                  stackId="1"
                  dot={false}
                />
                <Area
                  type="monotone"
                  dataKey="A eliminar"
                  stroke={COLORS.red}
                  strokeWidth={2}
                  fill="url(#gradEliminate)"
                  stackId="1"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* ══════════════════════════════════════════════════════════════
           CHARTS ROW — Weights + Tier Pie
         ══════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Font Weight Distribution */}
        {weightChartData.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-1.5">
                <CardTitle className="text-sm">Distribucion de Font-Weights</CardTitle>
                <InfoTooltip text="Cuantas veces se usa cada grosor. Barras mas oscuras = pesos mas altos (bold, black)." />
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={weightChartData} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f1" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={90} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload[0]) {
                        const d = payload[0].payload
                        return (
                          <div className="bg-white rounded-lg p-2 shadow-lg text-xs" style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}>
                            <p className="font-semibold text-[#1a2e23]">{d.name} ({d.weight})</p>
                            <p className="text-[#3d5a4a]">{d.count} usos</p>
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {weightChartData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Tier breakdown pie */}
        {tierPieData.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-1.5">
                <CardTitle className="text-sm">Proporcion de Usos por Categoria</CardTitle>
                <InfoTooltip text="Porcentaje de usos de font-family que corresponden a Suisse (DS), fallbacks genericos, y fuentes a eliminar." />
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={tierPieData}
                    cx="50%"
                    cy="50%"
                    outerRadius={95}
                    innerRadius={50}
                    dataKey="value"
                    label={({ name, value }: { name?: string; value?: number }) => {
                      const pct = totalFamilyUsages > 0 && value ? (value / totalFamilyUsages * 100).toFixed(0) : 0
                      const short = (name || '').length > 20 ? (name || '').slice(0, 20) + '...' : (name || '')
                      return `${short} (${pct}%)`
                    }}
                    labelLine={{ stroke: "#3d5a4a", strokeWidth: 1 }}
                  >
                    {tierPieData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Row: Families + Weights side by side ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* ══════════════════════════════════════════════════════════════
           DETAIL LISTS — Families grouped by tier
         ══════════════════════════════════════════════════════════════ */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-1.5">
            <CardTitle className="text-sm">Todas las Familias Tipograficas</CardTitle>
            <InfoTooltip text="Clasificacion completa: izquierda = fuentes correctas (Suisse DS + fallbacks genericos), derecha = fuentes a eliminar (reemplazar por Suisse)." />
          </div>
        </CardHeader>
        <CardContent>
          {fontFamilies.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* LEFT COLUMN — OK fonts (DS + Generic) */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 px-3 py-2 bg-[#e0f5ec] rounded-lg">
                  <CheckCircle size={16} className="text-[#006c48]" />
                  <h4 className="text-sm font-semibold text-[#006c48]">
                    Correctas ({classified.ds.length + classified.generic.length})
                  </h4>
                </div>

                {/* DS fonts */}
                {classified.ds.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-[#006c48] uppercase tracking-wider mb-1.5 px-1">
                      Design System — Suisse ({classified.ds.length})
                    </p>
                    <ValueList
                      items={classified.ds}
                      renderValue={(item) => (
                        <div className="flex items-center gap-2">
                          <Badge className="bg-[#e0f5ec] text-[#006c48] text-[10px] shrink-0">DS</Badge>
                          <code className="text-sm font-mono text-[#1a2e23] truncate">{item.value}</code>
                        </div>
                      )}
                    />
                  </div>
                )}

                {/* Generic fallbacks */}
                {classified.generic.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-[#3d5a4a] uppercase tracking-wider mb-1.5 px-1">
                      Fallbacks genericos ({classified.generic.length})
                    </p>
                    <ValueList
                      items={classified.generic}
                      renderValue={(item) => (
                        <div className="flex items-center gap-2">
                          <Badge className="bg-[#f0f2f1] text-[#3d5a4a] text-[10px] shrink-0">generica</Badge>
                          <code className="text-sm font-mono text-[#3d5a4a] truncate">{item.value}</code>
                        </div>
                      )}
                    />
                  </div>
                )}

                {classified.ds.length === 0 && classified.generic.length === 0 && (
                  <p className="text-sm text-[#3d5a4a] py-4 text-center">No se encontraron fuentes correctas.</p>
                )}
              </div>

              {/* RIGHT COLUMN — Fonts to eliminate */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 px-3 py-2 bg-[#fef2f1] rounded-lg">
                  <XCircle size={16} className="text-[#9e2b25]" />
                  <h4 className="text-sm font-semibold text-[#9e2b25]">
                    A eliminar ({classified.eliminate.length})
                  </h4>
                </div>

                {classified.eliminate.length > 0 ? (
                  <div>
                    <p className="text-[10px] font-semibold text-[#9e2b25] uppercase tracking-wider mb-1.5 px-1">
                      Reemplazar por Suisse
                    </p>
                    <ValueList
                      items={classified.eliminate}
                      renderValue={(item) => (
                        <div className="flex items-center gap-2">
                          <Badge className="bg-[#fef2f1] text-[#9e2b25] text-[10px] shrink-0">eliminar</Badge>
                          <code className="text-sm font-mono text-[#9e2b25] truncate line-through">{item.value}</code>
                          <span className="text-[10px] text-[#3d5a4a]">→ Suisse</span>
                        </div>
                      )}
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <CheckCircle size={24} className="text-[#006c48] mb-2" />
                    <p className="text-sm font-semibold text-[#006c48]">Todo limpio</p>
                    <p className="text-xs text-[#3d5a4a]">No hay fuentes fuera del DS</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-[#3d5a4a] py-4 text-center">No se encontraron declaraciones font-family.</p>
          )}
        </CardContent>
      </Card>

      {/* ══════════════════════════════════════════════════════════════
           FONT WEIGHTS LIST
         ══════════════════════════════════════════════════════════════ */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-1.5">
            <CardTitle className="text-sm">Todos los Font-Weights</CardTitle>
            <InfoTooltip text="Lista completa de grosores con preview visual. Los pesos se normalizan: 'bold' = 700, 'normal' = 400, etc." />
          </div>
        </CardHeader>
        <CardContent>
          <ValueList
            items={fontWeights}
            renderValue={(item) => (
              <div className="flex items-center gap-3">
                <div
                  className="w-8 text-center rounded px-1 py-0.5 text-[10px] font-semibold text-white shrink-0"
                  style={{ backgroundColor: getWeightBarColor(item.normalized) }}
                >
                  {item.normalized}
                </div>
                <div>
                  <p className="text-sm font-mono text-[#1a2e23]" style={{ fontWeight: parseInt(item.normalized, 10) || 400 }}>
                    {item.value}
                  </p>
                  <p className="text-[10px] text-[#3d5a4a]">{getWeightLabel(item.normalized)}</p>
                </div>
              </div>
            )}
          />
        </CardContent>
      </Card>
      </div>

      {/* ══════════════════════════════════════════════════════════════
           FONT WEIGHT UNIFICATION TABLE
         ══════════════════════════════════════════════════════════════ */}
      {(() => {
        // DS weight consolidation rules:
        // 100 (Thin) ← stays
        // 200 (Extra Light) → 100
        // 300 (Light) → 100
        // 400 (Normal) ← stays (DS approved)
        // 500 (Medium) → 400
        // 600 (Semi Bold) ← stays
        // 700 (Bold) ← stays (DS approved)
        // 800 (Extra Bold) → 700
        // 900 (Black) → 700
        const DS_WEIGHT_TARGET: Record<string, string | null> = {
          "100": null,       // OK — DS weight
          "200": "100",      // Extra Light → Thin
          "300": "100",      // Light → Thin
          "400": null,       // OK — DS weight
          "500": "400",      // Medium → Normal
          "600": null,       // OK — keep
          "700": null,       // OK — DS weight
          "800": "700",      // Extra Bold → Bold
          "900": "700",      // Black → Bold
        }

        // Group weights by normalized value
        const groups = new Map<string, { normalized: string; variants: { value: string; count: number }[]; totalCount: number }>()
        for (const w of fontWeights) {
          const key = w.normalized
          if (!groups.has(key)) {
            groups.set(key, { normalized: key, variants: [], totalCount: 0 })
          }
          const g = groups.get(key)!
          g.variants.push({ value: w.value, count: w.count })
          g.totalCount += w.count
        }

        const allGroups = [...groups.values()].sort((a, b) => {
          const na = parseInt(a.normalized, 10)
          const nb = parseInt(b.normalized, 10)
          if (!isNaN(na) && !isNaN(nb)) return na - nb
          return a.normalized.localeCompare(b.normalized)
        })

        if (allGroups.length === 0) return null

        const actionsCount = allGroups.filter(g => {
          const target = DS_WEIGHT_TARGET[g.normalized]
          return target !== undefined && target !== null
        }).length + allGroups.filter(g => g.variants.length > 1).length

        return (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-1.5">
                <CardTitle className="text-sm">Equivalencias y Acciones de Font-Weight</CardTitle>
                <InfoTooltip text="Tabla de equivalencias con las acciones del Design System. Los pesos aprobados son 100 (Thin), 400 (Normal), 600 (Semi Bold) y 700 (Bold). El resto se debe consolidar." />
              </div>
              {actionsCount > 0 && (
                <p className="text-xs text-[#9e2b25]">
                  {actionsCount} accion{actionsCount !== 1 ? 'es' : ''} pendiente{actionsCount !== 1 ? 's' : ''} de unificacion
                </p>
              )}
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-lg border border-[#f0f2f1]">
                <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
                  <colgroup>
                    <col style={{ width: '60px' }} />
                    <col style={{ width: '90px' }} />
                    <col style={{ width: '140px' }} />
                    <col style={{ width: '55px' }} />
                    <col />
                  </colgroup>
                  <thead>
                    <tr className="bg-[#f8f9fa]">
                      <th className="text-center py-2 px-2 text-[11px] font-semibold text-[#1a2e23]">Peso</th>
                      <th className="text-left py-2 px-2 text-[11px] font-semibold text-[#1a2e23]">Nombre</th>
                      <th className="text-left py-2 px-2 text-[11px] font-semibold text-[#1a2e23]">Valores CSS</th>
                      <th className="text-center py-2 px-2 text-[11px] font-semibold text-[#1a2e23]">Usos</th>
                      <th className="text-left py-2 px-2 text-[11px] font-semibold text-[#1a2e23]">Accion DS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allGroups.map((g) => {
                      const hasDupes = g.variants.length > 1
                      const dsTarget = DS_WEIGHT_TARGET[g.normalized]
                      const needsConsolidation = dsTarget !== undefined && dsTarget !== null

                      return (
                        <tr key={g.normalized} className={`border-t border-[#f0f2f1] ${needsConsolidation ? 'bg-[#fef2f1]/30' : hasDupes ? 'bg-[#fef6e0]/30' : ''}`}>
                          <td className="py-2 px-2 text-center">
                            <div
                              className={`inline-block w-8 text-center rounded px-1 py-0.5 text-[10px] font-semibold text-white ${needsConsolidation ? 'line-through opacity-60' : ''}`}
                              style={{ backgroundColor: getWeightBarColor(g.normalized) }}
                            >
                              {g.normalized}
                            </div>
                          </td>
                          <td className={`py-2 px-2 text-[11px] ${needsConsolidation ? 'text-[#9e2b25] line-through' : 'text-[#3d5a4a]'}`}>
                            {getWeightLabel(g.normalized)}
                          </td>
                          <td className="py-2 px-2">
                            <div className="flex flex-wrap gap-1">
                              {g.variants.map((v, i) => (
                                <span key={i} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono ${
                                  needsConsolidation ? 'bg-[#fef2f1] text-[#9e2b25]' : hasDupes ? 'bg-[#fef6e0] text-[#a67c00]' : 'bg-[#f0f2f1] text-[#1a2e23]'
                                }`}>
                                  {v.value}
                                  <span className="text-[9px] opacity-60">{v.count}x</span>
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-2 px-2 text-center text-[11px] font-semibold text-[#1a2e23] tabular-nums">{g.totalCount}</td>
                          <td className="py-2 px-2">
                            {needsConsolidation ? (
                              <div className="flex items-center gap-1.5">
                                <Badge className="bg-[#fef2f1] text-[#9e2b25] text-[9px] shrink-0">Consolidar</Badge>
                                <span className="text-[10px] text-[#9e2b25]">
                                  → pasar a <strong>{dsTarget}</strong> ({getWeightLabel(dsTarget!)})
                                </span>
                              </div>
                            ) : hasDupes ? (
                              <div className="flex items-center gap-1.5">
                                <Badge className="bg-[#fef6e0] text-[#a67c00] text-[9px] shrink-0">Unificar</Badge>
                                <span className="text-[10px] text-[#a67c00]">
                                  → usar solo <strong>{g.normalized}</strong>
                                </span>
                              </div>
                            ) : (
                              <Badge className="bg-[#e0f5ec] text-[#006c48] text-[9px]">OK</Badge>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )
      })()}

      {/* ══════════════════════════════════════════════════════════════
           FONT SIZES SCALE
         ══════════════════════════════════════════════════════════════ */}
      {fontSizes.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-1.5">
              <CardTitle className="text-sm">Escala Tipografica (Font-Sizes)</CardTitle>
              <InfoTooltip text="Todos los tamanos de fuente usados. Una buena escala usa pocos tamanos coherentes (ej. 12, 14, 16, 20, 24, 32px)." />
            </div>
            <p className="text-xs text-[#3d5a4a]">
              {fontSizes.length} tamanos distintos — {fontSizes.length > 8
                ? "considera reducir a una escala mas consistente"
                : "buena consistencia"}
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {fontSizes.map((fs, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1.5 bg-[#f8f9fa] rounded-lg px-3 py-2 hover:bg-[#f0f2f1] transition-colors"
                >
                  <span className="text-sm font-mono text-[#1a2e23] font-semibold">{fs.value}</span>
                  <Badge variant="secondary" className="text-[10px]">{fs.count}x</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
