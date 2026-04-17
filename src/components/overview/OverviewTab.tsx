import { HealthScore } from "./HealthScore"
import { MetricCard } from "./MetricCard"
import type { AnalysisResult } from "@/types/analysis"
import {
  Hash, AtSign, AlertTriangle, Copy,
  Layers, Monitor, Play, FileText, Variable, Percent, Code, Zap, Package
} from "lucide-react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface OverviewTabProps {
  result: AnalysisResult
}

// App palette colors
const COLORS = {
  green: "#006c48",
  lightGreen1: "#2a9d6e",
  lightGreen2: "#5cc49a",
  yellow: "#a67c00",
  red: "#9e2b25",
  darkText: "#1a2e23",
  mutedText: "#3d5a4a",
  lightBg: "#f8f9fa",
  lightBg2: "#f0f2f1",
}

const PIE_COLORS = [COLORS.lightGreen1, COLORS.yellow, COLORS.red, "#8b5cf6", "#10b981"]

function getComplexityColor(rating: string) {
  switch (rating) {
    case "low":
      return { bg: "bg-green-50", text: "text-green-700", badge: "bg-green-200 text-green-800" }
    case "medium":
      return { bg: "bg-yellow-50", text: "text-yellow-700", badge: "bg-yellow-200 text-yellow-800" }
    case "high":
      return { bg: "bg-orange-50", text: "text-orange-700", badge: "bg-orange-200 text-orange-800" }
    case "critical":
      return { bg: "bg-red-50", text: "text-red-700", badge: "bg-red-200 text-red-800" }
  }
}

function getComplexityLabel(rating: string) {
  switch (rating) {
    case "low": return "Baja"
    case "medium": return "Media"
    case "high": return "Alta"
    case "critical": return "Crítica"
  }
}

function getComplexityExplanation(rating: string) {
  switch (rating) {
    case "low": return "CSS bien estructurado con buenas prácticas"
    case "medium": return "CSS moderadamente complejo, considera optimizaciones"
    case "high": return "CSS complejo, se recomienda refactorización"
    case "critical": return "CSS muy complejo, refactorización urgente"
  }
}

export function OverviewTab({ result }: OverviewTabProps) {
  const specificityData = getSpecificityBuckets(result)
  const hardcodedData = [
    { name: "Colores", value: result.colors.length },
    { name: "Font sizes", value: result.fontSizes.length },
    { name: "Spacing", value: result.spacingValues.length },
    { name: "Z-index", value: result.zIndexValues.length },
    { name: "!important", value: result.importantCount },
  ].filter(d => d.value > 0)

  const shorthandRatio = result.shorthandCount + result.longhandCount > 0
    ? (result.shorthandCount / (result.shorthandCount + result.longhandCount)) * 100
    : 0

  const summary = `${result.totalSelectors} selectores, ${result.totalDeclarations} declaraciones, ${(result.reuseRatio * 100).toFixed(0)}% reutilización`

  return (
    <div className="space-y-6">
      {/* Top Section: Health Score + Complexity */}
      <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr_auto] gap-6 items-start">
        <HealthScore score={result.healthScore} />

        <div className="flex flex-col justify-center gap-2">
          <p className="text-sm font-medium text-muted-foreground">Resumen</p>
          <p className="text-base font-semibold text-foreground">{summary}</p>
        </div>

        {/* Complexity Badge */}
        <div className={cn("p-4 rounded-xl", getComplexityColor(result.complexityRating)?.bg)}>
          <p className="text-xs font-medium text-muted-foreground mb-2">Complejidad</p>
          <div className={cn("px-3 py-1.5 rounded-md text-sm font-semibold text-center mb-2", getComplexityColor(result.complexityRating)?.badge)}>
            {getComplexityLabel(result.complexityRating)}
          </div>
          <p className="text-xs text-muted-foreground">{getComplexityExplanation(result.complexityRating)}</p>
        </div>
      </div>

      {/* Metrics Grid - 6 columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* File & Structure */}
        <MetricCard label="Peso" value={`${(result.fileSize / 1024).toFixed(1)} KB`} icon={FileText} description="Tamaño del archivo CSS" />
        <MetricCard label="Líneas" value={result.lineCount} icon={Code} description="Total de líneas de código" />
        <MetricCard label="Selectores" value={result.totalSelectors} icon={Hash} description="Reglas CSS definidas" />
        <MetricCard label="Declaraciones" value={result.totalDeclarations} icon={Zap} description="Propiedades escritas en total" />
        <MetricCard label="Decl. únicas" value={result.uniqueDeclarations} icon={Package} description="Propiedades no repetidas" />
        <MetricCard label="Reutilización" value={`${(result.reuseRatio * 100).toFixed(0)}%`} icon={Percent} description="% de declaraciones repetidas vs únicas" />

        {/* Selectors & IDs */}
        <MetricCard label="Clases" value={result.classCount} icon={Hash} variant="success" description="Selectores .clase usados" />
        <MetricCard label="IDs" value={result.idCount} icon={AtSign} variant={result.idCount > 5 ? "danger" : "default"} description="Selectores #id — evítalos" />
        <MetricCard label="!important" value={result.importantCount} icon={AlertTriangle} variant={result.importantCount > 5 ? "danger" : result.importantCount > 0 ? "warning" : "default"} description="Fuerza la prioridad, indica problemas" />
        <MetricCard label="Selectores univ." value={result.universalSelectorCount} icon={Zap} variant={result.universalSelectorCount > 10 ? "warning" : "default"} description="Uso de * — afecta rendimiento" />
        <MetricCard label="Selectores attr." value={result.attributeSelectorCount} icon={Hash} description="Selectores tipo [type='text']" />
        <MetricCard label="Pseudo-clases" value={result.pseudoClassCount} icon={Code} description=":hover, :focus, :nth-child..." />

        {/* Pseudo-elements & Vendor */}
        <MetricCard label="Pseudo-elem." value={result.pseudoElementCount} icon={Code} description="::before, ::after, ::placeholder" />
        <MetricCard label="Prefijos vendor" value={result.vendorPrefixCount} icon={AlertTriangle} variant={result.vendorPrefixCount > 10 ? "warning" : "default"} description="-webkit-, -moz- — usa autoprefixer" />
        <MetricCard label="Shorthand" value={result.shorthandCount} icon={Package} variant="success" description="margin, padding, background..." />
        <MetricCard label="Longhand" value={result.longhandCount} icon={Code} description="margin-top, padding-left... unificables" />
        <MetricCard label="Variables CSS" value={result.variableCount} icon={Variable} variant="success" description="Custom properties --var definidas" />
        <MetricCard label="Media queries" value={result.mediaQueries.length} icon={Monitor} description="Breakpoints responsive" />

        {/* Specificity */}
        <MetricCard label="Max especif." value={`${result.maxSpecificity[0]},${result.maxSpecificity[1]},${result.maxSpecificity[2]}`} icon={Zap} variant={result.maxSpecificity[0] > 0 ? "danger" : "default"} description="Especificidad más alta (a,b,c)" />
        <MetricCard label="Prom. especif." value={result.avgSpecificity.toFixed(1)} icon={Code} description="Media ponderada de especificidad" />
        <MetricCard label="Anidamiento" value={result.deepestNesting} icon={Layers} description="Profundidad máxima de reglas" />
        <MetricCard label="Duplicados sel." value={result.duplicateSelectors.length} icon={Copy} variant={result.duplicateSelectors.length > 10 ? "danger" : result.duplicateSelectors.length > 0 ? "warning" : "default"} description="Misma regla repetida en el CSS" />
        <MetricCard label="Duplicados decl." value={result.duplicateDeclarations.length} icon={Copy} variant={result.duplicateDeclarations.length > 10 ? "danger" : result.duplicateDeclarations.length > 0 ? "warning" : "default"} description="Misma propiedad:valor repetida" />
        <MetricCard label="Keyframes" value={result.keyframes.length} icon={Play} description="Animaciones @keyframes definidas" />
      </div>

      {/* Shorthand Efficiency Bar */}
      <Card>
        <CardContent className="p-4">
          <h4 className="text-sm font-semibold mb-1">Eficiencia Shorthand vs Longhand</h4>
          <p className="text-xs text-muted-foreground mb-3">Shorthand (margin, padding...) es más limpio que longhand (margin-top, margin-right...). Más verde = mejor.</p>
          <div className="space-y-2">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="h-6 bg-gray-200 rounded-full overflow-hidden flex">
                  <div
                    className="bg-green-500 transition-all"
                    style={{ width: `${shorthandRatio}%` }}
                  />
                  <div
                    className="bg-orange-400"
                    style={{ width: `${100 - shorthandRatio}%` }}
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Shorthand: {result.shorthandCount} ({shorthandRatio.toFixed(0)}%)</span>
              <span>Longhand: {result.longhandCount} ({(100 - shorthandRatio).toFixed(0)}%)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {specificityData.length > 0 && (
          <div className="rounded-lg border p-4">
            <h4 className="text-sm font-semibold mb-1">Distribución de Especificidad</h4>
            <p className="text-xs text-muted-foreground mb-3">Cómo se reparten tus selectores: tipo (div, p), clase (.btn) o ID (#header). Menos IDs = mejor.</p>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={specificityData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill={COLORS.lightGreen1} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {hardcodedData.length > 0 && (
          <div className="rounded-lg border p-4">
            <h4 className="text-sm font-semibold mb-1">Valores Hardcodeados</h4>
            <p className="text-xs text-muted-foreground mb-3">Valores escritos directamente en vez de usar variables CSS o tokens del design system.</p>
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
