import { FileDropZone } from "@/components/input/FileDropZone"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow
} from "@/components/ui/table"
import { Palette, Type, Ruler, Layers, Upload } from "lucide-react"
import type { DsTokenSet, DsCoverageResult, DsCategoryResult } from "@/types/design-system"
import type { AnalysisResult } from "@/types/analysis"

interface DesignSystemTabProps {
  tokens: DsTokenSet | null
  coverage: DsCoverageResult | null
  error: string | null
  fileName: string | null
  onLoadTokens: (content: string, fileName: string) => void
  result: AnalysisResult | null
}

export function DesignSystemTab({ tokens, coverage, error, fileName, onLoadTokens, result }: DesignSystemTabProps) {
  return (
    <div className="space-y-6">
      {/* Token Upload */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Tokens del Design System</h3>
        {!tokens ? (
          <FileDropZone onFileContent={onLoadTokens} accept=".json,.css" className="min-h-[120px]">
            <div className="flex flex-col items-center justify-center gap-2 p-6 text-muted-foreground">
              <Upload className="h-8 w-8" />
              <p className="text-sm font-medium">Carga tus tokens del Design System</p>
              <p className="text-xs">Acepta JSON (Style Dictionary, Figma Tokens) o CSS con custom properties</p>
            </div>
          </FileDropZone>
        ) : (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{fileName}</p>
                  <p className="text-xs text-muted-foreground">
                    {tokens.colors.length} colores, {tokens.fontSizes.length} font-sizes,{" "}
                    {tokens.spacing.length} spacing, {tokens.zIndex.length} z-index
                  </p>
                </div>
                <Badge variant="secondary">Cargado</Badge>
              </div>
            </CardContent>
          </Card>
        )}
        {error && <p className="text-sm text-destructive mt-2">{error}</p>}
      </div>

      {!result && (
        <p className="text-sm text-muted-foreground text-center py-8">
          Carga un CSS para comparar contra los tokens del Design System.
        </p>
      )}

      {coverage && (
        <div className="space-y-6">
          {/* Overall Coverage */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold">Cobertura DS General</h4>
                <span className="text-2xl font-bold">{coverage.overallCoverage.toFixed(0)}%</span>
              </div>
              <Progress value={coverage.overallCoverage} className="h-3" />
            </CardContent>
          </Card>

          {/* Category Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CategoryCard
              icon={Palette}
              label="Colores"
              category={coverage.colors}
            />
            <CategoryCard
              icon={Type}
              label="Font Sizes"
              category={coverage.fontSizes}
            />
            <CategoryCard
              icon={Ruler}
              label="Spacing"
              category={coverage.spacing}
            />
            <CategoryCard
              icon={Layers}
              label="Z-index"
              category={coverage.zIndex}
            />
          </div>

          {/* Mismatches Detail */}
          {coverage.colors.mismatches.length > 0 && (
            <MismatchSection label="Colores fuera del DS" mismatches={coverage.colors.mismatches} isColor />
          )}
          {coverage.fontSizes.mismatches.length > 0 && (
            <MismatchSection label="Font-sizes fuera del DS" mismatches={coverage.fontSizes.mismatches} />
          )}
          {coverage.spacing.mismatches.length > 0 && (
            <MismatchSection label="Spacing fuera del DS" mismatches={coverage.spacing.mismatches} />
          )}
          {coverage.zIndex.mismatches.length > 0 && (
            <MismatchSection label="Z-index fuera del DS" mismatches={coverage.zIndex.mismatches} />
          )}
        </div>
      )}
    </div>
  )
}

function CategoryCard({ icon: Icon, label, category }: {
  icon: React.ElementType
  label: string
  category: DsCategoryResult
}) {
  const coverageColor = category.coverage >= 80
    ? "text-green-600"
    : category.coverage >= 50
      ? "text-yellow-600"
      : "text-red-600"

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <h4 className="text-sm font-semibold">{label}</h4>
        </div>
        <div className="flex items-end justify-between mb-2">
          <span className="text-xs text-muted-foreground">
            {category.matchedToDs} de {category.totalUsed} valores en el DS
          </span>
          <span className={`text-lg font-bold ${coverageColor}`}>
            {category.coverage.toFixed(0)}%
          </span>
        </div>
        <Progress value={category.coverage} className="h-2" />
        {category.mismatches.length > 0 && (
          <p className="text-xs text-muted-foreground mt-2">
            {category.mismatches.length} valores fuera del DS
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function MismatchSection({ label, mismatches, isColor = false }: {
  label: string
  mismatches: DsCategoryResult["mismatches"]
  isColor?: boolean
}) {
  return (
    <section>
      <h4 className="text-sm font-semibold mb-2">{label}</h4>
      <Table>
        <TableHeader>
          <TableRow>
            {isColor && <TableHead className="w-10"></TableHead>}
            <TableHead>Valor usado</TableHead>
            <TableHead>Token DS mas cercano</TableHead>
            <TableHead>Ubicaciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {mismatches.map((m, i) => (
            <TableRow key={i}>
              {isColor && (
                <TableCell>
                  <div
                    className="w-6 h-6 rounded border"
                    style={{ backgroundColor: m.value }}
                  />
                </TableCell>
              )}
              <TableCell className="font-mono text-xs">{m.value}</TableCell>
              <TableCell className="font-mono text-xs">
                {m.closestDsValue ? (
                  <div className="flex items-center gap-2">
                    {isColor && (
                      <div
                        className="w-4 h-4 rounded border"
                        style={{ backgroundColor: m.closestDsValue }}
                      />
                    )}
                    {m.closestDsValue}
                  </div>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {m.locations.slice(0, 3).map(l => `L${l.line}`).join(", ")}
                {m.locations.length > 3 && ` (+${m.locations.length - 3})`}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  )
}
