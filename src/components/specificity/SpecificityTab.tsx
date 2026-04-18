import { useMemo } from "react"
import type { AnalysisResult } from "@/types/analysis"
import { MetricCard } from "@/components/overview/MetricCard"
import {
  BarChart, Bar, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Zap, Hash, TrendingUp, AlertTriangle, Info } from "lucide-react"

interface SpecificityTabProps {
  result: AnalysisResult
}

// App palette colors
const COLORS = {
  green: "#006c48",
  lightGreen1: "#2a9d6e",
  lightGreen2: "#5cc49a",
  yellow: "#a67c00",
  red: "#9e2b25",
  dark: "#1a2e23",
  muted: "#3d5a4a",
  bg: "#f0f2f1",
}

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

// ─── Specificity Graph Health Assessment ──────────────────────────
function assessSpecificityGraph(data: { weight: number; line: number }[]): {
  score: "bueno" | "aceptable" | "malo"
  color: string
  label: string
  description: string
} {
  if (data.length < 5) {
    return { score: "aceptable", color: COLORS.yellow, label: "Datos insuficientes", description: "Se necesitan mas selectores para evaluar la tendencia." }
  }

  // Divide into quartiles and check if the trend is upward
  const quartileSize = Math.floor(data.length / 4)
  const q1Avg = data.slice(0, quartileSize).reduce((s, d) => s + d.weight, 0) / quartileSize
  const q4Avg = data.slice(-quartileSize).reduce((s, d) => s + d.weight, 0) / quartileSize

  // Count big backward drops (a high-specificity selector followed by lower ones)
  let bigDrops = 0
  for (let i = 1; i < data.length; i++) {
    if (data[i].weight < data[i - 1].weight - 20) bigDrops++
  }
  const dropRatio = bigDrops / data.length

  if (q4Avg >= q1Avg && dropRatio < 0.15) {
    return { score: "bueno", color: COLORS.green, label: "Tendencia ascendente", description: "Tu CSS sigue un buen patron de especificidad: los selectores mas especificos estan al final. Esto facilita el mantenimiento." }
  }
  if (q4Avg >= q1Avg * 0.7 && dropRatio < 0.3) {
    return { score: "aceptable", color: COLORS.yellow, label: "Tendencia irregular", description: "La tendencia general es aceptable pero hay varios picos y valles. Considera reorganizar los selectores de alta especificidad hacia el final del archivo." }
  }
  return { score: "malo", color: COLORS.red, label: "Tendencia erratica", description: "Tu CSS tiene guerras de especificidad: selectores muy especificos aparecen antes que otros mas ligeros. Reorganiza para que la especificidad crezca progresivamente." }
}

// ─── Moving Average for trend line ────────────────────────────────
function movingAverage(data: number[], window: number): number[] {
  const result: number[] = []
  for (let i = 0; i < data.length; i++) {
    const start = Math.max(0, i - Math.floor(window / 2))
    const end = Math.min(data.length, i + Math.ceil(window / 2))
    const slice = data.slice(start, end)
    result.push(slice.reduce((a, b) => a + b, 0) / slice.length)
  }
  return result
}

export function SpecificityTab({ result }: SpecificityTabProps) {
  // ── Derived data ──
  const allEntries = useMemo(() =>
    result.specificityDistribution.map((entry, idx) => ({
      ...entry,
      weight: entry.specificity[0] * 100 + entry.specificity[1] * 10 + entry.specificity[2],
      index: idx + 1,
    })),
    [result.specificityDistribution]
  )

  // Top 20 highest specificity selectors
  const topSelectors = useMemo(() =>
    [...allEntries].sort((a, b) => b.weight - a.weight).slice(0, 20),
    [allEntries]
  )

  // ── Specificity Graph data (Harry Roberts) ──
  // Uses ALL selectors in source order
  const specificityGraphData = useMemo(() => {
    const weights = allEntries.map(e => e.weight)
    const trend = movingAverage(weights, Math.max(5, Math.floor(allEntries.length / 20)))

    return allEntries.map((entry, i) => ({
      index: entry.index,
      weight: entry.weight,
      trend: +trend[i].toFixed(1),
      selector: entry.selector,
      line: entry.line,
      specificity: `${entry.specificity[0]},${entry.specificity[1]},${entry.specificity[2]}`,
    }))
  }, [allEntries])

  const graphAssessment = useMemo(() => assessSpecificityGraph(allEntries), [allEntries])

  // Distribution buckets
  const distributionData = useMemo(() => {
    const buckets = { "Solo tipo (0,0,n)": 0, "Clase (0,n,n)": 0, "ID (n,n,n)": 0 }
    for (const entry of result.specificityDistribution) {
      if (entry.specificity[0] > 0) buckets["ID (n,n,n)"]++
      else if (entry.specificity[1] > 0) buckets["Clase (0,n,n)"]++
      else buckets["Solo tipo (0,0,n)"]++
    }
    return Object.entries(buckets).map(([name, count]) => ({ name, count }))
  }, [result.specificityDistribution])

  // Color based on specificity level
  const getSpecificityColor = (weight: number) => {
    if (weight <= 10) return COLORS.lightGreen1
    if (weight <= 30) return COLORS.green
    if (weight <= 100) return COLORS.yellow
    return COLORS.red
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          label="Especificidad Maxima"
          value={`${result.maxSpecificity[0]},${result.maxSpecificity[1]},${result.maxSpecificity[2]}`}
          icon={Zap}
          variant={result.maxSpecificity[0] > 0 ? "danger" : "default"}
        />
        <MetricCard
          label="Especificidad Promedio"
          value={result.avgSpecificity.toFixed(1)}
          icon={Hash}
        />
        <MetricCard
          label="Total de Selectores"
          value={result.totalSelectors}
          icon={Hash}
        />
        <MetricCard
          label="Selectores con ID"
          value={result.specificityDistribution.filter(s => s.specificity[0] > 0).length}
          icon={Zap}
          variant="danger"
        />
      </div>

      {/* ══════════════════════════════════════════════════════════════
           THE SPECIFICITY GRAPH — Harry Roberts / CSS Wizardry
         ══════════════════════════════════════════════════════════════ */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-semibold text-[#1a2e23]">
                  The Specificity Graph
                </CardTitle>
                <InfoTooltip text="Concepto de Harry Roberts (CSS Wizardry). Plotea la especificidad de cada selector en el orden en que aparece en tu CSS. Lo ideal es una tendencia ascendente: selectores ligeros al principio y los mas especificos al final." />
              </div>
              <p className="text-xs text-[#3d5a4a] mt-1">
                Posicion en la hoja de estilos (eje X) vs. peso de especificidad (eje Y)
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: graphAssessment.color }}
              />
              <div className="text-right">
                <p className="text-sm font-semibold" style={{ color: graphAssessment.color }}>
                  {graphAssessment.label}
                </p>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {/* Assessment banner */}
          <div
            className="rounded-lg px-4 py-3 mb-4 flex items-start gap-3"
            style={{ backgroundColor: `${graphAssessment.color}10` }}
          >
            {graphAssessment.score === "bueno" ? (
              <TrendingUp size={18} className="shrink-0 mt-0.5" style={{ color: graphAssessment.color }} />
            ) : (
              <AlertTriangle size={18} className="shrink-0 mt-0.5" style={{ color: graphAssessment.color }} />
            )}
            <p className="text-xs leading-relaxed" style={{ color: COLORS.dark }}>
              {graphAssessment.description}
            </p>
          </div>

          {/* The Graph */}
          <ResponsiveContainer width="100%" height={350}>
            <AreaChart data={specificityGraphData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="specGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.lightGreen1} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={COLORS.lightGreen1} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.bg} />
              <XAxis
                dataKey="index"
                tick={{ fontSize: 10, fill: COLORS.muted }}
                tickLine={false}
                axisLine={{ stroke: COLORS.bg }}
                label={{ value: "Posicion en stylesheet →", position: "insideBottomRight", offset: -5, style: { fontSize: 10, fill: COLORS.muted } }}
              />
              <YAxis
                tick={{ fontSize: 10, fill: COLORS.muted }}
                tickLine={false}
                axisLine={{ stroke: COLORS.bg }}
                label={{ value: "Especificidad ↑", angle: -90, position: "insideLeft", offset: 10, style: { fontSize: 10, fill: COLORS.muted } }}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload[0]) {
                    const d = payload[0].payload
                    return (
                      <div className="bg-white rounded-xl p-3 shadow-lg border-0 text-xs max-w-xs" style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.12)' }}>
                        <p className="font-semibold text-[#1a2e23] truncate mb-1">{d.selector}</p>
                        <div className="space-y-0.5 text-[#3d5a4a]">
                          <p>Linea: <span className="font-mono">{d.line}</span></p>
                          <p>Especificidad: <span className="font-mono">{d.specificity}</span></p>
                          <p>Peso: <span className="font-semibold" style={{ color: getSpecificityColor(d.weight) }}>{d.weight}</span></p>
                        </div>
                      </div>
                    )
                  }
                  return null
                }}
              />
              {/* ID threshold line */}
              <ReferenceLine
                y={100}
                stroke={COLORS.red}
                strokeDasharray="6 3"
                strokeOpacity={0.5}
                label={{ value: "ID (100+)", position: "insideTopRight", style: { fontSize: 9, fill: COLORS.red } }}
              />
              {/* Area fill */}
              <Area
                type="monotone"
                dataKey="weight"
                stroke={COLORS.lightGreen1}
                strokeWidth={1}
                fill="url(#specGrad)"
                dot={false}
                activeDot={{ r: 4, fill: COLORS.green, stroke: "#fff", strokeWidth: 2 }}
                name="Peso"
                isAnimationActive={false}
              />
              {/* Trend line (moving average) */}
              <Line
                type="monotone"
                dataKey="trend"
                stroke={COLORS.dark}
                strokeWidth={2}
                strokeDasharray="4 2"
                dot={false}
                activeDot={false}
                name="Tendencia"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>

          {/* Legend */}
          <div className="flex items-center justify-center gap-6 mt-2">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-0.5 rounded" style={{ backgroundColor: COLORS.lightGreen1 }} />
              <span className="text-[10px] text-[#3d5a4a]">Peso de cada selector</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-0.5 rounded" style={{ backgroundColor: COLORS.dark, borderStyle: "dashed" }} />
              <span className="text-[10px] text-[#3d5a4a]">Tendencia (media movil)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-0.5 rounded" style={{ backgroundColor: COLORS.red, opacity: 0.5 }} />
              <span className="text-[10px] text-[#3d5a4a]">Umbral ID (100+)</span>
            </div>
          </div>

          {/* Explanation text */}
          <div className="mt-4 p-3 bg-[#f8f9fa] rounded-lg">
            <p className="text-xs text-[#3d5a4a] leading-relaxed">
              <strong className="text-[#1a2e23]">Como leer este grafico:</strong> Lo ideal es que la linea de tendencia suba progresivamente — selectores de tipo al inicio, clases en el medio y utilidades/overrides al final. Picos altos al principio indican selectores demasiado especificos que fuerzan a los siguientes a usar mas especificidad para sobreescribirlos (guerras de especificidad).
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── Row: Weight Distribution + Type Distribution ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Specificity Weight Chart (original bar chart, now the secondary view) */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-1.5">
            <CardTitle className="text-sm">Distribucion de Peso de Especificidad</CardTitle>
            <InfoTooltip text="Grafico de barras mostrando el peso individual de los primeros 100 selectores. Util para identificar picos concretos." />
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={specificityGraphData.slice(0, 100)}>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.bg} />
              <XAxis
                dataKey="index"
                tick={{ fontSize: 10 }}
                label={{ value: "Indice de Selector", position: "insideBottomRight", offset: -5, style: { fontSize: 10 } }}
              />
              <YAxis
                tick={{ fontSize: 10 }}
                label={{ value: "Peso", angle: -90, position: "insideLeft", style: { fontSize: 10 } }}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload[0]) {
                    const data = payload[0].payload
                    return (
                      <div className="bg-white p-2 border rounded shadow-lg text-xs">
                        <p className="font-semibold text-[#1a2e23]">{data.selector}</p>
                        <p className="text-[#3d5a4a]">Linea: {data.line}</p>
                        <p className="text-[#3d5a4a]">Especificidad: {data.specificity}</p>
                        <p className="text-[#3d5a4a]">Peso: {data.weight}</p>
                      </div>
                    )
                  }
                  return null
                }}
              />
              <Bar dataKey="weight" fill={COLORS.lightGreen1} radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Distribution Chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-1.5">
            <CardTitle className="text-sm">Distribucion por Tipo de Especificidad</CardTitle>
            <InfoTooltip text="Cuantos selectores caen en cada categoria: solo tipo (h1, div), clase (.btn, .card), o ID (#header). Lo ideal es que la mayoria sean de clase." />
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={distributionData}>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.bg} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill={COLORS.lightGreen1} radius={[4, 4, 0, 0]} name="Selectores" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      </div>

      {/* Top 20 Highest Specificity Selectors Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-1.5">
            <CardTitle className="text-sm">Top 20 Selectores con Mayor Especificidad</CardTitle>
            <InfoTooltip text="Los 20 selectores mas pesados de tu CSS. Estos son los principales candidatos a refactorizar si quieres reducir la especificidad." />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3 font-semibold text-[#3d5a4a]">Selector</th>
                  <th className="text-center py-2 px-3 font-semibold text-[#3d5a4a]">Especificidad</th>
                  <th className="text-center py-2 px-3 font-semibold text-[#3d5a4a]">Peso</th>
                  <th className="text-center py-2 px-3 font-semibold text-[#3d5a4a]">Linea</th>
                </tr>
              </thead>
              <tbody>
                {topSelectors.map((selector, idx) => (
                  <tr key={idx} className="border-b hover:bg-[#f8f9fa]">
                    <td className="py-2 px-3">
                      <code className="text-xs bg-[#f0f2f1] px-2 py-1 rounded max-w-xs block truncate">
                        {selector.selector}
                      </code>
                    </td>
                    <td className="text-center py-2 px-3">
                      <span className="text-xs font-mono">
                        {selector.specificity[0]},{selector.specificity[1]},{selector.specificity[2]}
                      </span>
                    </td>
                    <td className="text-center py-2 px-3">
                      <span
                        className="inline-block px-2 py-1 rounded text-xs font-semibold text-white"
                        style={{ backgroundColor: getSpecificityColor(selector.weight) }}
                      >
                        {selector.weight}
                      </span>
                    </td>
                    <td className="text-center py-2 px-3 text-[#3d5a4a]">
                      {selector.line}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
