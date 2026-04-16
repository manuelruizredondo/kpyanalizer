import type { AnalysisResult } from "@/types/analysis"
import { MetricCard } from "@/components/overview/MetricCard"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Zap, Hash } from "lucide-react"

interface SpecificityTabProps {
  result: AnalysisResult
}

// App palette colors
const COLORS = {
  green: "#006c48",
  lightGreen1: "#2a9d6e",
  yellow: "#a67c00",
  red: "#9e2b25",
}

export function SpecificityTab({ result }: SpecificityTabProps) {
  // Get top 20 highest specificity selectors
  const topSelectors = [...result.specificityDistribution]
    .map(entry => ({
      ...entry,
      weight: entry.specificity[0] * 100 + entry.specificity[1] * 10 + entry.specificity[2]
    }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 20)

  // Prepare chart data for specificity distribution by weight
  const chartData = result.specificityDistribution
    .map((entry, idx) => ({
      index: idx + 1,
      weight: entry.specificity[0] * 100 + entry.specificity[1] * 10 + entry.specificity[2],
      specificity: `${entry.specificity[0]},${entry.specificity[1]},${entry.specificity[2]}`,
      selector: entry.selector,
      line: entry.line
    }))
    .slice(0, 100) // Show first 100 for the chart

  // Get specificity distribution buckets
  const buckets = { "Solo tipo": 0, "Clase": 0, "ID": 0 }
  for (const entry of result.specificityDistribution) {
    const [a] = entry.specificity
    if (a > 0) buckets["ID"]++
    else if (entry.specificity[1] > 0) buckets["Clase"]++
    else buckets["Solo tipo"]++
  }
  const distributionData = Object.entries(buckets).map(([name, count]) => ({ name, count }))

  // Color based on specificity level
  const getSpecificityColor = (weight: number) => {
    if (weight <= 30) return COLORS.lightGreen1
    if (weight <= 100) return COLORS.yellow
    return COLORS.red
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          label="Especificidad Máxima"
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

      {/* Specificity Weight Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Distribución de Peso de Especificidad</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis
                dataKey="index"
                tick={{ fontSize: 10 }}
                label={{ value: "Índice de Selector", position: "insideBottomRight", offset: -5 }}
              />
              <YAxis
                tick={{ fontSize: 10 }}
                label={{ value: "Peso de Especificidad", angle: -90, position: "insideLeft" }}
              />
              <Tooltip
                formatter={(value: any) => `${value}`}
                labelFormatter={(label: any) => `Selector #${label}`}
                content={({ active, payload }) => {
                  if (active && payload && payload[0]) {
                    const data = payload[0].payload
                    return (
                      <div className="bg-white p-2 border rounded shadow-lg text-xs">
                        <p className="font-semibold text-foreground">{data.selector}</p>
                        <p className="text-muted-foreground">Línea: {data.line}</p>
                        <p className="text-muted-foreground">Especificidad: {data.specificity}</p>
                        <p className="text-muted-foreground">Peso: {data.weight}</p>
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
          <CardTitle className="text-sm">Distribución por Tipo de Especificidad</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={distributionData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill={COLORS.lightGreen1} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Top 20 Highest Specificity Selectors Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Top 20 Selectores con Mayor Especificidad</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3 font-semibold text-muted-foreground">Selector</th>
                  <th className="text-center py-2 px-3 font-semibold text-muted-foreground">Especificidad</th>
                  <th className="text-center py-2 px-3 font-semibold text-muted-foreground">Peso</th>
                  <th className="text-center py-2 px-3 font-semibold text-muted-foreground">Línea</th>
                </tr>
              </thead>
              <tbody>
                {topSelectors.map((selector, idx) => (
                  <tr key={idx} className="border-b hover:bg-muted/50">
                    <td className="py-2 px-3">
                      <code className="text-xs bg-muted px-2 py-1 rounded max-w-xs block truncate">
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
                    <td className="text-center py-2 px-3 text-muted-foreground">
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
