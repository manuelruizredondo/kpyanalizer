import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { AnalysisResult } from '@/types/analysis'
import { useAnalysis } from '@/hooks/useAnalysis'
import { useAuth } from '@/contexts/AuthContext'
import { classifyFamily, DS_APPROVED_WEIGHTS, nearestApprovedWeight } from '@/lib/font-utils'
import { getScoreBand } from '@/lib/score-band'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  AlertTriangle, CheckCircle, XCircle, ArrowRight, Clock,
  Palette, Type, Bold, Layers, Zap, Copy,
  Code, Target, TrendingDown, ChevronDown, ChevronUp,
  Plus, Pencil, Trash2, Loader2, X, UserRound,
} from 'lucide-react'
import type {
  ActionItem as DbActionItem,
  ActionPriority,
  Project,
  ScanDetail,
} from '@/lib/scan-storage'
import {
  getProjects,
  getLatestScanDetail,
  getActionItems,
  createActionItem,
  updateActionItem,
  deleteActionItem,
  reorderActionItems,
  isAnalysisResult,
  isAbortError,
} from '@/lib/scan-storage'

// ─── Priority Levels ─────────────────────────────────────────────
type Priority = 'critical' | 'high' | 'medium' | 'low'

interface DetailRow {
  cells: (string | number)[]
  severity?: 'bad' | 'warn' | 'ok'
  swatch?: string // optional color swatch
}

interface AutoActionItem {
  id: string
  priority: Priority
  category: string
  title: string
  description: string
  metric: string | number
  impact: string
  howToFix: string
  icon: React.ReactNode
  detailHeaders?: string[]
  detailRows?: DetailRow[]
}

const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  critical: { label: 'Critico', color: '#9e2b25', bg: 'bg-[#fef2f1]', border: 'border-[#9e2b25]/20', icon: <XCircle size={16} className="text-[#9e2b25]" /> },
  high:     { label: 'Alto',    color: '#a67c00', bg: 'bg-[#fef6e0]', border: 'border-[#a67c00]/20', icon: <AlertTriangle size={16} className="text-[#a67c00]" /> },
  medium:   { label: 'Medio',   color: '#3d5a4a', bg: 'bg-[#f0f2f1]', border: 'border-[#3d5a4a]/20', icon: <Clock size={16} className="text-[#3d5a4a]" /> },
  low:      { label: 'Bajo',    color: '#006c48', bg: 'bg-[#e0f5ec]', border: 'border-[#006c48]/20', icon: <CheckCircle size={16} className="text-[#006c48]" /> },
}


// ─── Generate Action Items ───────────────────────────────────────
function generateActions(result: AnalysisResult): AutoActionItem[] {
  const actions: AutoActionItem[] = []
  // Un analysis_data incompleto (p.ej. {}) dejaba la página en blanco al leer
  // result.colors.length: sin datos válidos no hay acciones automáticas.
  if (!isAnalysisResult(result)) return actions

  // 1. !important abuse
  if (result.importantCount > 0) {
    const priority: Priority = result.importantCount > 50 ? 'critical' : result.importantCount > 20 ? 'high' : 'medium'
    const imps = result.importants || []
    actions.push({
      id: 'important',
      priority,
      category: 'Especificidad',
      title: 'Eliminar declaraciones !important',
      description: `Se encontraron ${result.importantCount} usos de !important. Fuerzan la cascada CSS y generan guerras de especificidad que hacen el codigo inmantenible.`,
      metric: result.importantCount,
      impact: 'Reduce conflictos de especificidad y facilita el mantenimiento',
      howToFix: 'Revisa cada !important y reescribe el selector con mayor especificidad natural (clases anidadas, BEM) en lugar de forzar prioridad.',
      icon: <Zap size={18} className="text-[#9e2b25]" />,
      detailHeaders: ['Propiedad', 'Selector', 'Línea'],
      detailRows: imps.map(imp => ({
        cells: [imp.property, imp.selector, imp.line],
        severity: 'bad' as const,
      })),
    })
  }

  // 2. ID selectors (extract from specificity distribution)
  if (result.idCount > 0) {
    const priority: Priority = result.idCount > 20 ? 'high' : result.idCount > 5 ? 'medium' : 'low'
    const idSelectors = result.specificityDistribution.filter(s => s.specificity[0] > 0)
    actions.push({
      id: 'ids',
      priority,
      category: 'Especificidad',
      title: 'Reemplazar selectores de ID por clases',
      description: `${result.idCount} selectores usan #id. Un solo ID tiene especificidad (1,0,0), equivalente a 100 clases. Esto escala mal.`,
      metric: result.idCount,
      impact: 'Baja la especificidad maxima y elimina dependencias de IDs en HTML',
      howToFix: 'Cambia #header por .header, #nav por .nav, etc. Si necesitas anclar un estilo a un elemento unico, usa [data-id="header"] o una clase con nombre especifico.',
      icon: <Zap size={18} className="text-[#a67c00]" />,
      detailHeaders: ['Selector', 'Especificidad', 'Línea'],
      detailRows: idSelectors.map(s => ({
        cells: [s.selector, `(${s.specificity.join(',')})`, s.line],
        severity: 'bad' as const,
      })),
    })
  }

  // 3. Hardcoded colors
  if (result.colors.length > 0) {
    const priority: Priority = result.colors.length > 50 ? 'critical' : result.colors.length > 20 ? 'high' : 'medium'
    const totalUses = result.colors.reduce((s, c) => s + c.count, 0)
    const sorted = [...result.colors].sort((a, b) => b.count - a.count)
    actions.push({
      id: 'colors',
      priority,
      category: 'Design System',
      title: 'Sustituir colores hardcodeados por variables',
      description: `${result.colors.length} colores distintos (${totalUses} usos totales) escritos directamente en el CSS. Deben migrar a variables del Design System.`,
      metric: `${result.colors.length} colores`,
      impact: 'Consistencia visual, modo oscuro preparado, cambios de marca centralizados',
      howToFix: 'Para cada color, busca la variable CSS mas cercana del DS (--color-*). Usa Confrontar HG5 > Sugerencias de Sustitución para ver reemplazos directos.',
      icon: <Palette size={18} className="text-[#9e2b25]" />,
      detailHeaders: ['Color', 'Valor', 'Usos', 'Línea'],
      detailRows: sorted.map(c => ({
        cells: ['', c.normalized, c.count, c.locations[0]?.line ?? '–'],
        swatch: c.normalized,
        severity: 'bad' as const,
      })),
    })
  }

  // 4. Font families to eliminate
  const badFamilies = result.fontFamilies.filter(f =>
    classifyFamily(f.normalized || f.value) === 'eliminate'
  )
  if (badFamilies.length > 0) {
    const totalUses = badFamilies.reduce((s, f) => s + f.count, 0)
    actions.push({
      id: 'font-families',
      priority: 'high',
      category: 'Tipografia',
      title: 'Reemplazar familias tipograficas no autorizadas',
      description: `${badFamilies.length} familias (${totalUses} usos) que no son Suisse ni genericas. Solo Suisse esta aprobada en el DS.`,
      metric: `${badFamilies.length} familias`,
      impact: 'Consistencia de marca, reduccion de peticiones de fuentes externas',
      howToFix: 'Reemplaza cada familia por la Suisse correspondiente. Consulta la pestaña Tipografia para mapear cada fuente.',
      icon: <Type size={18} className="text-[#9e2b25]" />,
      detailHeaders: ['Familia', 'Usos', 'Línea ejemplo'],
      detailRows: [...badFamilies].sort((a, b) => b.count - a.count).map(f => ({
        cells: [f.normalized.replace(/['"]/g, ''), f.count, f.locations[0]?.line ?? '–'],
        severity: 'bad' as const,
      })),
    })
  }

  // 5. Font weights to consolidate
  const badWeights = result.fontWeights.filter(w => {
    const n = parseInt(w.normalized, 10)
    return !isNaN(n) && !DS_APPROVED_WEIGHTS.includes(n)
  })
  if (badWeights.length > 0) {
    actions.push({
      id: 'font-weights',
      priority: 'medium',
      category: 'Tipografia',
      title: 'Consolidar font-weights al DS',
      description: `${badWeights.length} pesos tipograficos fuera de los aprobados (${DS_APPROVED_WEIGHTS.join(', ')}). Deben trasladarse al peso mas cercano.`,
      metric: `${badWeights.length} pesos`,
      impact: 'Reduce variantes de fuente cargadas y mantiene consistencia tipografica',
      howToFix: 'Traslada cada peso al mas cercano aprobado: 200 → 100, 800/900 → 700 (100, 300, 400, 500, 600 y 700 son validos en HG5).',
      icon: <Bold size={18} className="text-[#a67c00]" />,
      detailHeaders: ['Peso actual', 'Usos', 'Reemplazar por'],
      detailRows: [...badWeights].sort((a, b) => b.count - a.count).map(w => {
        const n = parseInt(w.normalized, 10)
        const nearest = nearestApprovedWeight(n)
        return {
          cells: [w.normalized, w.count, String(nearest)],
          severity: 'warn' as const,
        }
      }),
    })
  }

  // 6. Spacing not on 8px grid
  const spacingBadPx = result.spacingValues.filter(sv => {
    const n = parseFloat(sv.normalized)
    const isPx = /px$/i.test(sv.normalized) || sv.normalized === '0' || /^\d+$/.test(sv.normalized)
    if (!isPx || isNaN(n)) return false
    return n !== 0 && n % 8 !== 0
  })
  if (spacingBadPx.length > 0) {
    const priority: Priority = spacingBadPx.length > 30 ? 'high' : spacingBadPx.length > 10 ? 'medium' : 'low'
    actions.push({
      id: 'spacing',
      priority,
      category: 'Design System',
      title: 'Alinear spacing a la grid de 8px',
      description: `${spacingBadPx.length} valores de spacing en px que no son multiplos de 8. La escala debe ser 8, 16, 24, 32, 40, 48...`,
      metric: `${spacingBadPx.length} valores`,
      impact: 'Ritmo visual consistente, alineacion con el grid del DS',
      howToFix: 'Ajusta cada valor al multiplo de 8 mas cercano. Ej: 12px → 16px, 5px → 8px.',
      icon: <Target size={18} className="text-[#a67c00]" />,
      detailHeaders: ['Valor actual', 'Usos', 'Ajustar a'],
      detailRows: [...spacingBadPx].sort((a, b) => b.count - a.count).map(s => {
        const n = parseFloat(s.normalized)
        const nearest = Math.round(n / 8) * 8 || 8
        return {
          cells: [s.normalized, s.count, `${nearest}px`],
          severity: 'warn' as const,
        }
      }),
    })
  }

  // 7. Z-index irregulars
  const zIrregulars = result.zIndexValues.filter(z => {
    const n = parseInt(z.value, 10)
    return !isNaN(n) && n !== 0 && n % 1000 !== 0
  })
  if (zIrregulars.length > 0) {
    const DEPTH_NAMES: Record<number, string> = {
      0: 'Contenido base', 1000: 'Elevados', 2000: 'Dropdowns',
      3000: 'Headers', 4000: 'Sidebars', 5000: 'Overlays',
      6000: 'Modales', 7000: 'Tooltips', 8000: 'Alertas', 9000: 'Sistema',
    }
    actions.push({
      id: 'zindex',
      priority: zIrregulars.length > 10 ? 'high' : 'medium',
      category: 'Arquitectura',
      title: 'Normalizar z-index a escala de 1000',
      description: `${zIrregulars.length} valores z-index que no siguen la escala (0, 1000, 2000...). Valores como 9999, 999, 50 generan conflictos de apilamiento.`,
      metric: `${zIrregulars.length} irregulares`,
      impact: 'Elimina conflictos de z-index y establece un sistema predecible de capas',
      howToFix: 'Ajusta cada valor al multiplo de 1000 de su rango. Revisa Confrontar HG5 > Z-index para la tabla de capas.',
      icon: <Layers size={18} className="text-[#a67c00]" />,
      detailHeaders: ['Valor actual', 'Usos', 'Capa', 'Ajustar a'],
      detailRows: [...zIrregulars].sort((a, b) => parseInt(b.value) - parseInt(a.value)).map(z => {
        const n = parseInt(z.value, 10)
        const nearest = n < 0 ? 0 : Math.round(n / 1000) * 1000
        const depthName = DEPTH_NAMES[nearest] || 'Fuera de rango'
        return {
          cells: [z.value, z.count, depthName, String(nearest)],
          severity: 'bad' as const,
        }
      }),
    })
  }

  // 8. Duplicate selectors
  if (result.duplicateSelectors.length > 0) {
    const priority: Priority = result.duplicateSelectors.length > 30 ? 'high' : result.duplicateSelectors.length > 10 ? 'medium' : 'low'
    actions.push({
      id: 'dup-selectors',
      priority,
      category: 'Limpieza',
      title: 'Unificar selectores duplicados',
      description: `${result.duplicateSelectors.length} selectores aparecen mas de una vez. Las declaraciones pueden fusionarse.`,
      metric: result.duplicateSelectors.length,
      impact: 'Reduce peso del CSS y evita sobreescrituras accidentales',
      howToFix: 'Busca cada selector duplicado y fusiona sus declaraciones en una sola regla.',
      icon: <Copy size={18} className="text-[#3d5a4a]" />,
      detailHeaders: ['Selector', 'Repeticiones', 'Líneas'],
      detailRows: [...result.duplicateSelectors].sort((a, b) => b.occurrences.length - a.occurrences.length).map(d => ({
        cells: [d.key, d.occurrences.length, d.occurrences.map(o => o.line).join(', ')],
        severity: 'warn' as const,
      })),
    })
  }

  // 9. Duplicate declarations
  if (result.duplicateDeclarations.length > 0) {
    const priority: Priority = result.duplicateDeclarations.length > 50 ? 'high' : result.duplicateDeclarations.length > 20 ? 'medium' : 'low'
    actions.push({
      id: 'dup-declarations',
      priority,
      category: 'Limpieza',
      title: 'Eliminar declaraciones duplicadas',
      description: `${result.duplicateDeclarations.length} pares propiedad:valor identicos repetidos en distintos selectores. Podrian extraerse a clases utilitarias.`,
      metric: result.duplicateDeclarations.length,
      impact: 'Reduce tamano del CSS y mejora mantenimiento via DRY',
      howToFix: 'Identifica los patrones mas repetidos y extrae a clases utilitarias compartidas.',
      icon: <Copy size={18} className="text-[#3d5a4a]" />,
      detailHeaders: ['Declaración', 'Repeticiones', 'Líneas'],
      detailRows: [...result.duplicateDeclarations].sort((a, b) => b.occurrences.length - a.occurrences.length).map(d => ({
        cells: [d.key, d.occurrences.length, d.occurrences.slice(0, 5).map(o => o.line).join(', ') + (d.occurrences.length > 5 ? '…' : '')],
        severity: 'warn' as const,
      })),
    })
  }

  // 10. Vendor prefixes
  if (result.vendorPrefixCount > 10) {
    actions.push({
      id: 'vendor',
      priority: 'low',
      category: 'Limpieza',
      title: 'Automatizar vendor prefixes',
      description: `${result.vendorPrefixCount} vendor prefixes manuales (-webkit-, -moz-, etc.). Deben generarse automaticamente.`,
      metric: result.vendorPrefixCount,
      impact: 'Reduce peso del CSS y asegura compatibilidad actualizada',
      howToFix: 'Configura Autoprefixer en tu pipeline de build (PostCSS). Elimina todos los prefixes manuales del codigo fuente.',
      icon: <Code size={18} className="text-[#3d5a4a]" />,
    })
  }

  // 11. Deep nesting
  if (result.deepestNesting > 4) {
    actions.push({
      id: 'nesting',
      priority: result.deepestNesting > 6 ? 'high' : 'medium',
      category: 'Arquitectura',
      title: 'Reducir profundidad de anidamiento',
      description: `Anidamiento maximo de ${result.deepestNesting} niveles. Mas de 3-4 niveles genera selectores largos, alta especificidad y acoplamiento al HTML.`,
      metric: `${result.deepestNesting} niveles`,
      impact: 'Selectores mas cortos, menor especificidad, CSS desacoplado del markup',
      howToFix: 'Aplica metodologia BEM o similar: en vez de .page .content .sidebar .nav .item usa .sidebar__nav-item. Evita anidar mas de 3 niveles en SCSS/Sass.',
      icon: <Layers size={18} className="text-[#a67c00]" />,
    })
  }

  // 12. File size
  const sizeKb = result.fileSize / 1024
  if (sizeKb > 200) {
    actions.push({
      id: 'filesize',
      priority: sizeKb > 500 ? 'high' : 'medium',
      category: 'Rendimiento',
      title: 'Reducir el peso del CSS',
      description: `El archivo pesa ${sizeKb.toFixed(0)} KB. Un CSS de mas de 200 KB impacta el rendering inicial (bloquea el pintado).`,
      metric: `${sizeKb.toFixed(0)} KB`,
      impact: 'Mejor First Contentful Paint, menor tiempo de carga',
      howToFix: 'Divide el CSS en critico (above-the-fold) y no-critico (lazy load). Usa PurgeCSS/UnCSS para eliminar reglas no usadas. Habilita gzip/brotli.',
      icon: <TrendingDown size={18} className="text-[#a67c00]" />,
    })
  }

  // 13. Low reuse ratio
  if (result.reuseRatio < 0.3) {
    actions.push({
      id: 'reuse',
      priority: 'medium',
      category: 'Arquitectura',
      title: 'Mejorar reutilizacion de estilos',
      description: `Solo el ${(result.reuseRatio * 100).toFixed(0)}% de las declaraciones se reutilizan. Hay demasiado CSS unico.`,
      metric: `${(result.reuseRatio * 100).toFixed(0)}%`,
      impact: 'Reduce peso total, mejora consistencia y facilita cambios globales',
      howToFix: 'Extrae patrones repetidos a clases utilitarias o componentes reutilizables. Identifica las declaraciones duplicadas como punto de partida.',
      icon: <Code size={18} className="text-[#3d5a4a]" />,
    })
  }

  // Sort: critical > high > medium > low
  const order: Record<Priority, number> = { critical: 0, high: 1, medium: 2, low: 3 }
  actions.sort((a, b) => order[a.priority] - order[b.priority])

  return actions
}

// ─── Summary Stats ───────────────────────────────────────────────
function ActionSummary({
  autoActions,
  manualItems,
}: {
  autoActions: AutoActionItem[]
  manualItems: DbActionItem[]
}) {
  const counts = useMemo(() => {
    const c = { critical: 0, high: 0, medium: 0, low: 0 }
    for (const a of autoActions) c[a.priority]++
    for (const m of manualItems) c[m.priority]++
    return c
  }, [autoActions, manualItems])

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {(Object.entries(counts) as [Priority, number][]).map(([priority, count]) => {
        const cfg = PRIORITY_CONFIG[priority]
        return (
          <Card key={priority} className={`p-4 ${cfg.bg} ${cfg.border} border`}>
            <div className="flex items-center gap-2 mb-1">
              {cfg.icon}
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: cfg.color }}>
                {cfg.label}
              </span>
            </div>
            <p className="text-3xl font-bold" style={{ color: cfg.color }}>{count}</p>
            <p className="text-[10px]" style={{ color: cfg.color }}>acciones</p>
          </Card>
        )
      })}
    </div>
  )
}

// ─── Detail Table (expandable) ───────────────────────────────────
const PREVIEW_ROWS = 10

function DetailTable({ headers, rows }: { headers: string[]; rows: DetailRow[] }) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? rows : rows.slice(0, PREVIEW_ROWS)
  const hasMore = rows.length > PREVIEW_ROWS

  return (
    <div className="mt-3 rounded-lg border border-[#f0f2f1] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="bg-[#f8f9fa]">
              {headers.map((h, i) => (
                <th key={i} className="text-left py-1.5 px-2 font-medium text-[#52695b] uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row, i) => {
              const sevBg = row.severity === 'bad' ? '#fef2f1' : row.severity === 'warn' ? '#fef6e0' : 'transparent'
              return (
                <tr key={i} className="border-t border-[#f0f2f1]" style={{ background: i % 2 === 0 ? sevBg : `${sevBg}80` }}>
                  {row.cells.map((cell, j) => (
                    <td key={j} className="py-1.5 px-2 font-mono text-[#1a2e23] truncate max-w-[260px]">
                      {j === 0 && row.swatch ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="inline-block w-3 h-3 rounded-sm border border-[#f0f2f1] shrink-0" style={{ backgroundColor: row.swatch }} />
                          {cell || row.swatch}
                        </span>
                      ) : (
                        cell
                      )}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {hasMore && (
        <div className="text-center py-2 border-t border-[#f0f2f1] bg-[#f8f9fa]">
          <Button
            size="sm"
            variant="ghost"
            className="text-[11px] h-6 text-[#006c48] hover:text-[#006c48] gap-1"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <><ChevronUp size={12} /> Mostrar solo {PREVIEW_ROWS}</>
            ) : (
              <><ChevronDown size={12} /> Ver todos ({rows.length})</>
            )}
          </Button>
        </div>
      )}
    </div>
  )
}

/** Mensaje legible de un error (Error o PostgrestError de Supabase, que no siempre extiende Error). */
function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message
  if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string' && err.message) {
    return err.message
  }
  return fallback
}

/**
 * Monta useAnalysis solo cuando hace falta el fallback local (no hay proyectos):
 * así el CSS pegado en Analizar no se vuelve a parsear en cada visita cuando la
 * auditoría sale de Supabase.
 */
function LocalAnalysisProbe({ onResult }: { onResult: (result: AnalysisResult | null) => void }) {
  const { result } = useAnalysis()
  useEffect(() => { onResult(result) }, [result, onResult])
  return null
}

// ─── Main Component ──────────────────────────────────────────────
export function ActionPlanPage() {
  const { user, profile } = useAuth()

  // Local-session analysis: solo se usa si NO hay ningún proyecto (ver LocalAnalysisProbe)
  const [localResult, setLocalResult] = useState<AnalysisResult | null>(null)

  // ── Project + scan data loaded from Supabase so the audit is visible
  //    to every authenticated user, not just whoever ran the analysis locally.
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [latestDetail, setLatestDetail] = useState<ScanDetail | null>(null)
  const [loadingProjects, setLoadingProjects] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  // Fallo al cargar el último escaneo (distinto de "el proyecto no tiene escaneos")
  const [detailError, setDetailError] = useState<string | null>(null)
  // Proyecto cuya consulta del último escaneo ya terminó con éxito (null = pendiente):
  // evita mostrar "sin escaneos" antes de saberlo.
  const [detailLoadedFor, setDetailLoadedFor] = useState<string | null>(null)
  const [projectsReloadKey, setProjectsReloadKey] = useState(0)
  const [detailReloadKey, setDetailReloadKey] = useState(0)

  // ── Manual action items (persisted, attributed to a creator) ──
  const [manualItems, setManualItems] = useState<DbActionItem[]>([])
  const [manualLoading, setManualLoading] = useState(false)
  // Error visible de carga/borrado/reordenación de acciones del equipo
  const [actionError, setActionError] = useState<string | null>(null)
  const [reordering, setReordering] = useState(false)

  // ── Add / edit form state ──
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formTitle, setFormTitle] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formPriority, setFormPriority] = useState<ActionPriority>('medium')
  const [savingForm, setSavingForm] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Ids para asociar labels/inputs y el título del diálogo
  const formId = useId()
  const dialogTitleId = `${formId}-dialog-title`
  const titleInputId = `${formId}-title`
  const priorityLabelId = `${formId}-priority`
  const descriptionInputId = `${formId}-description`
  const titleInputRef = useRef<HTMLInputElement>(null)

  // Proyecto seleccionado "actual" para descartar respuestas que llegan tarde
  // (tras cambiar de proyecto) en refrescos y acciones asíncronas.
  const selectedProjectRef = useRef(selectedProjectId)
  useEffect(() => { selectedProjectRef.current = selectedProjectId }, [selectedProjectId])

  // Load projects on mount (and on retry) and pick the most recent as default.
  useEffect(() => {
    let cancelled = false
    setLoadingProjects(true)
    setLoadError(null)
    getProjects()
      .then(list => {
        if (cancelled) return
        setProjects(list)
        if (list.length > 0) setSelectedProjectId(prev => prev || list[0].id)
      })
      .catch(err => {
        if (cancelled) return
        console.error('[ActionPlan] Error loading projects:', err)
        setLoadError(errorMessage(err, 'Error al cargar los proyectos'))
      })
      .finally(() => {
        if (cancelled) return
        setLoadingProjects(false)
      })
    return () => { cancelled = true }
  }, [projectsReloadKey])

  // When the selected project changes (or on retry), fetch its latest scan.
  // Se limpia lo anterior al empezar para no mostrar datos del proyecto previo,
  // y el AbortController descarta/cancela la respuesta si el proyecto cambia.
  useEffect(() => {
    setLatestDetail(null)
    setDetailError(null)
    setDetailLoadedFor(null)
    if (!selectedProjectId) {
      setLoadingDetail(false)
      return
    }
    const projectId = selectedProjectId
    const controller = new AbortController()
    setLoadingDetail(true)
    getLatestScanDetail(projectId, controller.signal)
      .then(detail => {
        if (controller.signal.aborted) return
        if (detail && !isAnalysisResult(detail.analysis_data)) {
          setDetailError('El último escaneo de este proyecto está incompleto o dañado.')
          return
        }
        setLatestDetail(detail)
        setDetailLoadedFor(projectId)
      })
      .catch(err => {
        if (controller.signal.aborted || isAbortError(err)) return
        console.error('[ActionPlan] Error loading latest scan:', err)
        setDetailError(errorMessage(err, 'Error al cargar el último escaneo'))
      })
      .finally(() => {
        if (controller.signal.aborted) return
        setLoadingDetail(false)
      })
    return () => controller.abort()
  }, [selectedProjectId, detailReloadKey])

  // Manual items of the selected project (independiente del escaneo, que pesa más).
  useEffect(() => {
    setManualItems([])
    setActionError(null)
    if (!selectedProjectId) {
      setManualLoading(false)
      return
    }
    let cancelled = false
    setManualLoading(true)
    getActionItems(selectedProjectId)
      .then(items => {
        if (cancelled) return
        setManualItems(items)
      })
      .catch(err => {
        if (cancelled) return
        console.error('[ActionPlan] Error loading action items:', err)
        setActionError(`No se pudieron cargar las acciones del equipo: ${errorMessage(err, 'error desconocido')}`)
      })
      .finally(() => {
        if (cancelled) return
        setManualLoading(false)
      })
    return () => { cancelled = true }
  }, [selectedProjectId])

  // Prefer the persisted scan analysis (shared across users). El análisis local
  // (CSS pegado sin guardar) solo se usa cuando no existe ningún proyecto: si hay
  // proyectos, mostrarlo como "acciones del proyecto" sería engañoso.
  const hasProjects = projects.length > 0
  const needsLocalFallback = !loadingProjects && !hasProjects && !loadError
  const activeResult: AnalysisResult | null = hasProjects
    ? (latestDetail && isAnalysisResult(latestDetail.analysis_data) ? latestDetail.analysis_data : null)
    : (needsLocalFallback && isAnalysisResult(localResult) ? localResult : null)

  const autoActions = useMemo(() => {
    if (!activeResult) return []
    return generateActions(activeResult)
  }, [activeResult])

  // Recarga las acciones de `projectId`; si entretanto se cambió de proyecto,
  // descarta el resultado para no pisar las del proyecto actual.
  const refreshManual = async (projectId: string) => {
    try {
      setManualLoading(true)
      const items = await getActionItems(projectId)
      if (selectedProjectRef.current !== projectId) return
      setManualItems(items)
    } catch (err) {
      if (selectedProjectRef.current !== projectId) return
      console.error('[ActionPlan] Error refreshing items:', err)
      setActionError(`No se pudieron recargar las acciones: ${errorMessage(err, 'error desconocido')}`)
    } finally {
      if (selectedProjectRef.current === projectId) setManualLoading(false)
    }
  }

  const resetForm = useCallback(() => {
    setFormTitle('')
    setFormDescription('')
    setFormPriority('medium')
    setFormError(null)
    setEditingId(null)
    setShowForm(false)
  }, [])

  // Modal accesible: foco al primer campo al abrir, Escape para cerrar y foco
  // devuelto al botón que lo abrió al cerrar.
  useEffect(() => {
    if (!showForm) return
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    titleInputRef.current?.focus()
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        resetForm()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      previouslyFocused?.focus()
    }
  }, [showForm, resetForm])

  const handleSaveForm = async () => {
    if (!selectedProjectId || !formTitle.trim() || savingForm) return
    const projectId = selectedProjectId
    try {
      setSavingForm(true)
      setFormError(null)
      if (editingId) {
        await updateActionItem(editingId, {
          title: formTitle.trim(),
          description: formDescription.trim(),
          priority: formPriority,
        })
      } else {
        await createActionItem(
          projectId,
          formTitle.trim(),
          formPriority,
          formDescription.trim(),
        )
      }
      resetForm()
      await refreshManual(projectId)
    } catch (err) {
      // El modal sigue abierto con el error visible para poder reintentar
      console.error('[ActionPlan] Error saving item:', err)
      setFormError(`No se pudo guardar la acción: ${errorMessage(err, 'error desconocido')}`)
    } finally {
      setSavingForm(false)
    }
  }

  const handleEdit = (item: DbActionItem) => {
    setEditingId(item.id)
    setFormTitle(item.title)
    setFormDescription(item.description || '')
    setFormPriority(item.priority)
    setFormError(null)
    setShowForm(true)
  }

  // Borrar: solo el autor o un super_admin (RLS lo impone; aquí se oculta el botón).
  const canDelete = (item: DbActionItem) =>
    (!!user && item.created_by === user.id) || profile?.role === 'super_admin'

  const handleDelete = async (item: DbActionItem) => {
    if (!selectedProjectId) return
    if (!confirm('¿Eliminar esta acción?')) return
    const projectId = selectedProjectId
    setActionError(null)
    try {
      await deleteActionItem(item.id)
      await refreshManual(projectId)
    } catch (err) {
      if (selectedProjectRef.current !== projectId) return
      console.error('[ActionPlan] Error deleting item:', err)
      setActionError(errorMessage(err, 'No se pudo eliminar la acción.'))
    }
  }

  // Reordenar de uno en uno: mientras hay una reordenación en curso los botones
  // ▲/▼ quedan deshabilitados, para que los UPDATEs de dos clics no se mezclen.
  const handleMove = async (index: number, direction: 'up' | 'down') => {
    if (reordering || !selectedProjectId) return
    const projectId = selectedProjectId
    const next = [...manualItems]
    const swap = direction === 'up' ? index - 1 : index + 1
    if (swap < 0 || swap >= next.length) return
    ;[next[index], next[swap]] = [next[swap], next[index]]
    setManualItems(next)
    setActionError(null)
    setReordering(true)
    try {
      // `next` lleva el sort_order ACTUAL de cada fila: solo se actualizan las que cambian
      await reorderActionItems(next)
      if (selectedProjectRef.current !== projectId) return
      // Sincroniza el sort_order local con el que quedó en BD (0..n-1) para que
      // el siguiente movimiento compare contra valores reales.
      const newOrder = new Map(next.map((item, i) => [item.id, i]))
      setManualItems(prev => prev.map(item => {
        const order = newOrder.get(item.id)
        return order === undefined ? item : { ...item, sort_order: order }
      }))
    } catch (err) {
      if (selectedProjectRef.current !== projectId) return
      console.error('[ActionPlan] Error reordering items:', err)
      await refreshManual(projectId)
      setActionError(`No se pudo cambiar el orden: ${errorMessage(err, 'error desconocido')}`)
    } finally {
      setReordering(false)
    }
  }

  // Solo se monta cuando hace falta; va en la misma posición en todos los
  // returns para no desmontarse (y re-analizar) al cambiar de rama.
  const localProbe = needsLocalFallback ? <LocalAnalysisProbe onResult={setLocalResult} /> : null

  // ─── Loading / Empty states ────────────────────────────────────
  if (loadingProjects) {
    return (
      <div className="space-y-6 py-8 px-8 max-w-[1440px] mx-auto w-full">
        <div className="flex items-center gap-2 text-[#52695b]">
          <Loader2 size={16} className="animate-spin text-[#006c48]" />
          <span className="text-sm">Cargando auditoría…</span>
        </div>
      </div>
    )
  }

  // Could not load the project list: error + retry (not the "no projects" empty state)
  if (!hasProjects && loadError) {
    return (
      <div className="space-y-6 py-8 px-8 max-w-[1440px] mx-auto w-full">
        <h2 className="text-xl font-semibold text-[#1a2e23]">Auditoría CSS</h2>
        <Card className="p-8 text-center" role="alert">
          <AlertTriangle className="h-10 w-10 mx-auto mb-3 text-[#9e2b25]" />
          <h3 className="text-base font-semibold text-[#9e2b25] mb-1">No se pudieron cargar los proyectos</h3>
          <p className="text-sm text-[#52695b] max-w-md mx-auto mb-4">{loadError}</p>
          <Button size="sm" variant="outline" onClick={() => setProjectsReloadKey(k => k + 1)}>
            Reintentar
          </Button>
        </Card>
      </div>
    )
  }

  // No projects in the DB at all and no local result either
  if (!hasProjects && !activeResult) {
    return (
      <>
      {localProbe}
      <div className="space-y-6 py-8 px-8 max-w-[1440px] mx-auto w-full">
        <div>
          <h2 className="text-xl font-semibold text-[#1a2e23]">Auditoría CSS</h2>
          <p className="text-sm text-[#52695b] mt-1">
            Crea un proyecto y guarda un escaneo desde{' '}
            <Link to="/analyze" className="text-[#006c48] underline font-medium">Analizar</Link>{' '}
            para que todo el equipo pueda ver la auditoría.
          </p>
        </div>
        <Card className="p-12 text-center">
          <Target className="h-16 w-16 mx-auto mb-4 text-[#52695b]/30" />
          <h3 className="text-lg font-semibold text-[#52695b] mb-2">Aún no hay auditorías</h3>
          <p className="text-sm text-[#8a9b92] max-w-md mx-auto mb-6">
            Pega tu CSS, guárdalo dentro de un proyecto y la auditoría quedará disponible para
            cualquier usuario autenticado.
          </p>
          <Link
            to="/analyze"
            className="inline-flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
            style={{ background: '#012d1d' }}
          >
            <Code size={16} />
            Ir a Analizar
          </Link>
        </Card>
      </div>
      </>
    )
  }

  const healthColor = activeResult ? getScoreBand(activeResult.healthScore).color : '#52695b'

  // Severity colors used by the manual-action form & cards
  const sevColor: Record<ActionPriority, string> = { critical: '#9e2b25', high: '#a67c00', medium: '#52695b', low: '#006c48' }
  const sevBg: Record<ActionPriority, string> = { critical: '#fbe8e6', high: '#fbf2d9', medium: '#f0f2f1', low: '#e5f2ec' }
  const sevLabel: Record<ActionPriority, string> = { critical: 'Crítico', high: 'Alto', medium: 'Medio', low: 'Bajo' }

  const totalActions = autoActions.length + manualItems.length

  return (
    <>
    {localProbe}
    <div className="space-y-6 py-8 px-8 max-w-[1440px] mx-auto w-full">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-[#1a2e23]">Auditoría CSS</h2>
          <p className="text-sm text-[#52695b] mt-1">
            {totalActions} {totalActions === 1 ? 'acción' : 'acciones'} en el proyecto seleccionado
            {activeResult && (
              <>
                <span className="mx-2">·</span>
                Health Score: <span className="font-bold" style={{ color: healthColor }}>{activeResult.healthScore}/100</span>
                <span className="mx-2">·</span>
                {(activeResult.fileSize / 1024).toFixed(0)} KB · {activeResult.lineCount.toLocaleString()} lineas
              </>
            )}
          </p>
          {loadError && (
            <p className="text-xs text-[#9e2b25] mt-1">{loadError}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {projects.length > 0 && (
            <select
              value={selectedProjectId || ''}
              onChange={(e) => setSelectedProjectId(e.target.value || null)}
              className="px-3 py-2 rounded-lg text-sm bg-white text-[#0b1f16] focus:outline-none focus:ring-2 focus:ring-[#006c48]"
              style={{ border: '1px solid rgba(11, 31, 22, 0.14)' }}
            >
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
          <Button
            onClick={() => { resetForm(); setShowForm(true) }}
            size="sm"
            disabled={!selectedProjectId}
            className="gap-2 h-9"
            style={{ background: '#012d1d' }}
          >
            <Plus size={14} />
            Añadir acción
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <ActionSummary autoActions={autoActions} manualItems={manualItems} />

      {/* Loading indicator while pulling the latest scan */}
      {loadingDetail && (
        <div className="flex items-center gap-2 text-[#52695b]">
          <Loader2 size={14} className="animate-spin text-[#006c48]" />
          <span className="text-xs">Cargando último escaneo del proyecto…</span>
        </div>
      )}

      {/* Errores de carga / borrado / reordenación de las acciones del equipo */}
      {actionError && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg px-3 py-2 text-xs text-[#9e2b25] bg-[#fbe8e6]"
        >
          <AlertTriangle size={14} className="shrink-0 mt-px" />
          <span className="flex-1">{actionError}</span>
          <button
            onClick={() => setActionError(null)}
            className="p-0.5 rounded hover:bg-[#9e2b25]/10 transition-colors shrink-0"
            aria-label="Cerrar aviso"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* Manual (user-created) action items — shown on top so creator attribution is visible first */}
      {manualItems.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <UserRound size={16} className="text-[#006c48]" />
            <h3 className="text-sm font-semibold uppercase tracking-wider text-[#006c48]">
              Acciones del equipo ({manualItems.length})
            </h3>
            <div className="flex-1 h-px bg-[#006c48]/20" />
          </div>
          <div className="space-y-3">
            {manualItems.map((item, idx) => (
              <Card
                key={item.id}
                className="p-4 group"
                style={{ borderLeft: `3px solid ${sevColor[item.priority]}` }}
              >
                <div className="flex items-start gap-3">
                  {/* Reorder */}
                  <div className="flex flex-col gap-0.5 shrink-0 pt-0.5">
                    <button
                      onClick={() => handleMove(idx, 'up')}
                      disabled={idx === 0 || reordering}
                      className="p-0.5 rounded hover:bg-[#f0f2f1] disabled:opacity-20 transition-opacity"
                      title="Subir"
                      aria-label={`Subir «${item.title}»`}
                    >
                      <ChevronUp size={14} className="text-[#52695b]" />
                    </button>
                    <button
                      onClick={() => handleMove(idx, 'down')}
                      disabled={idx === manualItems.length - 1 || reordering}
                      className="p-0.5 rounded hover:bg-[#f0f2f1] disabled:opacity-20 transition-opacity"
                      title="Bajar"
                      aria-label={`Bajar «${item.title}»`}
                    >
                      <ChevronDown size={14} className="text-[#52695b]" />
                    </button>
                  </div>
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Badge
                        className="text-[10px] px-1.5 py-0"
                        style={{ background: sevBg[item.priority], color: sevColor[item.priority] }}
                      >
                        {sevLabel[item.priority]}
                      </Badge>
                      <h4 className="text-sm font-semibold text-[#1a2e23]">{item.title}</h4>
                    </div>
                    {item.description && (
                      <p className="text-xs text-[#52695b] mt-0.5">{item.description}</p>
                    )}
                    <p
                      className="text-[10px] text-[#52695b] mt-2 flex items-center gap-1"
                      title={item.creator?.email || ''}
                    >
                      <UserRound size={11} className="text-[#52695b]" />
                      Creada por{' '}
                      <span className="font-medium text-[#1a2e23]">
                        {item.creator?.full_name || item.creator?.email?.split('@')[0] || 'desconocido'}
                      </span>
                      <span className="text-[#a3b3ab]">
                        {' '}· {new Date(item.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: '2-digit' })}
                      </span>
                    </p>
                  </div>
                  {/* Actions — editar: cualquiera; eliminar: solo autor o super_admin */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity shrink-0">
                    <button
                      onClick={() => handleEdit(item)}
                      className="p-1.5 rounded hover:bg-[#f0f2f1] transition-colors"
                      title="Editar"
                      aria-label={`Editar «${item.title}»`}
                    >
                      <Pencil size={13} className="text-[#52695b]" />
                    </button>
                    {canDelete(item) && (
                      <button
                        onClick={() => handleDelete(item)}
                        className="p-1.5 rounded hover:bg-[#fbe8e6] transition-colors"
                        title="Eliminar"
                        aria-label={`Eliminar «${item.title}»`}
                      >
                        <Trash2 size={13} className="text-[#9e2b25]" />
                      </button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {manualLoading && manualItems.length === 0 && (
        <div className="flex items-center gap-2 text-[#52695b]">
          <Loader2 size={14} className="animate-spin text-[#006c48]" />
          <span className="text-xs">Cargando acciones del equipo…</span>
        </div>
      )}

      {/* Auto-generated actions grouped by priority */}
      {(['critical', 'high', 'medium', 'low'] as Priority[]).map(priority => {
        const items = autoActions.filter(a => a.priority === priority)
        if (items.length === 0) return null
        const cfg = PRIORITY_CONFIG[priority]

        return (
          <div key={priority}>
            <div className="flex items-center gap-2 mb-3">
              {cfg.icon}
              <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: cfg.color }}>
                Auto · {cfg.label} ({items.length})
              </h3>
              <div className="flex-1 h-px" style={{ backgroundColor: `${cfg.color}20` }} />
            </div>

            <div className="space-y-4">
              {items.map(item => (
                <Card key={item.id} className={`p-5 border ${cfg.border} hover:shadow-md transition-shadow`}>
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 mt-0.5">{item.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-sm font-semibold text-[#1a2e23]">{item.title}</h4>
                        <Badge className={`${cfg.bg} text-[10px] px-1.5 py-0 shrink-0`} style={{ color: cfg.color }}>
                          {typeof item.metric === 'number' ? item.metric.toLocaleString() : item.metric}
                        </Badge>
                      </div>
                      <span className="text-[10px] font-medium text-[#3d5a4a] uppercase tracking-wider">{item.category}</span>
                      <p className="text-xs text-[#3d5a4a] mt-2 leading-relaxed">{item.description}</p>

                      <div className="mt-3 space-y-2">
                        <div className="flex items-start gap-2">
                          <TrendingDown size={12} className="text-[#006c48] shrink-0 mt-0.5" />
                          <p className="text-[11px] text-[#006c48]"><span className="font-semibold">Impacto:</span> {item.impact}</p>
                        </div>
                        <div className="flex items-start gap-2">
                          <ArrowRight size={12} className="text-[#1a2e23] shrink-0 mt-0.5" />
                          <p className="text-[11px] text-[#1a2e23]"><span className="font-semibold">Como arreglarlo:</span> {item.howToFix}</p>
                        </div>
                      </div>

                      {/* Data detail table */}
                      {item.detailHeaders && item.detailRows && item.detailRows.length > 0 && (
                        <DetailTable headers={item.detailHeaders} rows={item.detailRows} />
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )
      })}

      {/* All good message — only when there's literally nothing to do */}
      {totalActions === 0 && activeResult && (
        <Card className="p-8 text-center bg-[#e0f5ec] border-[#006c48]/20">
          <CheckCircle className="h-12 w-12 mx-auto mb-3 text-[#006c48]" />
          <h3 className="text-lg font-semibold text-[#006c48] mb-1">Tu CSS está en buen estado</h3>
          <p className="text-sm text-[#3d5a4a]">No se encontraron problemas significativos. Sigue así.</p>
        </Card>
      )}

      {/* The latest scan could not be loaded: error + retry (NOT the "no scans" state) */}
      {hasProjects && selectedProjectId && detailError && !loadingDetail && (
        <Card className="p-8 text-center" role="alert">
          <AlertTriangle className="h-12 w-12 mx-auto mb-3 text-[#9e2b25]" />
          <h3 className="text-base font-semibold text-[#9e2b25] mb-1">No se pudo cargar el último escaneo</h3>
          <p className="text-sm text-[#52695b] max-w-md mx-auto mb-4">{detailError}</p>
          <Button size="sm" variant="outline" onClick={() => setDetailReloadKey(k => k + 1)}>
            Reintentar
          </Button>
        </Card>
      )}

      {/* The selected project really has no scans yet: guide the user */}
      {hasProjects && selectedProjectId && detailLoadedFor === selectedProjectId && !latestDetail && !detailError && (
        <Card className="p-8 text-center">
          <Target className="h-12 w-12 mx-auto mb-3 text-[#52695b]/40" />
          <h3 className="text-base font-semibold text-[#52695b] mb-1">Este proyecto no tiene escaneos todavía</h3>
          <p className="text-sm text-[#8a9b92] max-w-md mx-auto mb-4">
            Guarda un escaneo en este proyecto desde la página Analizar y la auditoría aparecerá aquí
            para todos los miembros del equipo.
          </p>
          <Link
            to="/analyze"
            className="inline-flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
            style={{ background: '#012d1d' }}
          >
            <Code size={16} />
            Ir a Analizar
          </Link>
        </Card>
      )}

      {/* ─── Add / Edit modal ───────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={resetForm}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={dialogTitleId}
            className="relative w-full max-w-md mx-4 rounded-2xl p-6 shadow-xl"
            style={{ background: '#ffffff', border: '1px solid rgba(11, 31, 22, 0.08)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 id={dialogTitleId} className="text-base font-semibold text-[#1a2e23]">
                {editingId ? 'Editar acción' : 'Nueva acción'}
              </h3>
              <button onClick={resetForm} aria-label="Cerrar" className="p-1.5 rounded-lg hover:bg-[#f0f2f1] transition-colors">
                <X size={18} className="text-[#52695b]" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label htmlFor={titleInputId} className="block text-sm font-medium text-[#1a2e23] mb-1.5">Título</label>
                <input
                  ref={titleInputRef}
                  id={titleInputId}
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Ej: Migrar variables de color a tokens DS..."
                  className="w-full px-3 py-2.5 rounded-lg text-sm bg-white text-[#0b1f16] focus:outline-none focus:ring-2 focus:ring-[#006c48]"
                  style={{ border: '1px solid rgba(11, 31, 22, 0.14)' }}
                />
              </div>
              <div>
                {/* No es un <label>: agrupa botones, no un input */}
                <span id={priorityLabelId} className="block text-sm font-medium text-[#1a2e23] mb-1.5">Prioridad</span>
                <div className="flex gap-2" role="group" aria-labelledby={priorityLabelId}>
                  {(['critical', 'high', 'medium', 'low'] as ActionPriority[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      aria-pressed={formPriority === p}
                      onClick={() => setFormPriority(p)}
                      className="flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all"
                      style={{
                        background: formPriority === p ? sevBg[p] : 'transparent',
                        color: sevColor[p],
                        border: `1.5px solid ${formPriority === p ? sevColor[p] : 'rgba(11,31,22,0.1)'}`,
                        opacity: formPriority === p ? 1 : 0.5,
                      }}
                    >
                      {sevLabel[p]}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label htmlFor={descriptionInputId} className="block text-sm font-medium text-[#1a2e23] mb-1.5">
                  Descripción <span className="text-[#8a9b92] font-normal">(opcional)</span>
                </label>
                <textarea
                  id={descriptionInputId}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Contexto, pasos, notas..."
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-lg text-sm bg-white text-[#0b1f16] resize-none focus:outline-none focus:ring-2 focus:ring-[#006c48]"
                  style={{ border: '1px solid rgba(11, 31, 22, 0.14)' }}
                />
              </div>
              {formError && (
                <p role="alert" className="text-xs text-[#9e2b25]">{formError}</p>
              )}
              <div className="flex gap-3 pt-2">
                <Button
                  className="flex-1 h-10"
                  style={{ background: '#012d1d' }}
                  onClick={handleSaveForm}
                  disabled={!formTitle.trim() || savingForm}
                >
                  {savingForm
                    ? 'Guardando…'
                    : editingId ? 'Guardar cambios' : 'Añadir acción'}
                </Button>
                <Button variant="outline" className="flex-1 h-10" onClick={resetForm}>
                  Cancelar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  )
}
