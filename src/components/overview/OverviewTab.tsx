import { HealthScore } from "./HealthScore"
import { MetricCard } from "./MetricCard"
import type { AnalysisResult } from "@/types/analysis"
import {
  Hash, AtSign, AlertTriangle, Copy, Palette, Type, Ruler,
  Layers, Monitor, Play, FileText, Variable, Percent, Code
} from "lucide-react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts"

interface OverviewTabProps {
  result: AnalysisResult
}

const PIE_COLORS = ["#3b82f6", "#ef4444", "#f59e0b", "#10b981", "#8b5cf6"]

export function OverviewTab({ result }: OverviewTabProps) {
  const specificityData = getSpecificityBuckets(result)
  const hardcodedData = [
    { name: "Colores", value: result.colors.length },
    { name: "Font sizes", value: result.fontSizes.length },
    { name: "Spacing", value: result.spacingValues.length },
    { name: "Z-index", value: result.zIndexValues.length },
    { name: "!important", value: result.importantCount },
  ].filter(d => d.value > 0)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-6">
        <HealthScore score={result.healthScore} />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          <MetricCard label="Peso" value={`${(result.fileSize / 1024).toFixed(1)} KB`} icon={FileText} />
          <MetricCard label="Lineas" value={result.lineCount} icon={Code} />
          <MetricCard label="Clases" value={result.classCount} icon={Hash} />
          <MetricCard label="IDs" value={result.idCount} icon={AtSign} variant={result.idCount > 5 ? "warning" : "default"} />
          <MetricCard label="!important" value={result.importantCount} icon={AlertTriangle} variant={result.importantCount > 5 ? "danger" : result.importantCount > 0 ? "warning" : "default"} />
          <MetricCard label="Selectores dup." value={result.duplicateSelectors.length} icon={Copy} variant={result.duplicateSelectors.length > 10 ? "danger" : result.duplicateSelectors.length > 0 ? "warning" : "default"} />
          <MetricCard label="Colores HC" value={result.colors.length} icon={Palette} />
          <MetricCard label="Font sizes HC" value={result.fontSizes.length} icon={Type} />
          <MetricCard label="Spacing HC" value={result.spacingValues.length} icon={Ruler} />
          <MetricCard label="Z-index HC" value={result.zIndexValues.length} icon={Layers} />
          <MetricCard label="Media queries" value={result.mediaQueries.length} icon={Monitor} />
          <MetricCard label="Keyframes" value={result.keyframes.length} icon={Play} />
          <MetricCard label="CSS Variables" value={result.variableCount} icon={Variable} variant="success" />
          <MetricCard label="Ratio reutilizacion" value={`${(result.reuseRatio * 100).toFixed(0)}%`} icon={Percent} description={`${result.uniqueDeclarations} unicas / ${result.totalDeclarations} total`} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {specificityData.length > 0 && (
          <div className="rounded-lg border p-4">
            <h4 className="text-sm font-semibold mb-4">Distribucion de Especificidad</h4>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={specificityData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {hardcodedData.length > 0 && (
          <div className="rounded-lg border p-4">
            <h4 className="text-sm font-semibold mb-4">Valores Hardcodeados</h4>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={hardcodedData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {hardcodedData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
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
