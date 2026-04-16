import { useState } from "react"
import { FileDropZone } from "@/components/input/FileDropZone"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow
} from "@/components/ui/table"
import { Palette, Type, Ruler, Layers, Upload, Link, Loader2, X, AlertTriangle } from "lucide-react"
import type { DsTokenSet, DsCoverageResult, DsCategoryResult, DsRedundant } from "@/types/design-system"
import type { AnalysisResult } from "@/types/analysis"

interface DesignSystemTabProps {
  tokens: DsTokenSet | null
  coverage: DsCoverageResult | null
  error: string | null
  fileName: string | null
  loading?: boolean
  onLoadTokens: (content: string, fileName: string) => void
  onLoadFromUrl?: (url: string) => Promise<unknown>
  onReset?: () => void
  result: AnalysisResult | null
}

export function DesignSystemTab({
  tokens, coverage, error, fileName, loading,
  onLoadTokens, onLoadFromUrl, onReset, result
}: DesignSystemTabProps) {
  const [urlInput, setUrlInput] = useState("")
  const [showUrlInput, setShowUrlInput] = useState(false)

  const handleLoadUrl = async () => {
    if (!urlInput.trim() || !onLoadFromUrl) return
    await onLoadFromUrl(urlInput.trim())
    setShowUrlInput(false)
  }

  return (
    <div className="space-y-6">
      {/* Token Upload */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Tokens del Design System</h3>
        {!tokens ? (
          <div className="space-y-3">
            {!showUrlInput ? (
              <>
                <FileDropZone onFileContent={onLoadTokens} accept=".json,.css" className="min-h-[120px]">
                  <div className="flex flex-col items-center justify-center gap-2 p-6 text-muted-foreground">
                    <Upload className="h-8 w-8" />
                    <p className="text-sm font-medium">Carga tus tokens del Design System</p>
                    <p className="text-xs">Acepta JSON (Style Dictionary, Figma Tokens) o CSS con custom properties</p>
                  </div>
                </FileDropZone>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground">o</span>
                  <div className="flex-1 h-px bg-border" />
                </div>
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => setShowUrlInput(true)}
                >
                  <Link size={16} />
                  Cargar desde URL
                </Button>
              </>
            ) : (
              <Card>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Link size={16} className="text-muted-foreground shrink-0" />
                    <input
                      type="url"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      placeholder="https://ejemplo.com/framework.css"
                      className="flex-1 px-3 py-2 bg-[#f8f9fa] rounded-lg border-0 text-sm focus:outline-none focus:ring-2 focus:ring-[#006c48]"
                      autoFocus
                      onKeyDown={(e) => e.key === 'Enter' && handleLoadUrl()}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1 gap-2"
                      onClick={handleLoadUrl}
                      disabled={!urlInput.trim() || loading}
                    >
                      {loading ? <Loader2 size={14} className="animate-spin" /> : null}
                      {loading ? 'Cargando...' : 'Cargar CSS'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setShowUrlInput(false); setUrlInput("") }}
                    >
                      Cancelar
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Introduce la URL del CSS de tu framework (ej. HolyGrail5, Bootstrap, Tailwind...)
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
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
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Cargado</Badge>
                  {onReset && (
                    <button
                      onClick={onReset}
                      className="p-1 rounded-lg text-muted-foreground hover:bg-muted transition-colors"
                      title="Cambiar framework"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
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
            <CategoryCard icon={Palette} label="Colores" category={coverage.colors} />
            <CategoryCard icon={Type} label="Font Sizes" category={coverage.fontSizes} />
            <CategoryCard icon={Ruler} label="Spacing" category={coverage.spacing} />
            <CategoryCard icon={Layers} label="Z-index" category={coverage.zIndex} />
          </div>

          {/* ── Redundant: values already in the framework ── */}
          {(coverage.colors.redundant.length > 0 ||
            coverage.fontSizes.redundant.length > 0 ||
            coverage.spacing.redundant.length > 0 ||
            coverage.zIndex.redundant.length > 0) && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold text-[#9e2b25] flex items-center gap-2">
                  <AlertTriangle size={16} />
                  Valores redundantes — ya existen en el framework
                </h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Estos valores ya estan definidos en HolyGrail5. Puedes eliminarlos de tu CSS y usar las clases/variables del framework.
                </p>
              </div>

              {coverage.colors.redundant.length > 0 && (
                <RedundantSection label="Colores redundantes" items={coverage.colors.redundant} isColor />
              )}
              {coverage.fontSizes.redundant.length > 0 && (
                <RedundantSection label="Font-sizes redundantes" items={coverage.fontSizes.redundant} />
              )}
              {coverage.spacing.redundant.length > 0 && (
                <RedundantSection label="Spacing redundante" items={coverage.spacing.redundant} />
              )}
              {coverage.zIndex.redundant.length > 0 && (
                <RedundantSection label="Z-index redundante" items={coverage.zIndex.redundant} />
              )}
            </div>
          )}

          {/* ── Mismatches: values NOT in the framework ── */}
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

function RedundantSection({ label, items, isColor = false }: {
  label: string
  items: DsRedundant[]
  isColor?: boolean
}) {
  const sorted = [...items].sort((a, b) => b.count - a.count)

  return (
    <Card className="border-[#fef2f1]">
      <CardContent className="p-4">
        <h5 className="text-sm font-semibold text-[#9e2b25] mb-3">{label} ({items.length})</h5>
        <Table>
          <TableHeader>
            <TableRow>
              {isColor && <TableHead className="w-10"></TableHead>}
              <TableHead>Valor</TableHead>
              <TableHead>Apariciones</TableHead>
              <TableHead>Ubicaciones</TableHead>
              <TableHead>Accion</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((item, i) => (
              <TableRow key={i} className="bg-[#fef2f1]/30">
                {isColor && (
                  <TableCell>
                    <div
                      className="w-6 h-6 rounded border"
                      style={{ backgroundColor: item.value }}
                    />
                  </TableCell>
                )}
                <TableCell className="font-mono text-xs font-medium">{item.value}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className="text-xs">
                    {item.count}x
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {item.locations.slice(0, 4).map(l => `L${l.line}`).join(", ")}
                  {item.locations.length > 4 && ` (+${item.locations.length - 4})`}
                </TableCell>
                <TableCell>
                  <span className="text-xs text-[#9e2b25] font-medium">Eliminar del CSS</span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
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
