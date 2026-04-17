import { useMemo } from "react"
import type { AnalysisResult, HardcodedValue } from "@/types/analysis"
import type { DsCoverageResult, DsTokenSet } from "@/types/design-system"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow
} from "@/components/ui/table"
import { AlertTriangle, CheckCircle, ArrowRight } from "lucide-react"

interface HardcodedTabProps {
  result: AnalysisResult
  dsCoverage?: DsCoverageResult | null
  dsTokens?: DsTokenSet | null
}

// ─── Color chip (swatch + value + count) ─────────────────────────
function ColorChip({ item }: { item: HardcodedValue }) {
  return (
    <div className="inline-flex items-center gap-1.5 bg-[#f8f9fa] rounded-lg px-2.5 py-1.5">
      <div
        className="w-5 h-5 rounded border border-black/10 shrink-0"
        style={{ backgroundColor: item.normalized }}
      />
      <span className="text-xs font-mono text-[#1a2e23]">{item.value}</span>
      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{item.count}x</Badge>
    </div>
  )
}

// ─── Value chip (value + count) ──────────────────────────────────
function ValueChip({ item }: { item: HardcodedValue }) {
  return (
    <div className="inline-flex items-center gap-1.5 bg-[#f8f9fa] rounded-lg px-2.5 py-1.5">
      <span className="text-xs font-mono font-semibold text-[#1a2e23]">{item.value}</span>
      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{item.count}x</Badge>
    </div>
  )
}

// ─── Z-index depth analysis ──────────────────────────────────────
// DS rule: z-index should go in increments of 1000 (0, 1000, 2000…).
// Each depth range is reserved for a specific type of UI element.

const DEPTH_DEFINITIONS: Record<number, { name: string; description: string; icon: string }> = {
  [-1]:  { name: 'Negativos',            description: 'Elementos ocultos detras del contenido base, fondos decorativos',                icon: '⬇' },
  0:     { name: 'Contenido base',       description: 'Flujo normal del documento, elementos inline, texto, imagenes',                  icon: '📄' },
  1000:  { name: 'Elementos elevados',   description: 'Cards flotantes, badges, elementos con sombra que necesitan sobresalir',         icon: '🃏' },
  2000:  { name: 'Dropdowns y popups',   description: 'Menus desplegables, selects abiertos, autocompletado, popovers',                icon: '📋' },
  3000:  { name: 'Headers y barras',     description: 'Headers fijos (sticky), barras de navegacion, toolbars persistentes',            icon: '📌' },
  4000:  { name: 'Sidebars y drawers',   description: 'Paneles laterales, drawers deslizantes, navegacion off-canvas',                  icon: '📂' },
  5000:  { name: 'Overlays',             description: 'Fondos oscuros (backdrop), capas semi-transparentes detras de modales',          icon: '🌫' },
  6000:  { name: 'Modales y dialogos',   description: 'Ventanas modales, dialogos de confirmacion, lightboxes',                        icon: '💬' },
  7000:  { name: 'Tooltips y toasts',    description: 'Tooltips, notificaciones toast, snackbars, hints flotantes',                     icon: '💡' },
  8000:  { name: 'Alertas criticas',     description: 'Banners de error critico, alertas de sesion expirada, avisos legales',           icon: '🚨' },
  9000:  { name: 'Sistema / max',        description: 'Loaders a pantalla completa, splash screens, debuggers, reservado para el sistema', icon: '⚙️' },
}

// Any depth beyond our definitions
const UNKNOWN_DEPTH = { name: 'Fuera de rango', description: 'Valores excesivamente altos que rompen la escala. Deben reducirse.', icon: '⚠️' }

function ZIndexSection({ items, total }: { items: HardcodedValue[]; total: number }) {
  const analysis = useMemo(() => {
    if (items.length === 0) return null

    const parsed = items.map(item => {
      const num = parseInt(item.value, 10)
      return { ...item, num: isNaN(num) ? null : num }
    })

    const negatives = parsed.filter(p => p.num !== null && p.num < 0)
    const positives = parsed.filter(p => p.num !== null && p.num >= 0)
    const nonNumeric = parsed.filter(p => p.num === null)

    // Group positives by depth (floor to nearest 1000)
    const depthMap = new Map<number, typeof parsed>()
    for (const p of positives) {
      const depth = Math.floor(p.num! / 1000) * 1000
      if (!depthMap.has(depth)) depthMap.set(depth, [])
      depthMap.get(depth)!.push(p)
    }

    // Build full depth scale (0–9000) to always show all layers,
    // even empty ones, so user sees the complete structure
    const allDepthKeys = new Set([...depthMap.keys(), 0, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000])
    const depths = [...allDepthKeys]
      .sort((a, b) => a - b)
      .map(depth => ({
        depth,
        label: `${depth} – ${depth + 999}`,
        values: (depthMap.get(depth) || []).sort((a, b) => a.num! - b.num!),
        def: DEPTH_DEFINITIONS[depth] || UNKNOWN_DEPTH,
      }))

    const isCorrect = (n: number) => n === 0 || (n > 0 && n % 1000 === 0)
    const irregularCount = parsed.filter(p => p.num !== null && !isCorrect(p.num)).length

    return { depths, negatives, nonNumeric, irregularCount, isCorrect }
  }, [items])

  return (
    <Card className="p-6">
      <h3 className="text-sm font-semibold mb-1 flex items-center gap-2 text-[#1a2e23]">
        Z-index Hardcodeado
        <Badge variant="secondary">{total}</Badge>
      </h3>
      <p className="text-xs text-[#3d5a4a] mb-1">
        El z-index deberia ir de 1000 en 1000. Cada rango esta reservado para un tipo de elemento UI.
        Valores intermedios rompen la escala y generan conflictos de apilamiento.
      </p>

      {!analysis ? (
        <p className="text-sm text-[#3d5a4a] mt-3">No se encontraron z-index hardcodeados.</p>
      ) : (
        <>
          {analysis.irregularCount > 0 && (
            <div className="flex items-center gap-2 mt-2 mb-3 px-3 py-2 bg-[#fef2f1] rounded-lg">
              <AlertTriangle size={14} className="text-[#9e2b25] shrink-0" />
              <p className="text-xs text-[#9e2b25]">
                <strong>{analysis.irregularCount}</strong> valor{analysis.irregularCount !== 1 ? 'es' : ''} no sigue{analysis.irregularCount === 1 ? '' : 'n'} la escala de miles — deben ajustarse al multiplo de 1000 mas cercano
              </p>
            </div>
          )}

          <div className="space-y-1 mt-3">
            {/* Negatives */}
            {analysis.negatives.length > 0 && (() => {
              const def = DEPTH_DEFINITIONS[-1]
              return (
                <div className="rounded-lg border border-[#9e2b25]/10 overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-2 bg-[#fef2f1]/50">
                    <span className="text-sm">{def.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold text-[#9e2b25]">Negativos</span>
                        <span className="text-[10px] text-[#9e2b25]/60">{def.name}</span>
                      </div>
                      <p className="text-[10px] text-[#3d5a4a] leading-tight">{def.description}</p>
                    </div>
                    <Badge variant="secondary" className="text-[10px] shrink-0">{analysis.negatives.length}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-1.5 px-3 py-2">
                    {analysis.negatives.sort((a, b) => a.num! - b.num!).map((item, i) => (
                      <div key={i} className="inline-flex items-center gap-1.5 rounded px-2 py-1 bg-[#fef2f1] border border-[#9e2b25]/15">
                        <AlertTriangle size={10} className="text-[#9e2b25]" />
                        <span className="text-[11px] font-mono font-semibold text-[#9e2b25]">{item.value}</span>
                        <span className="text-[10px] text-[#3d5a4a]">{item.count}x</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}

            {/* All depth layers */}
            {analysis.depths.map(({ depth, label, values, def }) => {
              const hasValues = values.length > 0
              return (
                <div
                  key={depth}
                  className={`rounded-lg border overflow-hidden ${
                    hasValues ? 'border-[#f0f2f1]' : 'border-[#f0f2f1]/50'
                  }`}
                >
                  {/* Layer header */}
                  <div className={`flex items-center gap-2 px-3 py-2 ${hasValues ? 'bg-[#f8f9fa]' : 'bg-[#fafafa]'}`}>
                    <span className={`text-sm ${!hasValues ? 'opacity-40' : ''}`}>{def.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-[11px] font-semibold ${hasValues ? 'text-[#1a2e23]' : 'text-[#3d5a4a]/40'}`}>
                          {label}
                        </span>
                        <span className={`text-[10px] font-medium ${hasValues ? 'text-[#006c48]' : 'text-[#3d5a4a]/40'}`}>
                          {def.name}
                        </span>
                      </div>
                      <p className={`text-[10px] leading-tight ${hasValues ? 'text-[#3d5a4a]' : 'text-[#3d5a4a]/30'}`}>
                        {def.description}
                      </p>
                    </div>
                    {hasValues ? (
                      <Badge variant="secondary" className="text-[10px] shrink-0">{values.length}</Badge>
                    ) : (
                      <span className="text-[10px] text-[#3d5a4a]/30 shrink-0">vacio</span>
                    )}
                  </div>

                  {/* Values */}
                  {hasValues && (
                    <div className="flex flex-wrap gap-1.5 px-3 py-2">
                      {values.map((item, i) => {
                        const ok = analysis.isCorrect(item.num!)
                        return (
                          <div
                            key={i}
                            className={`inline-flex items-center gap-1.5 rounded px-2 py-1 border ${
                              ok
                                ? 'bg-[#e0f5ec]/50 border-[#006c48]/15'
                                : 'bg-[#fef2f1] border-[#9e2b25]/15'
                            }`}
                          >
                            {ok
                              ? <CheckCircle size={10} className="text-[#006c48]" />
                              : <AlertTriangle size={10} className="text-[#9e2b25]" />
                            }
                            <span className={`text-[11px] font-mono font-semibold ${ok ? 'text-[#006c48]' : 'text-[#9e2b25]'}`}>
                              {item.value}
                            </span>
                            <span className="text-[10px] text-[#3d5a4a]">{item.count}x</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}

            {/* Non-numeric */}
            {analysis.nonNumeric.length > 0 && (
              <div className="rounded-lg border border-[#a67c00]/10 overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2 bg-[#fef6e0]/50">
                  <span className="text-sm">🔤</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-[11px] font-semibold text-[#a67c00]">No numericos</span>
                    <p className="text-[10px] text-[#3d5a4a] leading-tight">Valores como auto, inherit, initial — no participan en la escala numerica</p>
                  </div>
                  <Badge variant="secondary" className="text-[10px] shrink-0">{analysis.nonNumeric.length}</Badge>
                </div>
                <div className="flex flex-wrap gap-1.5 px-3 py-2">
                  {analysis.nonNumeric.map((item, i) => (
                    <div key={i} className="inline-flex items-center gap-1.5 rounded px-2 py-1 bg-[#fef6e0] border border-[#a67c00]/15">
                      <span className="text-[11px] font-mono font-semibold text-[#a67c00]">{item.value}</span>
                      <span className="text-[10px] text-[#3d5a4a]">{item.count}x</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </Card>
  )
}

export function HardcodedTab({ result, dsCoverage, dsTokens }: HardcodedTabProps) {
  const sortedColors = [...result.colors].sort((a, b) => b.count - a.count)
  const sortedFontSizes = [...result.fontSizes].sort((a, b) => b.count - a.count)
  const sortedSpacing = [...result.spacingValues].sort((a, b) => b.count - a.count)
  const sortedZIndex = [...result.zIndexValues].sort((a, b) => b.count - a.count)

  // Build a lookup: normalized color value → { closestDsValue, varName, isExact }
  const colorDsMap = useMemo(() => {
    const map = new Map<string, { closestValue: string; varName: string | null; isExact: boolean }>()
    if (!dsCoverage || !dsTokens) return map

    const varNames = dsTokens.varNames || {}

    // Exact matches (redundant)
    for (const r of dsCoverage.colors.redundant) {
      const vn = varNames[r.value] || null
      map.set(r.value, { closestValue: r.value, varName: vn, isExact: true })
    }

    // Mismatches → closest DS value
    for (const m of dsCoverage.colors.mismatches) {
      if (m.closestDsValue) {
        const vn = varNames[m.closestDsValue] || null
        map.set(m.value, { closestValue: m.closestDsValue, varName: vn, isExact: false })
      }
    }

    return map
  }, [dsCoverage, dsTokens])

  const hasDsData = colorDsMap.size > 0

  return (
    <div className="space-y-6">
      {/* ── Colors ── */}
      <Card className="p-6">
        <h3 className="text-sm font-semibold mb-1 flex items-center gap-2 text-[#1a2e23]">
          Colores Hardcodeados
          <Badge variant="secondary">{result.colors.length}</Badge>
        </h3>
        <p className="text-xs text-[#3d5a4a] mb-3">
          {hasDsData
            ? 'Cada color muestra la variable HG5 que deberia usarse en su lugar.'
            : 'Colores escritos directamente en el CSS sin usar variables ni tokens del DS. Carga tokens del DS para ver sugerencias.'}
        </p>
        {sortedColors.length === 0 ? (
          <p className="text-sm text-[#3d5a4a]">No se encontraron colores hardcodeados.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {sortedColors.map((color, i) => {
              const dsInfo = colorDsMap.get(color.normalized)
              return (
                <div
                  key={i}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 border ${
                    dsInfo?.isExact
                      ? 'bg-[#e0f5ec]/30 border-[#006c48]/15'
                      : 'bg-[#f8f9fa] border-transparent'
                  }`}
                >
                  {/* Current color swatch */}
                  <div
                    className="w-5 h-5 rounded border border-black/10 shrink-0"
                    style={{ backgroundColor: color.normalized }}
                  />
                  <span className="text-xs font-mono text-[#1a2e23]">{color.value}</span>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{color.count}x</Badge>

                  {/* DS suggestion */}
                  {dsInfo && (
                    <>
                      <ArrowRight size={10} className="text-[#3d5a4a]/40 shrink-0" />
                      <div
                        className="w-4 h-4 rounded border border-black/10 shrink-0"
                        style={{ backgroundColor: dsInfo.closestValue }}
                      />
                      {dsInfo.varName ? (
                        <code className={`text-[10px] font-mono ${dsInfo.isExact ? 'text-[#006c48]' : 'text-[#a67c00]'}`}>
                          {dsInfo.varName}
                        </code>
                      ) : (
                        <span className={`text-[10px] font-mono ${dsInfo.isExact ? 'text-[#006c48]' : 'text-[#a67c00]'}`}>
                          {dsInfo.closestValue}
                        </span>
                      )}
                      {dsInfo.isExact && (
                        <CheckCircle size={10} className="text-[#006c48] shrink-0" />
                      )}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* ── Font Sizes ── */}
      <Card className="p-6">
        <h3 className="text-sm font-semibold mb-1 flex items-center gap-2 text-[#1a2e23]">
          Font Sizes Hardcodeados
          <Badge variant="secondary">{result.fontSizes.length}</Badge>
        </h3>
        <p className="text-xs text-[#3d5a4a] mb-3">Tamanos de fuente hardcodeados fuera del sistema de tokens.</p>
        {sortedFontSizes.length === 0 ? (
          <p className="text-sm text-[#3d5a4a]">No se encontraron font-sizes hardcodeados.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {sortedFontSizes.map((fs, i) => (
              <ValueChip key={i} item={fs} />
            ))}
          </div>
        )}
      </Card>

      {/* ── Spacing ── */}
      {(() => {
        // Classify spacing by unit type
        const isPx = (val: string) => /px$/i.test(val) || val === '0' || /^\d+$/.test(val)
        const isPercent = (val: string) => /%$/.test(val) || /v[wh]$/i.test(val) || /sv[wh]$/i.test(val) || /dv[wh]$/i.test(val)

        const pxValues = sortedSpacing.filter(sv => isPx(sv.normalized))
        const percentValues = sortedSpacing.filter(sv => isPercent(sv.normalized))
        const otherValues = sortedSpacing.filter(sv => !isPx(sv.normalized) && !isPercent(sv.normalized))

        // Within px: split multiples of 8 vs not
        const isMultipleOf8 = (val: string): boolean => {
          const num = parseFloat(val)
          if (isNaN(num)) return false
          return num === 0 || (num > 0 && num % 8 === 0)
        }
        const pxBad = pxValues.filter(sv => !isMultipleOf8(sv.normalized))
        const pxOk = pxValues.filter(sv => isMultipleOf8(sv.normalized))

        return (
          <Card className="p-6">
            <h3 className="text-sm font-semibold mb-1 flex items-center gap-2 text-[#1a2e23]">
              Spacing Hardcodeado
              <Badge variant="secondary">{result.spacingValues.length}</Badge>
              {pxBad.length > 0 && (
                <Badge className="bg-[#fef2f1] text-[#9e2b25] text-[10px]">
                  {pxBad.length} fuera de la grid 8px
                </Badge>
              )}
            </h3>
            <p className="text-xs text-[#3d5a4a] mb-3">
              El spacing en px deberia ser multiplo de 8 (8, 16, 24, 32…). Porcentajes y otras unidades se muestran aparte.
            </p>

            {sortedSpacing.length === 0 ? (
              <p className="text-sm text-[#3d5a4a]">No se encontraron valores de spacing hardcodeados.</p>
            ) : (
              <div className="space-y-4">
                {/* ── PIXELS ── */}
                {pxValues.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold text-[#1a2e23]">Pixeles</span>
                      <Badge variant="secondary" className="text-[10px]">{pxValues.length}</Badge>
                      <div className="flex-1 h-px bg-[#f0f2f1]" />
                    </div>

                    {/* Bad px — not multiples of 8 */}
                    {pxBad.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <AlertTriangle size={12} className="text-[#9e2b25]" />
                          <span className="text-[10px] font-semibold text-[#9e2b25] uppercase tracking-wider">
                            No multiplos de 8 ({pxBad.length})
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {pxBad.map((sv, i) => (
                            <div key={i} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 bg-[#fef2f1] border border-[#9e2b25]/15">
                              <AlertTriangle size={10} className="text-[#9e2b25]" />
                              <span className="text-xs font-mono font-semibold text-[#9e2b25]">{sv.value}</span>
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{sv.count}x</Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* OK px — multiples of 8 */}
                    {pxOk.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <CheckCircle size={12} className="text-[#006c48]" />
                          <span className="text-[10px] font-semibold text-[#006c48] uppercase tracking-wider">
                            Multiplos de 8 ({pxOk.length})
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {pxOk.map((sv, i) => (
                            <div key={i} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 bg-[#e0f5ec]/30 border border-[#006c48]/10">
                              <span className="text-[11px] font-mono text-[#006c48]">{sv.value}</span>
                              <span className="text-[10px] text-[#3d5a4a]">{sv.count}x</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {pxBad.length === 0 && (
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-[#e0f5ec] rounded-lg">
                        <CheckCircle size={12} className="text-[#006c48]" />
                        <p className="text-[11px] text-[#006c48] font-medium">Todos los px siguen la grid de 8</p>
                      </div>
                    )}
                  </div>
                )}

                {/* ── PERCENTAGES / VIEWPORT ── */}
                {percentValues.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[11px] font-semibold text-[#1a2e23]">Porcentuales y viewport</span>
                      <Badge variant="secondary" className="text-[10px]">{percentValues.length}</Badge>
                      <div className="flex-1 h-px bg-[#f0f2f1]" />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {percentValues.map((sv, i) => (
                        <div key={i} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 bg-[#f0f4ff] border border-[#4a7cba]/10">
                          <span className="text-xs font-mono font-semibold text-[#2c5282]">{sv.value}</span>
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{sv.count}x</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── OTHER UNITS (rem, em, calc, etc.) ── */}
                {otherValues.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[11px] font-semibold text-[#1a2e23]">Otras unidades</span>
                      <Badge variant="secondary" className="text-[10px]">{otherValues.length}</Badge>
                      <div className="flex-1 h-px bg-[#f0f2f1]" />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {otherValues.map((sv, i) => (
                        <div key={i} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 bg-[#f8f9fa] border border-[#f0f2f1]">
                          <span className="text-xs font-mono font-semibold text-[#1a2e23]">{sv.value}</span>
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{sv.count}x</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>
        )
      })()}

      {/* ── Z-index — full width, grouped by depth ── */}
      <ZIndexSection items={sortedZIndex} total={result.zIndexValues.length} />

      {/* ── !important ── */}
      <Card className="p-6">
        <h3 className="text-sm font-semibold mb-1 flex items-center gap-2 text-[#1a2e23]">
          Declaraciones !important
          <Badge variant={result.importants.length > 0 ? "destructive" : "secondary"}>
            {result.importants.length}
          </Badge>
        </h3>
        <p className="text-xs text-[#3d5a4a] mb-3">Reglas que fuerzan prioridad con !important.</p>
        {result.importants.length === 0 ? (
          <p className="text-sm text-[#3d5a4a]">No se encontraron !important.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-[#f0f2f1]">
            <div className="max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#f8f9fa]">
                    <TableHead className="text-[#1a2e23] w-16 py-2 text-[11px]">Linea</TableHead>
                    <TableHead className="text-[#1a2e23] py-2 text-[11px]">Selector</TableHead>
                    <TableHead className="text-[#1a2e23] py-2 text-[11px]">Declaracion</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.importants.map((imp, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-[10px] text-[#3d5a4a] py-1.5">L{imp.line}</TableCell>
                      <TableCell className="font-mono text-[10px] text-[#1a2e23] py-1.5 truncate max-w-[200px]">{imp.selector}</TableCell>
                      <TableCell className="font-mono text-[10px] text-[#9e2b25] py-1.5 truncate max-w-[300px]">{imp.rule}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
