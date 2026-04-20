import { useState, useEffect, useRef, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import type { AnalysisResult } from '@/types/analysis'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScanDetailModal } from './ScanDetailModal'
import { ConfrontarTab } from './ConfrontarTab'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import { ScoreRing } from '@/components/ui/ScoreRing'
import { classifyFamily } from '@/lib/font-utils'
import type { Project, Scan, ScanDetail, ActionItem, ActionPriority } from '@/lib/scan-storage'
import { getActionItems, createActionItem, updateActionItem, deleteActionItem, reorderActionItems, deleteScan } from '@/lib/scan-storage'
import { analyzeCss } from '@/lib/analyzer'
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
  ReferenceLine,
  AreaChart,
  Area,
} from 'recharts'
import {
  FileText,
  Ruler,
  Hash,
  AtSign,
  AlertTriangle,
  Variable,
  Layers,
  FileCode,
  Copy,
  Recycle,
  ShieldCheck,
  Palette,
  Type,
  Loader2,
  XCircle,
  CheckCircle,
  Plus,
  GripVertical,
  Pencil,
  Trash2,
  X,
  ChevronUp,
  ChevronDown,
  Eye,
  Zap,
  Grid3X3,
} from 'lucide-react'


// ─── Section Header ────────────────────────────────────────────────
function SectionHeader({ title, tooltip, children }: { title: string; tooltip?: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold text-[#1a2e23]">{title}</h2>
        {tooltip && <InfoTooltip text={tooltip} />}
      </div>
      {children}
    </div>
  )
}

// ─── Metric Card ───────────────────────────────────────────────────
function MetricCard({
  icon: Icon,
  label,
  value,
  unit,
  color = '#006c48',
  delta,
  invertDelta = false,
  tooltip,
}: {
  icon: React.ElementType
  label: string
  value: string | number
  unit?: string
  color?: string
  delta?: number | null
  invertDelta?: boolean
  tooltip?: string
}) {
  const showDelta = delta !== undefined && delta !== null && delta !== 0
  const isPositive = invertDelta ? delta! < 0 : delta! > 0

  return (
    <Card className="p-4 flex items-center gap-3">
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${color}15` }}
      >
        <Icon size={20} style={{ color }} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="text-xs text-[#3d5a4a] truncate">{label}</p>
          {tooltip && <InfoTooltip text={tooltip} />}
        </div>
        <div className="flex items-baseline gap-2">
          <p className="text-lg font-bold text-[#1a2e23] leading-tight">
            {value}
            {unit && <span className="text-sm font-normal text-[#3d5a4a] ml-0.5">{unit}</span>}
          </p>
          {showDelta && (
            <span className={`text-xs font-semibold flex items-center gap-0.5 ${isPositive ? 'text-[#006c48]' : 'text-[#9e2b25]'}`}>
              {isPositive ? '\u25B2' : '\u25BC'}
              {Math.abs(delta!).toLocaleString()}
            </span>
          )}
        </div>
      </div>
    </Card>
  )
}

// ─── Coverage Bar ──────────────────────────────────────────────────
function CoverageBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-[#3d5a4a]">{label}</span>
        <span className="font-semibold text-[#1a2e23]">{value.toFixed(0)}%</span>
      </div>
      <div className="h-2 bg-[#f0f2f1] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.min(value, 100)}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}

// ─── Chart Title with Delta ────────────────────────────────────────
function ChartTitle({ title, tooltip, first, last, downIsGood = true }: {
  title: string; tooltip: string; first?: number; last?: number; downIsGood?: boolean
}) {
  const hasDelta = first !== undefined && last !== undefined && first !== 0
  const diff = hasDelta ? last! - first! : 0
  const pct = hasDelta ? Math.round((diff / first!) * 100) : 0
  const isGood = downIsGood ? diff <= 0 : diff >= 0

  return (
    <div className="flex items-center gap-2 mb-3">
      <h3 className="text-sm font-semibold text-[#1a2e23]">{title}</h3>
      {hasDelta && pct !== 0 && (
        <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${
          isGood ? 'bg-[#e0f5ec] text-[#006c48]' : 'bg-[#fef2f1] text-[#9e2b25]'
        }`}>
          {pct > 0 ? '▲' : '▼'} {Math.abs(pct)}%
        </span>
      )}
      {hasDelta && pct === 0 && diff === 0 && (
        <span className="inline-flex items-center text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-[#f0f2f1] text-[#3d5a4a]">
          = sin cambio
        </span>
      )}
      <InfoTooltip text={tooltip} />
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────
export function DashboardPage() {
  const { signOut } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [scans, setScans] = useState<Scan[]>([])
  const [latestDetail, setLatestDetail] = useState<ScanDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [scansLoading, setScansLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedScanId, setSelectedScanId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('resumen')
  const [allScanDetails, setAllScanDetails] = useState<Map<string, ScanDetail>>(new Map())

  // ── Action items state ──
  const [actionItems, setActionItems] = useState<ActionItem[]>([])
  const [actionLoading, setActionLoading] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [expandedAutoItems, setExpandedAutoItems] = useState<Set<number>>(new Set())
  const [planScanId, setPlanScanId] = useState<string | null>(null)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [formTitle, setFormTitle] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formPriority, setFormPriority] = useState<ActionPriority>('medium')

  // ── HG5 Confrontar state ──
  const hg5FetchedRef = useRef(false)
  const [hg5Result, setHg5Result] = useState<AnalysisResult | null>(null)
  const [hg5Loading, setHg5Loading] = useState(false)
  const [hg5Error, setHg5Error] = useState<string | null>(null)

  // ── Safety timeout: never stay on "Cargando" forever ──
  useEffect(() => {
    const t = setTimeout(() => {
      if (loading) {
        console.warn('[Dashboard] Safety timeout reached – forcing loading=false')
        setLoading(false)
      }
    }, 8000)
    return () => clearTimeout(t)
  }, [loading])

  // ── Load projects ──
  useEffect(() => {
    loadProjects()
  }, [])

  const loadProjects = async () => {
    try {
      setLoading(true)
      setError(null)

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setError('No hay sesión activa. Inicia sesión para continuar.')
        setLoading(false)
        return
      }
      console.log('[Dashboard] Session found for:', session.user.email)

      console.log('[Dashboard] Fetching projects via REST...')
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10000)
      let projectsList: Project[]
      try {
        const restResp = await fetch(
          'https://lqgdrkwabcjrnnthlrmi.supabase.co/rest/v1/projects?select=*&order=created_at.desc',
          {
            signal: controller.signal,
            headers: {
              'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxxZ2Rya3dhYmNqcm5udGhscm1pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzMzIzMTQsImV4cCI6MjA5MTkwODMxNH0.0qhUexm2vPc-wDnX-G7w5Gg82Y2_Jow_v-9kWqL29AQ',
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=representation',
            }
          }
        )
        clearTimeout(timeout)
        console.log('[Dashboard] REST response status:', restResp.status)
        if (!restResp.ok) {
          const errText = await restResp.text()
          throw new Error(`Error ${restResp.status}: ${errText}`)
        }
        projectsList = await restResp.json()
        console.log('[Dashboard] Got', projectsList.length, 'projects')
      } catch (fetchErr) {
        clearTimeout(timeout)
        if (fetchErr instanceof DOMException && fetchErr.name === 'AbortError') {
          throw new Error('La conexión con Supabase tardó demasiado. Verifica tu conexión a internet.')
        }
        throw fetchErr
      }
      setProjects(projectsList)
      if (projectsList.length > 0 && !selectedProjectId) {
        setSelectedProjectId(projectsList[0].id)
      }
    } catch (err) {
      console.error('Error loading projects:', err)
      setError(err instanceof Error ? err.message : 'Error al cargar los proyectos.')
    } finally {
      setLoading(false)
    }
  }

  // ── Load scans + latest detail ──
  useEffect(() => {
    if (selectedProjectId) {
      loadScans(selectedProjectId)
    }
  }, [selectedProjectId])

  const restFetch = async (path: string) => {
    const { data: { session } } = await supabase.auth.getSession()
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), 10000)
    const r = await fetch(`https://lqgdrkwabcjrnnthlrmi.supabase.co/rest/v1/${path}`, {
      signal: controller.signal,
      headers: {
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxxZ2Rya3dhYmNqcm5udGhscm1pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzMzIzMTQsImV4cCI6MjA5MTkwODMxNH0.0qhUexm2vPc-wDnX-G7w5Gg82Y2_Jow_v-9kWqL29AQ',
        'Authorization': `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json',
      }
    })
    clearTimeout(t)
    if (!r.ok) throw new Error(`REST ${r.status}`)
    return r.json()
  }

  const loadScans = async (projectId: string) => {
    try {
      setScansLoading(true)
      console.log('[Dashboard] Loading scans for project:', projectId)

      const scansList: Scan[] = await restFetch(
        `scans?select=*&project_id=eq.${projectId}&order=created_at.desc`
      )
      console.log('[Dashboard] Got', scansList.length, 'scans')
      setScans(scansList)

      if (scansList.length > 0) {
        const scanIds = scansList.map(s => s.id)
        try {
          const details = await restFetch(
            `scan_details?select=scan_id,analysis_data,w3c_validation,ds_coverage&scan_id=in.(${scanIds.join(',')})`
          )
          const detailMap = new Map<string, ScanDetail>()
          for (const d of details) {
            const scan = scansList.find(s => s.id === d.scan_id)
            if (scan) {
              detailMap.set(d.scan_id, {
                ...scan,
                analysis_data: d.analysis_data || {},
                w3c_validation: d.w3c_validation,
                ds_coverage: d.ds_coverage,
              } as ScanDetail)
            }
          }
          setAllScanDetails(detailMap)

          const latestD = detailMap.get(scansList[0].id)
          setLatestDetail(latestD || null)
        } catch (detailErr) {
          console.warn('[Dashboard] Could not load scan details:', detailErr)
          setLatestDetail(null)
          // No details to map
        }
      } else {
        setLatestDetail(null)
      }
    } catch (err) {
      console.error('[Dashboard] Error loading scans:', err)
      setScans([])
      setLatestDetail(null)
    } finally {
      setScansLoading(false)
    }
  }

  // ── Fetch HG5 CSS when confrontar tab is selected ──
  const loadHg5 = async () => {
    if (hg5FetchedRef.current || hg5Loading) return
    setHg5Loading(true)
    setHg5Error(null)
    try {
      // Use Vite proxy in dev to avoid CORS, fallback to direct URL in production
      const base = import.meta.env.DEV ? '/api/hg5' : 'https://hg5.netlify.app'
      const [outputResp, duttiResp] = await Promise.all([
        fetch(`${base}/output.css`),
        fetch(`${base}/themes/dutti.css`),
      ])
      if (!outputResp.ok) throw new Error(`output.css: ${outputResp.status}`)
      if (!duttiResp.ok) throw new Error(`dutti.css: ${duttiResp.status}`)
      const [outputCss, duttiCss] = await Promise.all([outputResp.text(), duttiResp.text()])
      const combined = `/* === output.css === */\n${outputCss}\n\n/* === dutti.css === */\n${duttiCss}`
      const result = analyzeCss(combined)
      setHg5Result(result)
      hg5FetchedRef.current = true
    } catch (err) {
      console.error('[HG5] Error fetching:', err)
      setHg5Error(err instanceof Error ? err.message : 'Error al cargar el CSS de HG5')
    } finally {
      setHg5Loading(false)
    }
  }

  useEffect(() => {
    if ((activeTab === 'confrontar' || activeTab === 'resumen') && !hg5FetchedRef.current) {
      loadHg5()
    }
  }, [activeTab])

  // ── Load action items when project changes or plan tab shown ──
  useEffect(() => {
    if (selectedProjectId && activeTab === 'plan') {
      loadActionItems(selectedProjectId)
    }
  }, [selectedProjectId, activeTab])

  const loadActionItems = async (projectId: string) => {
    try {
      setActionLoading(true)
      const items = await getActionItems(projectId)
      setActionItems(items)
    } catch (err) {
      console.error('[Dashboard] Error loading action items:', err)
    } finally {
      setActionLoading(false)
    }
  }

  const resetForm = () => {
    setFormTitle('')
    setFormDescription('')
    setFormPriority('medium')
    setShowAddForm(false)
    setEditingItemId(null)
  }

  const handleAddItem = async () => {
    if (!formTitle.trim() || !selectedProjectId) return
    try {
      await createActionItem(selectedProjectId, formTitle.trim(), formPriority, formDescription.trim())
      resetForm()
      await loadActionItems(selectedProjectId)
    } catch (err) {
      console.error('Error creating action item:', err)
    }
  }

  const handleUpdateItem = async () => {
    if (!editingItemId || !formTitle.trim()) return
    try {
      await updateActionItem(editingItemId, {
        title: formTitle.trim(),
        description: formDescription.trim(),
        priority: formPriority,
      })
      resetForm()
      if (selectedProjectId) await loadActionItems(selectedProjectId)
    } catch (err) {
      console.error('Error updating action item:', err)
    }
  }

  const handleDeleteItem = async (id: string) => {
    try {
      await deleteActionItem(id)
      if (selectedProjectId) await loadActionItems(selectedProjectId)
    } catch (err) {
      console.error('Error deleting action item:', err)
    }
  }

  const handleMoveItem = async (index: number, direction: 'up' | 'down') => {
    const newItems = [...actionItems]
    const swapIdx = direction === 'up' ? index - 1 : index + 1
    if (swapIdx < 0 || swapIdx >= newItems.length) return
    ;[newItems[index], newItems[swapIdx]] = [newItems[swapIdx], newItems[index]]
    setActionItems(newItems)
    try {
      await reorderActionItems(newItems.map(i => i.id))
    } catch (err) {
      console.error('Error reordering:', err)
      if (selectedProjectId) await loadActionItems(selectedProjectId)
    }
  }

  const startEdit = (item: ActionItem) => {
    setEditingItemId(item.id)
    setFormTitle(item.title)
    setFormDescription(item.description)
    setFormPriority(item.priority)
    setShowAddForm(true)
  }

  // ── Derived data ──
  const selectedProject = projects.find((p) => p.id === selectedProjectId)
  const latestScan = scans.length > 0 ? scans[0] : null
  const previousScan = scans.length > 1 ? scans[1] : null
  const chronologicalScans = [...scans].reverse()

  const getDelta = (current: number, previous: number | undefined) => {
    if (previous === undefined) return null
    const diff = current - previous
    if (diff === 0) return null
    return diff
  }

  // ── Chart data ──
  const healthScoreChartData = chronologicalScans.map((s) => ({
    date: new Date(s.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }),
    score: s.health_score,
  }))

  const weightChartData = chronologicalScans.map((s) => ({
    date: new Date(s.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }),
    peso: +(s.file_size / 1024).toFixed(1),
    lineas: s.line_count,
  }))

  const selectorsChartData = chronologicalScans.map((s) => ({
    date: new Date(s.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }),
    declaraciones: s.total_declarations,
    selectores: s.total_selectors,
    unicas: s.unique_declarations,
  }))

  const importantChartData = chronologicalScans.map((s) => ({
    date: new Date(s.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }),
    important: s.important_count,
    ids: s.id_count,
  }))

  const reuseChartData = chronologicalScans.map((s) => ({
    date: new Date(s.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }),
    ratio: +(s.reuse_ratio * 100).toFixed(1),
  }))

  // Legacy reduction charts (need analysis_data from all scans)
  const hardcodedColorsChartData = useMemo(() => chronologicalScans.map((s) => {
    const detail = allScanDetails.get(s.id)
    const ad = detail?.analysis_data as AnalysisResult | undefined
    return {
      date: new Date(s.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }),
      colores: ad?.colors?.length || 0,
    }
  }), [chronologicalScans, allScanDetails])

  const fontsToEliminateChartData = useMemo(() => chronologicalScans.map((s) => {
    const detail = allScanDetails.get(s.id)
    const ad = detail?.analysis_data as AnalysisResult | undefined
    const badFonts = (ad?.fontFamilies || []).filter(f => classifyFamily(f.normalized || f.value) === 'eliminate')
    return {
      date: new Date(s.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }),
      fuentes: badFonts.reduce((sum, f) => sum + f.count, 0),
    }
  }), [chronologicalScans, allScanDetails])

  // ── HG5 Compliance evolution data ──
  const hg5EvolutionData = useMemo(() => {
    if (!hg5Result) return null
    const hg5 = hg5Result

    return chronologicalScans.map((s) => {
      const detail = allScanDetails.get(s.id)
      const ad = detail?.analysis_data as AnalysisResult | undefined
      const date = new Date(s.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })

      if (!ad) return { date, score: 0, coloresUser: 0, importantUser: 0, idsUser: 0, badFonts: 0, spacingUser: 0, reuseUser: 0 }

      const badFonts = (ad.fontFamilies || []).filter(f => classifyFamily(f.normalized || f.value) === 'eliminate')

      // Compute a simple compliance score per scan
      let good = 0
      let total = 0
      const check = (userVal: number, hg5Val: number, lowerBetter: boolean) => {
        total++
        const diff = userVal - hg5Val
        const pctDiff = hg5Val !== 0 ? Math.abs(diff / hg5Val) * 100 : (diff === 0 ? 0 : 100)
        if (lowerBetter ? diff <= 0 : diff >= 0) good++
        else if (pctDiff <= 5) good++
      }
      check(ad.importantCount, hg5.importantCount, true)
      check(ad.idCount, hg5.idCount, true)
      check(ad.colors.length, hg5.colors.length, true)
      check(ad.duplicateSelectors.length, hg5.duplicateSelectors.length, true)
      check(ad.duplicateDeclarations.length, hg5.duplicateDeclarations.length, true)
      check(ad.vendorPrefixCount, hg5.vendorPrefixCount, true)
      check(ad.reuseRatio, hg5.reuseRatio, false)
      check(ad.variableCount, hg5.variableCount, false)
      check(badFonts.length, 0, true)
      check(ad.spacingValues.length, hg5.spacingValues.length, true)

      const compliance = total > 0 ? Math.round((good / total) * 100) : 0

      return {
        date,
        cumplimiento: compliance,
        coloresUser: ad.colors.length,
        importantUser: ad.importantCount,
        idsUser: ad.idCount,
        badFonts: badFonts.length,
        spacingUser: ad.spacingValues.length,
        reuseUser: +(ad.reuseRatio * 100).toFixed(1),
        scoreUser: ad.healthScore,
      }
    })
  }, [chronologicalScans, allScanDetails, hg5Result])




  // ── Loading / Error states ──
  if (loading && projects.length === 0) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-[#52695b]">Cargando...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <AlertTriangle size={32} className="text-[#9e2b25]" />
        <p className="text-[#9e2b25] text-center max-w-md">{error}</p>
        <div className="flex gap-3">
          <Button onClick={loadProjects} variant="outline" size="sm">
            Reintentar
          </Button>
          <Button
            onClick={() => signOut()}
            variant="outline"
            size="sm"
            className="text-[#9e2b25] border-[#9e2b25]"
          >
            Cerrar sesion y reiniciar
          </Button>
        </div>
      </div>
    )
  }

  const TABS = [
    { id: 'resumen', label: 'Resumen' },
    { id: 'confrontar', label: 'Confrontar HG5' },
    { id: 'plan', label: 'Plan de Acción' },
  ]

  // ── Render ──
  return (
    <div className="flex flex-col w-full">
      {/* ═══════════════════════════════════════════════════════════════════
          DASHBOARD SUB-HEADER (Row 2: project, tabs, scan selector)
          Sticky below the main EditorialHeader
          ═══════════════════════════════════════════════════════════════════ */}
      <div
        className="sticky top-[57px] z-20 backdrop-blur-xl border-b"
        style={{ background: 'rgba(246, 247, 245, 0.92)', borderColor: 'rgba(11, 31, 22, 0.08)' }}
      >
        <div className="px-8 flex items-center gap-6">
          {/* Project selector */}
          <div className="flex items-center gap-3 py-2.5">
            <span className="text-[11px] uppercase tracking-[0.08em]" style={{ color: '#52695b', fontWeight: 500 }}>Proyecto</span>
            <select
              value={selectedProjectId || ''}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="appearance-none bg-transparent text-[13px] font-medium text-[#0b1f16] cursor-pointer focus:outline-none pr-6"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%23006c48' d='M1 1l5 5 5-5'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right center',
              }}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Vertical separator */}
          <div style={{ width: '1px', height: '24px', background: 'rgba(11, 31, 22, 0.08)' }} />

          {/* Tab buttons */}
          <div className="flex gap-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="relative px-3 py-3 text-[12px] font-medium transition-colors"
                style={{ color: activeTab === tab.id ? '#0b1f16' : '#52695b' }}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: '#006c48' }} />
                )}
              </button>
            ))}
          </div>

          {/* Scan count badge (pushed right) */}
          <div className="ml-auto flex items-center gap-2 pl-4" style={{ borderLeft: '1px solid rgba(11, 31, 22, 0.08)' }}>
            <span className="text-[11px] text-[#52695b]">{scans.length} escaneo{scans.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          MAIN CONTENT
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="flex-1 px-8 py-8 max-w-[1440px] mx-auto w-full">
        {scansLoading ? (
          <div className="flex items-center justify-center py-24 gap-3">
            <Loader2 className="animate-spin text-[#006c48]" size={24} />
            <p className="text-[#3d5a4a]">Cargando escaneos...</p>
          </div>
        ) : selectedProject ? (
          scans.length > 0 && latestScan ? (
            <div className="space-y-8">
              {/* ─── RESUMEN TAB ─── */}
              {activeTab === 'resumen' && (
                <div className="space-y-8">
                  {/* Hero: CSS Health Score */}
                  <Card className="p-6">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-lg font-semibold text-[#1a2e23]">CSS Health Score</h2>
                          <InfoTooltip text="Puntuacion de 0 a 100 que mide la calidad general de tu CSS. Considera duplicados, !important, IDs, especificidad, prefijos vendor y eficiencia shorthand." />
                        </div>
                        <p className="text-sm text-[#3d5a4a]">Evolucion de la calidad del CSS a lo largo de los escaneos</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <ScoreRing score={latestScan.health_score} size={80} />
                      </div>
                    </div>
                    <ResponsiveContainer width="100%" height={280}>
                      <LineChart data={healthScoreChartData}>
                        <defs>
                          <linearGradient id="healthLine" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#9e2b25" />
                            <stop offset="50%" stopColor="#a67c00" />
                            <stop offset="100%" stopColor="#006c48" />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f1" />
                        <XAxis dataKey="date" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                        <Tooltip
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
                          formatter={(value) => [`${value} / 100`, 'Health Score']}
                        />
                        <Line
                          type="monotone"
                          dataKey="score"
                          stroke="#006c48"
                          strokeWidth={3}
                          dot={{ fill: '#006c48', strokeWidth: 2, r: 5 }}
                          activeDot={{ r: 7, fill: '#006c48', stroke: '#fff', strokeWidth: 2 }}
                          name="Health Score"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </Card>

                  {/* Metrics Cards */}
                  <div>
                    <SectionHeader title="Metricas del ultimo escaneo" tooltip="Resumen de los KPIs clave del ultimo analisis CSS. Las flechas muestran la diferencia con el escaneo anterior." />
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                      <MetricCard icon={FileText} label="Peso" value={(latestScan.file_size / 1024).toFixed(1)} unit="KB" delta={previousScan ? +((latestScan.file_size - previousScan.file_size) / 1024).toFixed(1) : null} invertDelta tooltip="Tamano del archivo CSS en kilobytes. Un CSS mas ligero mejora el rendimiento de carga de la pagina." />
                      <MetricCard icon={Ruler} label="Lineas" value={latestScan.line_count.toLocaleString()} color="#2a9d6e" delta={getDelta(latestScan.line_count, previousScan?.line_count)} invertDelta tooltip="Total de lineas de codigo en el archivo CSS. Menos lineas = CSS mas facil de mantener." />
                      <MetricCard icon={Hash} label="Clases" value={latestScan.class_count.toLocaleString()} color="#006c48" delta={getDelta(latestScan.class_count, previousScan?.class_count)} tooltip="Selectores de clase (.nombre) usados. Las clases son la forma recomendada de aplicar estilos." />
                      <MetricCard icon={AtSign} label="IDs" value={latestScan.id_count.toLocaleString()} color="#a67c00" delta={getDelta(latestScan.id_count, previousScan?.id_count)} invertDelta tooltip="Selectores de ID (#nombre). Tienen alta especificidad y dificultan la reutilizacion. Evitalos en CSS." />
                      <MetricCard icon={AlertTriangle} label="!important" value={latestScan.important_count.toLocaleString()} color="#9e2b25" delta={getDelta(latestScan.important_count, previousScan?.important_count)} invertDelta tooltip="Veces que se usa !important para forzar prioridad. Indica problemas de especificidad y dificulta el mantenimiento." />
                      <MetricCard icon={Variable} label="Variables CSS" value={latestScan.variable_count.toLocaleString()} color="#2a9d6e" delta={getDelta(latestScan.variable_count, previousScan?.variable_count)} tooltip="Custom properties (--var) definidas. Usar variables mejora la consistencia y facilita cambios globales." />
                      <MetricCard icon={Layers} label="Selectores" value={latestScan.total_selectors.toLocaleString()} delta={getDelta(latestScan.total_selectors, previousScan?.total_selectors)} invertDelta tooltip="Total de reglas CSS definidas. Cada selector aplica estilos a uno o mas elementos del DOM." />
                      <MetricCard icon={FileCode} label="Declaraciones" value={latestScan.total_declarations.toLocaleString()} delta={getDelta(latestScan.total_declarations, previousScan?.total_declarations)} invertDelta tooltip="Total de propiedades CSS escritas (ej. color: red). Incluye repetidas." />
                      <MetricCard icon={Copy} label="Unicas" value={latestScan.unique_declarations.toLocaleString()} color="#5cc49a" delta={getDelta(latestScan.unique_declarations, previousScan?.unique_declarations)} invertDelta tooltip="Declaraciones no repetidas. La diferencia con el total indica cuanta duplicacion hay en tu CSS." />
                      <MetricCard icon={Recycle} label="Ratio reutilizacion" value={(latestScan.reuse_ratio * 100).toFixed(1)} unit="%" color={latestScan.reuse_ratio >= 0.5 ? '#006c48' : '#9e2b25'} delta={previousScan ? +((latestScan.reuse_ratio - previousScan.reuse_ratio) * 100).toFixed(1) : null} tooltip="Porcentaje de declaraciones repetidas vs unicas. Un ratio alto indica CSS eficiente con buena reutilizacion de estilos." />
                    </div>
                  </div>

                  {/* Typography + Validation + DS Coverage */}
                  {(() => {
                    const ad = latestDetail?.analysis_data as AnalysisResult | undefined
                    const families = ad?.fontFamilies || []
                    const weights = ad?.fontWeights || []
                    const sizes = ad?.fontSizes || []

                    const dsCount = families.filter(f => classifyFamily(f.normalized || f.value) === 'ds').reduce((s, f) => s + f.count, 0)
                    const genericCount = families.filter(f => classifyFamily(f.normalized || f.value) === 'generic').reduce((s, f) => s + f.count, 0)
                    const eliminateList = families.filter(f => classifyFamily(f.normalized || f.value) === 'eliminate')
                    const eliminateCount = eliminateList.reduce((s, f) => s + f.count, 0)
                    const totalFamilyUsages = dsCount + genericCount + eliminateCount
                    const suissePct = totalFamilyUsages > 0 ? Math.round((dsCount / totalFamilyUsages) * 100) : 0

                    const pieData = [
                      { name: 'Suisse (DS)', value: dsCount, color: '#006c48' },
                      { name: 'Genericas', value: genericCount, color: '#a67c00' },
                      { name: 'A eliminar', value: eliminateCount, color: '#9e2b25' },
                    ].filter(d => d.value > 0)

                    const w3cVal = latestDetail?.w3c_validation

                    return (
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                          {/* Typography Card */}
                          <Card className="p-6">
                            <div className="flex items-center gap-2 mb-4">
                              <Type size={20} className="text-[#006c48]" />
                              <h3 className="text-lg font-semibold text-[#1a2e23]">Tipografia</h3>
                              <InfoTooltip text="Resumen tipografico del CSS: familias usadas clasificadas en Design System (Suisse), genericas y a eliminar. Tambien muestra pesos y tamanos de fuente." />
                            </div>

                            {families.length > 0 ? (
                              <div className="space-y-4">
                                <div className="flex items-start gap-4">
                                  {pieData.length > 0 && (
                                    <div className="shrink-0">
                                      <ResponsiveContainer width={90} height={90}>
                                        <PieChart>
                                          <Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius={24} outerRadius={42} paddingAngle={2}>
                                            {pieData.map((d, i) => (
                                              <Cell key={i} fill={d.color} />
                                            ))}
                                          </Pie>
                                          <Tooltip formatter={(v: any, name: any) => [`${v} usos`, name]} />
                                        </PieChart>
                                      </ResponsiveContainer>
                                    </div>
                                  )}

                                  <div className="flex-1 space-y-2">
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs text-[#3d5a4a]">Cobertura Suisse</span>
                                      <Badge className={suissePct >= 70 ? 'bg-[#e0f5ec] text-[#006c48]' : suissePct >= 40 ? 'bg-[#fef6e0] text-[#a67c00]' : 'bg-[#fef2f1] text-[#9e2b25]'}>
                                        {suissePct}%
                                      </Badge>
                                    </div>
                                    <div className="h-1.5 bg-[#f0f2f1] rounded-full overflow-hidden">
                                      <div className="h-full rounded-full bg-[#006c48] transition-all" style={{ width: `${suissePct}%` }} />
                                    </div>

                                    <div className="grid grid-cols-3 gap-1.5 pt-1">
                                      <div className="text-center p-1.5 bg-[#f8f9fa] rounded">
                                        <p className="text-sm font-bold text-[#1a2e23]">{families.length}</p>
                                        <p className="text-[9px] text-[#3d5a4a]">Familias</p>
                                      </div>
                                      <div className="text-center p-1.5 bg-[#f8f9fa] rounded">
                                        <p className="text-sm font-bold text-[#1a2e23]">{weights.length}</p>
                                        <p className="text-[9px] text-[#3d5a4a]">Pesos</p>
                                      </div>
                                      <div className="text-center p-1.5 bg-[#f8f9fa] rounded">
                                        <p className="text-sm font-bold text-[#1a2e23]">{sizes.length}</p>
                                        <p className="text-[9px] text-[#3d5a4a]">Tamanos</p>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {eliminateList.length > 0 && (
                                  <div className="flex items-start gap-2 p-2 bg-[#fef2f1] rounded-lg">
                                    <XCircle size={14} className="text-[#9e2b25] shrink-0 mt-0.5" />
                                    <div className="min-w-0">
                                      <p className="text-xs font-semibold text-[#9e2b25]">{eliminateList.length} fuente{eliminateList.length !== 1 ? 's' : ''} a eliminar</p>
                                      <p className="text-[10px] text-[#9e2b25]/70 truncate">
                                        {eliminateList.slice(0, 3).map(f => f.value.replace(/['"]/g, '')).join(', ')}
                                        {eliminateList.length > 3 ? ` +${eliminateList.length - 3}` : ''}
                                      </p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <p className="text-sm text-[#3d5a4a]">Sin datos tipograficos en este escaneo.</p>
                            )}
                          </Card>

                          {/* CSS Validation Card */}
                          <Card className="p-6">
                            <div className="flex items-center gap-2 mb-4">
                              <ShieldCheck size={20} className="text-[#006c48]" />
                              <h3 className="text-lg font-semibold text-[#1a2e23]">Validacion CSS</h3>
                              <InfoTooltip text="Errores y warnings detectados por el validador. Errores = sintaxis invalida o propiedades desconocidas; warnings = !important, vendor prefixes, reglas vacias." />
                            </div>

                            {w3cVal ? (
                              <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                  {w3cVal.valid ? (
                                    <Badge className="gap-1.5 bg-[#e0f5ec] text-[#006c48]">
                                      <CheckCircle size={12} />
                                      CSS Valido
                                    </Badge>
                                  ) : (
                                    <Badge className="gap-1.5 bg-[#fef2f1] text-[#9e2b25]">
                                      <XCircle size={12} />
                                      Con errores
                                    </Badge>
                                  )}
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                  <div className="text-center p-3 rounded-xl bg-[#fef2f1]/50">
                                    <p className="text-2xl font-bold text-[#9e2b25]">{w3cVal.errorCount}</p>
                                    <p className="text-[10px] text-[#3d5a4a]">Errores</p>
                                  </div>
                                  <div className="text-center p-3 rounded-xl bg-[#fef6e0]/50">
                                    <p className="text-2xl font-bold text-[#a67c00]">{w3cVal.warningCount}</p>
                                    <p className="text-[10px] text-[#3d5a4a]">Warnings</p>
                                  </div>
                                </div>

                                {w3cVal.errors && w3cVal.errors.length > 0 && (
                                  <div className="space-y-1 max-h-24 overflow-y-auto">
                                    {w3cVal.errors.slice(0, 3).map((err: string, i: number) => (
                                      <p key={i} className="text-[10px] text-[#9e2b25] bg-[#fef2f1] rounded px-2 py-1 truncate">
                                        {err}
                                      </p>
                                    ))}
                                    {w3cVal.errors.length > 3 && (
                                      <p className="text-[10px] text-[#3d5a4a]">+{w3cVal.errors.length - 3} mas...</p>
                                    )}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="text-center py-6">
                                <ShieldCheck size={28} className="mx-auto mb-2 text-[#3d5a4a]/20" />
                                <p className="text-xs text-[#3d5a4a]">Sin datos. Ejecuta la validacion desde "Analizar".</p>
                              </div>
                            )}
                          </Card>

                          {/* Design System Coverage */}
                          <Card className="p-6">
                            <div className="flex items-center gap-2 mb-4">
                              <Palette size={20} className="text-[#006c48]" />
                              <h3 className="text-lg font-semibold text-[#1a2e23]">Cobertura DS</h3>
                              <InfoTooltip text="Porcentaje de valores en tu CSS (colores, tipografia, spacing, z-index) que coinciden con los tokens de tu Design System. 100% = todo alineado." />
                            </div>
                            {latestDetail?.ds_coverage ? (
                              <div className="space-y-3">
                                <div className="flex items-center gap-4">
                                  <ScoreRing score={Math.round(latestDetail.ds_coverage.overallCoverage)} size={80} />
                                  <div className="flex-1 space-y-2">
                                    <CoverageBar label="Colores" value={latestDetail.ds_coverage.colors} color="#006c48" />
                                    <CoverageBar label="Tipografia" value={latestDetail.ds_coverage.fontSizes} color="#2a9d6e" />
                                    <CoverageBar label="Spacing" value={latestDetail.ds_coverage.spacing} color="#5cc49a" />
                                    <CoverageBar label="Z-index" value={latestDetail.ds_coverage.zIndex} color="#a67c00" />
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="text-center py-6">
                                <Palette size={28} className="mx-auto mb-2 text-[#3d5a4a]/20" />
                                <p className="text-xs text-[#3d5a4a]">Sin datos. Carga tus tokens DS desde "Analizar".</p>
                              </div>
                            )}
                          </Card>
                        </div>
                      </div>
                    )
                  })()}
                  {/* ── Hardcoded Detail Cards ── */}
                  {(() => {
                    const ad = latestDetail?.analysis_data as AnalysisResult | undefined
                    if (!ad) return null

                    const topColors = [...(ad.colors || [])].sort((a, b) => b.count - a.count).slice(0, 15)
                    const spacingPx = (ad.spacingValues || []).filter(sv => /px$/i.test(sv.normalized) || sv.normalized === '0' || /^\d+$/.test(sv.normalized))
                    const spacingPct = (ad.spacingValues || []).filter(sv => /%|vw|vh/i.test(sv.normalized))
                    const spacingOther = (ad.spacingValues || []).filter(sv => /rem|em/i.test(sv.normalized))
                    const spacingTotal = (ad.spacingValues || []).reduce((s, v) => s + v.count, 0)
                    const offGrid = spacingPx.filter(sv => { const n = parseFloat(sv.normalized); return !isNaN(n) && n !== 0 && n % 8 !== 0 })
                    const offGridCount = offGrid.reduce((s, v) => s + v.count, 0)

                    const zTotal = (ad.zIndexValues || []).reduce((s, v) => s + v.count, 0)
                    const zUnique = (ad.zIndexValues || []).length
                    const zLayers = new Set((ad.zIndexValues || []).map(z => { const n = parseInt(z.value, 10); return isNaN(n) ? -1 : Math.min(Math.floor(Math.abs(n) / 1000), 9) })).size
                    const zNegative = (ad.zIndexValues || []).filter(z => parseInt(z.value, 10) < 0)
                    const zOver9999 = (ad.zIndexValues || []).filter(z => parseInt(z.value, 10) > 9999)
                    const zOutOfScale = (ad.zIndexValues || []).filter(z => { const n = parseInt(z.value, 10); return !isNaN(n) && (n % 1000 !== 0 && n !== 0 && n !== 1 && n !== -1) })

                    return (
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Colores Hardcodeados */}
                        <Card className="p-6">
                          <div className="flex items-center gap-2 mb-4">
                            <Palette size={20} className="text-[#006c48]" />
                            <h3 className="text-lg font-semibold text-[#1a2e23]">Colores Hardcodeados</h3>
                            <InfoTooltip text="Colores escritos directamente en el CSS en vez de usar variables del Design System." />
                          </div>
                          <p className="text-4xl font-bold text-[#1a2e23] mb-1">{ad.colors?.length || 0}</p>
                          <p className="text-xs text-[#3d5a4a] mb-4">colores escritos directamente en el CSS</p>
                          {topColors.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mb-2">
                              {topColors.map((c, i) => (
                                <div
                                  key={i}
                                  className="w-6 h-6 rounded border border-[#f0f2f1]"
                                  style={{ backgroundColor: c.normalized }}
                                  title={`${c.normalized} (${c.count}x)`}
                                />
                              ))}
                              {(ad.colors?.length || 0) > 15 && (
                                <span className="text-[10px] text-[#3d5a4a] self-center ml-1">+{(ad.colors?.length || 0) - 15}</span>
                              )}
                            </div>
                          )}
                        </Card>

                        {/* Spacing */}
                        <Card className="p-6">
                          <div className="flex items-center gap-2 mb-4">
                            <Grid3X3 size={20} className="text-[#006c48]" />
                            <h3 className="text-lg font-semibold text-[#1a2e23]">Spacing</h3>
                            <InfoTooltip text="Valores de spacing (margin, padding, gap, etc.) hardcodeados. Idealmente deberían seguir una escala de 8px." />
                          </div>
                          <p className="text-4xl font-bold text-[#1a2e23] mb-1">{spacingTotal}</p>
                          <p className="text-xs text-[#3d5a4a] mb-4">valores de spacing hardcodeados</p>
                          <div className="grid grid-cols-3 gap-2 mb-3">
                            <div className="text-center p-2 bg-[#f8f9fa] rounded-lg">
                              <p className="text-lg font-bold text-[#1a2e23]">{spacingPx.reduce((s, v) => s + v.count, 0)}</p>
                              <p className="text-[9px] text-[#3d5a4a]">px</p>
                            </div>
                            <div className="text-center p-2 bg-[#f8f9fa] rounded-lg">
                              <p className="text-lg font-bold text-[#a67c00]">{spacingPct.reduce((s, v) => s + v.count, 0)}</p>
                              <p className="text-[9px] text-[#3d5a4a]">% / vw / vh</p>
                            </div>
                            <div className="text-center p-2 bg-[#f8f9fa] rounded-lg">
                              <p className="text-lg font-bold text-[#1a2e23]">{spacingOther.reduce((s, v) => s + v.count, 0)}</p>
                              <p className="text-[9px] text-[#3d5a4a]">rem / em / otro</p>
                            </div>
                          </div>
                          {offGridCount > 0 && (
                            <div className="flex items-start gap-2 p-2 rounded-lg" style={{ background: '#fef6e0' }}>
                              <AlertTriangle size={14} className="text-[#a67c00] shrink-0 mt-0.5" />
                              <div>
                                <p className="text-xs font-semibold text-[#a67c00]">{offGridCount} px fuera de la grid 8</p>
                                <p className="text-[10px] text-[#a67c00]/70 truncate">
                                  {offGrid.slice(0, 5).map(v => v.normalized).join(', ')}
                                  {offGrid.length > 5 ? ` +${offGrid.length - 5}` : ''}
                                </p>
                              </div>
                            </div>
                          )}
                        </Card>

                        {/* Z-index */}
                        <Card className="p-6">
                          <div className="flex items-center gap-2 mb-4">
                            <Layers size={20} className="text-[#006c48]" />
                            <h3 className="text-lg font-semibold text-[#1a2e23]">Z-index</h3>
                            <InfoTooltip text="Valores z-index en el CSS. Se recomienda una escala ×1000 con máximo 10 capas." />
                          </div>
                          <div className="flex items-baseline gap-2 mb-1">
                            <p className="text-4xl font-bold text-[#1a2e23]">{zTotal}</p>
                            <p className="text-xs text-[#3d5a4a]">valores en {zLayers} de 10 capas</p>
                          </div>
                          <div className="grid grid-cols-2 gap-2 mb-3 mt-3">
                            <div className="text-center p-2 bg-[#f8f9fa] rounded-lg">
                              <p className="text-lg font-bold text-[#1a2e23]">{zLayers}</p>
                              <p className="text-[9px] text-[#3d5a4a]">capas usadas</p>
                            </div>
                            <div className="text-center p-2 bg-[#f8f9fa] rounded-lg">
                              <p className="text-lg font-bold text-[#1a2e23]">{Math.max(0, 10 - zLayers)}</p>
                              <p className="text-[9px] text-[#3d5a4a]">capas libres</p>
                            </div>
                          </div>
                          {zOutOfScale.length > 0 && (
                            <div className="flex items-start gap-2 p-2 rounded-lg mb-1.5" style={{ background: '#fef6e0' }}>
                              <AlertTriangle size={14} className="text-[#a67c00] shrink-0 mt-0.5" />
                              <div>
                                <p className="text-xs font-semibold text-[#a67c00]">{zOutOfScale.length} fuera de la escala ×1000</p>
                                <p className="text-[10px] text-[#a67c00]/70 truncate">
                                  {zOutOfScale.slice(0, 5).map(v => v.value).join(', ')}
                                  {zOutOfScale.length > 5 ? ` +${zOutOfScale.length - 5}` : ''}
                                </p>
                              </div>
                            </div>
                          )}
                          {zOver9999.length > 0 && (
                            <div className="flex items-center gap-2 p-2 rounded-lg mb-1.5" style={{ background: '#fef6e0' }}>
                              <AlertTriangle size={14} className="text-[#a67c00]" />
                              <p className="text-xs font-semibold text-[#a67c00]">{zOver9999.length} valores por encima de 9999</p>
                            </div>
                          )}
                          {zNegative.length > 0 && (
                            <div className="flex items-center gap-2 p-2 rounded-lg" style={{ background: '#fef6e0' }}>
                              <AlertTriangle size={14} className="text-[#a67c00]" />
                              <p className="text-xs font-semibold text-[#a67c00]">{zNegative.length} valores negativos</p>
                            </div>
                          )}
                        </Card>
                      </div>
                    )
                  })()}

                  {/* ── Font Weights ── */}
                  {(() => {
                    const ad = latestDetail?.analysis_data as AnalysisResult | undefined
                    const weights = ad?.fontWeights || []
                    if (weights.length === 0) return null

                    const APPROVED_WEIGHTS = [100, 400, 600, 700]
                    const WEIGHT_NAMES: Record<number, string> = { 100: 'Thin', 200: 'Extra Light', 300: 'Light', 400: 'Normal', 500: 'Medium', 600: 'Semi Bold', 700: 'Bold', 800: 'Extra Bold', 900: 'Black' }
                    const sortedWeights = [...weights].sort((a, b) => (parseInt(a.normalized) || 0) - (parseInt(b.normalized) || 0))
                    const approvedWeights = sortedWeights.filter(w => APPROVED_WEIGHTS.includes(parseInt(w.normalized) || 0))
                    const unapproved = sortedWeights.filter(w => !APPROVED_WEIGHTS.includes(parseInt(w.normalized) || 0))
                    const CONSOLIDATION: Record<number, number> = { 200: 100, 300: 100, 500: 400, 800: 700, 900: 700 }

                    return (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Weight list */}
                        <Card className="p-6">
                          <div className="flex items-center gap-2 mb-4">
                            <Type size={20} className="text-[#006c48]" />
                            <h3 className="text-lg font-semibold text-[#1a2e23]">Font-Weights y Equivalencias</h3>
                            <InfoTooltip text="Distribución de font-weight. Los pesos aprobados del DS son 100, 400, 600 y 700." />
                          </div>
                          <div className="space-y-2">
                            {sortedWeights.map((w, i) => {
                              const n = parseInt(w.normalized) || 0
                              const isApproved = APPROVED_WEIGHTS.includes(n)
                              return (
                                <div key={i} className="flex items-center gap-3 p-3 rounded-xl border" style={{ borderColor: isApproved ? 'rgba(0, 108, 72, 0.15)' : 'rgba(158, 43, 37, 0.15)' }}>
                                  <span className="text-[11px] font-bold px-2 py-1 rounded" style={{
                                    background: isApproved ? '#e0f5ec' : '#fef2f1',
                                    color: isApproved ? '#006c48' : '#9e2b25',
                                  }}>{w.normalized}</span>
                                  <span className="flex-1 text-sm font-medium text-[#1a2e23]" style={{ fontWeight: n }}>
                                    {WEIGHT_NAMES[n] || w.normalized}
                                  </span>
                                  <span className="text-[10px] text-[#3d5a4a]">{w.normalized} {w.count}x</span>
                                  <span className="text-lg font-bold text-[#1a2e23]">{w.count}</span>
                                  <span className="text-[10px] text-[#3d5a4a]">usos</span>
                                </div>
                              )
                            })}
                          </div>
                        </Card>

                        {/* Consolidation actions */}
                        <Card className="p-6">
                          <div className="flex items-center gap-2 mb-4">
                            <Type size={20} className="text-[#006c48]" />
                            <h3 className="text-lg font-semibold text-[#1a2e23]">Acciones de Font-Weight</h3>
                            <InfoTooltip text="Pesos no aprobados que deben consolidarse en pesos del DS. Cada acción indica a qué peso migrar." />
                          </div>
                          {unapproved.length > 0 ? (
                            <>
                              <p className="text-sm text-[#a67c00] mb-4">{unapproved.length} acciones pendientes</p>
                              <div className="space-y-3">
                                {unapproved.map((w, i) => {
                                  const n = parseInt(w.normalized) || 0
                                  const target = CONSOLIDATION[n] || 400
                                  return (
                                    <div key={i} className="p-4 rounded-xl border" style={{ borderColor: 'rgba(166, 124, 0, 0.15)' }}>
                                      <div className="flex items-center gap-2 mb-2">
                                        <span className="text-[11px] font-bold px-2 py-1 rounded line-through" style={{ background: '#fef2f1', color: '#9e2b25' }}>{w.normalized}</span>
                                        <span className="text-sm font-semibold text-[#1a2e23]">{WEIGHT_NAMES[n] || w.normalized}</span>
                                        <span className="text-xs text-[#3d5a4a]">({w.count} usos)</span>
                                      </div>
                                      <div className="flex items-center gap-2 text-xs">
                                        <span className="text-[#006c48] font-medium">Consolidar</span>
                                        <span className="text-[#3d5a4a]">→</span>
                                        <span className="text-[11px] font-bold px-2 py-1 rounded" style={{ background: '#e0f5ec', color: '#006c48' }}>{target}</span>
                                        <span className="text-sm text-[#1a2e23]">{WEIGHT_NAMES[target]}</span>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                              {approvedWeights.length > 0 && (
                                <div className="mt-5 pt-4 border-t border-[#f0f2f1]">
                                  <p className="text-[10px] uppercase tracking-wider font-semibold text-[#3d5a4a] mb-2">Pesos correctos</p>
                                  <div className="flex flex-wrap gap-2">
                                    {approvedWeights.map((w, i) => (
                                      <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs" style={{ background: '#e0f5ec', color: '#006c48' }}>
                                        <span className="font-bold">{w.normalized}</span>
                                        <span>{WEIGHT_NAMES[parseInt(w.normalized) || 0]}</span>
                                        <span className="text-[10px] opacity-70">{w.count}x</span>
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="text-center py-8">
                              <CheckCircle size={32} className="mx-auto mb-2 text-[#006c48]" />
                              <p className="text-sm font-medium text-[#006c48]">Todos los pesos son correctos</p>
                            </div>
                          )}
                        </Card>
                      </div>
                    )
                  })()}

                  {/* ── Cumplimiento HG5 (Evolution) ── */}
                  {hg5Result && hg5EvolutionData && scans.length > 0 && (
                    <>
                      <SectionHeader title="Cumplimiento HG5" tooltip="Evolución de la adherencia de tu CSS al framework HG5 a lo largo de los escaneos. Las líneas punteadas representan los valores de referencia de HG5." />

                      {/* Compliance score over time */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card className="p-6">
                          <ChartTitle
                            title="Indice de Cumplimiento"
                            tooltip="Porcentaje de métricas que cumplen o mejoran respecto a HG5. 100% = adherencia total."
                            first={hg5EvolutionData[0]?.cumplimiento}
                            last={hg5EvolutionData[hg5EvolutionData.length - 1]?.cumplimiento}
                            downIsGood={false}
                          />
                          <ResponsiveContainer width="100%" height={250}>
                            <AreaChart data={hg5EvolutionData}>
                              <defs>
                                <linearGradient id="compFill" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#006c48" stopOpacity={0.2} />
                                  <stop offset="95%" stopColor="#006c48" stopOpacity={0} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f1" />
                              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                              <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} formatter={(v: any) => [`${v}%`, 'Cumplimiento']} />
                              <ReferenceLine y={100} stroke="#006c48" strokeDasharray="6 3" strokeOpacity={0.3} label={{ value: 'HG5 100%', position: 'right', fontSize: 10, fill: '#006c48' }} />
                              <Area type="monotone" dataKey="cumplimiento" stroke="#006c48" strokeWidth={2.5} fill="url(#compFill)" dot={{ r: 4, fill: '#006c48' }} />
                            </AreaChart>
                          </ResponsiveContainer>
                        </Card>

                        {/* Health Score: User vs HG5 */}
                        <Card className="p-6">
                          <ChartTitle
                            title="Health Score vs HG5"
                            tooltip="Tu Health Score comparado con el de HG5 en cada escaneo. El objetivo es igualarlo o superarlo."
                            first={hg5EvolutionData[0]?.scoreUser}
                            last={hg5EvolutionData[hg5EvolutionData.length - 1]?.scoreUser}
                            downIsGood={false}
                          />
                          <ResponsiveContainer width="100%" height={250}>
                            <LineChart data={hg5EvolutionData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f1" />
                              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} domain={[0, 100]} />
                              <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
                              <Legend />
                              <ReferenceLine y={hg5Result.healthScore} stroke="#006c48" strokeDasharray="6 3" strokeOpacity={0.4} label={{ value: `HG5: ${hg5Result.healthScore}`, position: 'right', fontSize: 10, fill: '#006c48' }} />
                              <Line type="monotone" dataKey="scoreUser" stroke="#1a2e23" strokeWidth={2.5} dot={{ r: 4, fill: '#1a2e23' }} name="Tu Score" />
                            </LineChart>
                          </ResponsiveContainer>
                        </Card>
                      </div>

                      {/* Key metrics vs HG5 reference */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Colores hardcodeados vs HG5 */}
                        <Card className="p-6">
                          <ChartTitle
                            title="Colores vs HG5"
                            tooltip="Tus colores hardcodeados comparados con los de HG5. Idealmente debería acercarse o bajar de la referencia."
                            first={hg5EvolutionData[0]?.coloresUser}
                            last={hg5EvolutionData[hg5EvolutionData.length - 1]?.coloresUser}
                          />
                          <ResponsiveContainer width="100%" height={220}>
                            <LineChart data={hg5EvolutionData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f1" />
                              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                              <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
                              <ReferenceLine y={hg5Result.colors.length} stroke="#006c48" strokeDasharray="6 3" strokeOpacity={0.4} label={{ value: `HG5: ${hg5Result.colors.length}`, position: 'right', fontSize: 10, fill: '#006c48' }} />
                              <Line type="monotone" dataKey="coloresUser" stroke="#9e2b25" strokeWidth={2} dot={{ r: 3, fill: '#9e2b25' }} name="Tus colores" />
                            </LineChart>
                          </ResponsiveContainer>
                        </Card>

                        {/* !important vs HG5 */}
                        <Card className="p-6">
                          <ChartTitle
                            title="!important vs HG5"
                            tooltip="Usos de !important en tu CSS comparados con HG5. Menos = mejor."
                            first={hg5EvolutionData[0]?.importantUser}
                            last={hg5EvolutionData[hg5EvolutionData.length - 1]?.importantUser}
                          />
                          <ResponsiveContainer width="100%" height={220}>
                            <LineChart data={hg5EvolutionData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f1" />
                              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                              <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
                              <ReferenceLine y={hg5Result.importantCount} stroke="#006c48" strokeDasharray="6 3" strokeOpacity={0.4} label={{ value: `HG5: ${hg5Result.importantCount}`, position: 'right', fontSize: 10, fill: '#006c48' }} />
                              <Line type="monotone" dataKey="importantUser" stroke="#9e2b25" strokeWidth={2} dot={{ r: 3, fill: '#9e2b25' }} name="Tu !important" />
                            </LineChart>
                          </ResponsiveContainer>
                        </Card>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Fuentes a eliminar (objetivo: 0) */}
                        <Card className="p-6">
                          <ChartTitle
                            title="Fuentes no autorizadas"
                            tooltip="Fuentes que no son Suisse ni genéricas. El objetivo es llegar a 0."
                            first={hg5EvolutionData[0]?.badFonts}
                            last={hg5EvolutionData[hg5EvolutionData.length - 1]?.badFonts}
                          />
                          <ResponsiveContainer width="100%" height={220}>
                            <LineChart data={hg5EvolutionData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f1" />
                              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                              <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
                              <ReferenceLine y={0} stroke="#006c48" strokeDasharray="6 3" strokeOpacity={0.4} label={{ value: 'Objetivo: 0', position: 'right', fontSize: 10, fill: '#006c48' }} />
                              <Line type="monotone" dataKey="badFonts" stroke="#a67c00" strokeWidth={2} dot={{ r: 3, fill: '#a67c00' }} name="Fuentes" />
                            </LineChart>
                          </ResponsiveContainer>
                        </Card>

                        {/* Ratio reutilización vs HG5 */}
                        <Card className="p-6">
                          <ChartTitle
                            title="Reutilización vs HG5"
                            tooltip="Tu ratio de reutilización comparado con HG5. Mayor = mejor."
                            first={hg5EvolutionData[0]?.reuseUser}
                            last={hg5EvolutionData[hg5EvolutionData.length - 1]?.reuseUser}
                            downIsGood={false}
                          />
                          <ResponsiveContainer width="100%" height={220}>
                            <LineChart data={hg5EvolutionData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f1" />
                              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                              <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} formatter={(v: any) => [`${v}%`, 'Ratio']} />
                              <ReferenceLine y={+(hg5Result.reuseRatio * 100).toFixed(1)} stroke="#006c48" strokeDasharray="6 3" strokeOpacity={0.4} label={{ value: `HG5: ${(hg5Result.reuseRatio * 100).toFixed(0)}%`, position: 'right', fontSize: 10, fill: '#006c48' }} />
                              <Line type="monotone" dataKey="reuseUser" stroke="#006c48" strokeWidth={2} dot={{ r: 3, fill: '#006c48' }} name="Tu ratio" />
                            </LineChart>
                          </ResponsiveContainer>
                        </Card>
                      </div>
                    </>
                  )}

                  {/* ── Reduccion de Legacy ── */}
                  {scans.length > 1 && (
                    <>
                      <SectionHeader title="Reduccion de Legacy" tooltip="Seguimiento de valores legacy (hardcodeados, fuentes no autorizadas) a lo largo de los escaneos. El objetivo es llevarlos a cero." />
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card className="p-6">
                          <ChartTitle
                            title="Colores Hardcodeados"
                            tooltip="Cantidad de colores escritos directamente en el CSS a lo largo de los escaneos."
                            first={hardcodedColorsChartData[0]?.colores}
                            last={hardcodedColorsChartData[hardcodedColorsChartData.length - 1]?.colores}
                          />
                          <ResponsiveContainer width="100%" height={220}>
                            <LineChart data={hardcodedColorsChartData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f1" />
                              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                              <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
                              <Line type="monotone" dataKey="colores" stroke="#9e2b25" strokeWidth={2} dot={{ r: 3, fill: '#9e2b25' }} name="Colores" fill="#9e2b25" />
                              <defs>
                                <linearGradient id="colorsFill" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#9e2b25" stopOpacity={0.15} />
                                  <stop offset="95%" stopColor="#9e2b25" stopOpacity={0} />
                                </linearGradient>
                              </defs>
                            </LineChart>
                          </ResponsiveContainer>
                        </Card>

                        <Card className="p-6">
                          <ChartTitle
                            title="Fuentes a Eliminar"
                            tooltip="Usos de fuentes no autorizadas (no Suisse ni genéricas) a lo largo de los escaneos."
                            first={fontsToEliminateChartData[0]?.fuentes}
                            last={fontsToEliminateChartData[fontsToEliminateChartData.length - 1]?.fuentes}
                          />
                          <ResponsiveContainer width="100%" height={220}>
                            <LineChart data={fontsToEliminateChartData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f1" />
                              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                              <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
                              <Line type="monotone" dataKey="fuentes" stroke="#a67c00" strokeWidth={2} dot={{ r: 3, fill: '#a67c00' }} name="Fuentes" />
                            </LineChart>
                          </ResponsiveContainer>
                        </Card>
                      </div>
                    </>
                  )}

                  {/* ── Evolucion ── */}
                  {scans.length > 1 && (
                    <>
                      <SectionHeader title="Evolucion" tooltip="Evolución de las métricas principales del CSS a lo largo de los escaneos." />

                      {/* Peso y Lineas */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card className="p-6">
                          <ChartTitle
                            title="Peso y Lineas"
                            tooltip="Histórico del tamaño del archivo CSS (en KB) y número de líneas de código."
                            first={weightChartData[0]?.peso}
                            last={weightChartData[weightChartData.length - 1]?.peso}
                          />
                          <ResponsiveContainer width="100%" height={250}>
                            <LineChart data={weightChartData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f1" />
                              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                              <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                              <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
                              <Legend />
                              <Line yAxisId="right" type="monotone" dataKey="lineas" stroke="#006c48" strokeWidth={2} dot={{ r: 3 }} name="Lineas" />
                              <Line yAxisId="left" type="monotone" dataKey="peso" stroke="#1a2e23" strokeWidth={2} dot={{ r: 3 }} name="Peso (KB)" />
                            </LineChart>
                          </ResponsiveContainer>
                        </Card>

                        {/* Selectores y Declaraciones */}
                        <Card className="p-6">
                          <ChartTitle
                            title="Selectores y Declaraciones"
                            tooltip="Evolución del número total de selectores, declaraciones y declaraciones únicas."
                            first={selectorsChartData[0]?.declaraciones}
                            last={selectorsChartData[selectorsChartData.length - 1]?.declaraciones}
                          />
                          <ResponsiveContainer width="100%" height={250}>
                            <LineChart data={selectorsChartData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f1" />
                              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                              <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
                              <Legend />
                              <Line type="monotone" dataKey="declaraciones" stroke="#006c48" strokeWidth={2} dot={{ r: 3 }} name="Declaraciones" />
                              <Line type="monotone" dataKey="selectores" stroke="#1a2e23" strokeWidth={2} dot={{ r: 3 }} name="Selectores" />
                              <Line type="monotone" dataKey="unicas" stroke="#5cc49a" strokeWidth={2} dot={{ r: 3 }} name="Unicas" />
                            </LineChart>
                          </ResponsiveContainer>
                        </Card>
                      </div>

                      {/* !important e IDs + Ratio de Reutilización */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card className="p-6">
                          <ChartTitle
                            title="!important e IDs"
                            tooltip="Evolución del uso de !important y selectores de ID. Ambos deberían reducirse."
                            first={importantChartData[0]?.important}
                            last={importantChartData[importantChartData.length - 1]?.important}
                          />
                          <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={importantChartData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f1" />
                              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                              <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
                              <Legend />
                              <Bar dataKey="important" fill="#9e2b25" radius={[4, 4, 0, 0]} name="!important" />
                              <Bar dataKey="ids" fill="#a67c00" radius={[4, 4, 0, 0]} name="IDs" />
                            </BarChart>
                          </ResponsiveContainer>
                        </Card>

                        <Card className="p-6">
                          <ChartTitle
                            title="Ratio de Reutilizacion"
                            tooltip="Porcentaje de declaraciones CSS reutilizadas. Un ratio más alto indica CSS más eficiente."
                            first={reuseChartData[0]?.ratio}
                            last={reuseChartData[reuseChartData.length - 1]?.ratio}
                            downIsGood={false}
                          />
                          <ResponsiveContainer width="100%" height={250}>
                            <LineChart data={reuseChartData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f1" />
                              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                              <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} formatter={(v: any) => [`${v}%`, 'Reutilización']} />
                              <Line type="monotone" dataKey="ratio" stroke="#006c48" strokeWidth={2} dot={{ r: 3, fill: '#006c48' }} name="Reutilización" />
                            </LineChart>
                          </ResponsiveContainer>
                        </Card>
                      </div>
                    </>
                  )}

                  {/* Scan history table */}
                  {scans.length > 0 && (
                    <Card className="p-6">
                      <SectionHeader title="Historial de escaneos" tooltip="Todos los escaneos realizados para este proyecto, del más reciente al más antiguo. Haz clic en el ojo para ver el detalle." />
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b" style={{ borderColor: 'rgba(11, 31, 22, 0.08)' }}>
                              <th className="text-left py-2 pr-3 text-[11px] font-medium text-[#52695b] uppercase tracking-wider">Etiqueta</th>
                              <th className="text-left py-2 pr-3 text-[11px] font-medium text-[#52695b] uppercase tracking-wider">Fecha</th>
                              <th className="text-right py-2 pr-3 text-[11px] font-medium text-[#52695b] uppercase tracking-wider">Score</th>
                              <th className="text-right py-2 pr-3 text-[11px] font-medium text-[#52695b] uppercase tracking-wider">Peso</th>
                              <th className="text-right py-2 pr-3 text-[11px] font-medium text-[#52695b] uppercase tracking-wider">Lineas</th>
                              <th className="text-right py-2 pr-3 text-[11px] font-medium text-[#52695b] uppercase tracking-wider">Clases</th>
                              <th className="text-right py-2 pr-3 text-[11px] font-medium text-[#52695b] uppercase tracking-wider">IDs</th>
                              <th className="text-right py-2 pr-3 text-[11px] font-medium text-[#52695b] uppercase tracking-wider">!imp</th>
                              <th className="text-right py-2 pr-3 text-[11px] font-medium text-[#52695b] uppercase tracking-wider">Vars</th>
                              <th className="text-right py-2 pr-3 text-[11px] font-medium text-[#52695b] uppercase tracking-wider">Select.</th>
                              <th className="text-right py-2 pr-3 text-[11px] font-medium text-[#52695b] uppercase tracking-wider">Decl.</th>
                              <th className="text-right py-2 pr-3 text-[11px] font-medium text-[#52695b] uppercase tracking-wider">Unicas</th>
                              <th className="text-right py-2 pr-3 text-[11px] font-medium text-[#52695b] uppercase tracking-wider">Reuso</th>
                              <th className="text-center py-2 text-[11px] font-medium text-[#52695b] uppercase tracking-wider">Acciones</th>
                            </tr>
                          </thead>
                          <tbody>
                            {scans.map((scan, i) => {
                              const scoreColor = scan.health_score >= 70 ? '#006c48' : scan.health_score >= 40 ? '#a67c00' : '#9e2b25'
                              return (
                                <tr key={scan.id} className="border-b last:border-0" style={{ borderColor: 'rgba(11, 31, 22, 0.05)' }}>
                                  <td className="py-2.5 pr-3">
                                    <span className="text-[13px] font-medium text-[#1a2e23]">{scan.label}</span>
                                  </td>
                                  <td className="py-2.5 pr-3 text-[12px] text-[#52695b] whitespace-nowrap">
                                    {new Date(scan.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: '2-digit' })}
                                  </td>
                                  <td className="py-2.5 pr-3 text-right">
                                    <span className="text-[13px] font-bold" style={{ color: scoreColor }}>{scan.health_score}</span>
                                  </td>
                                  <td className="py-2.5 pr-3 text-right text-[12px] text-[#1a2e23]">{(scan.file_size / 1024).toFixed(1)} KB</td>
                                  <td className="py-2.5 pr-3 text-right text-[12px] text-[#1a2e23]">{scan.line_count.toLocaleString()}</td>
                                  <td className="py-2.5 pr-3 text-right text-[12px] text-[#1a2e23]">{scan.class_count.toLocaleString()}</td>
                                  <td className="py-2.5 pr-3 text-right text-[12px] text-[#1a2e23]">{scan.id_count.toLocaleString()}</td>
                                  <td className="py-2.5 pr-3 text-right text-[12px] text-[#1a2e23]">{scan.important_count.toLocaleString()}</td>
                                  <td className="py-2.5 pr-3 text-right text-[12px] text-[#1a2e23]">{scan.variable_count.toLocaleString()}</td>
                                  <td className="py-2.5 pr-3 text-right text-[12px] text-[#1a2e23]">{scan.total_selectors.toLocaleString()}</td>
                                  <td className="py-2.5 pr-3 text-right text-[12px] text-[#1a2e23]">{scan.total_declarations.toLocaleString()}</td>
                                  <td className="py-2.5 pr-3 text-right text-[12px] text-[#1a2e23]">{scan.unique_declarations.toLocaleString()}</td>
                                  <td className="py-2.5 pr-3 text-right text-[12px] text-[#1a2e23]">{(scan.reuse_ratio * 100).toFixed(0)}%</td>
                                  <td className="py-2.5 text-center">
                                    <div className="flex items-center justify-center gap-1">
                                      <button
                                        onClick={() => setSelectedScanId(scan.id)}
                                        className="p-1.5 rounded-lg hover:bg-[#e5f2ec] transition-colors"
                                        title="Ver detalle"
                                      >
                                        <Eye size={15} className="text-[#006c48]" />
                                      </button>
                                      <button
                                        onClick={async () => {
                                          if (!confirm('¿Eliminar este escaneo?')) return
                                          try {
                                            await deleteScan(scan.id)
                                            if (selectedProjectId) await loadScans(selectedProjectId)
                                          } catch (err) { console.error('Error deleting scan:', err) }
                                        }}
                                        className="p-1.5 rounded-lg hover:bg-[#fbe8e6] transition-colors"
                                        title="Eliminar"
                                      >
                                        <Trash2 size={15} className="text-[#9e2b25]" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </Card>
                  )}
                </div>
              )}

              {/* ─── CONFRONTAR HG5 TAB ─── */}
              {activeTab === 'confrontar' && (
                <ConfrontarTab
                  hg5Result={hg5Result}
                  userResult={latestDetail?.analysis_data as AnalysisResult | undefined}
                  hg5Loading={hg5Loading}
                  hg5Error={hg5Error}
                  onRetry={() => { hg5FetchedRef.current = false; loadHg5() }}
                />
              )}

              {/* ─── PLAN DE ACCIÓN TAB ─── */}
              {activeTab === 'plan' && (() => {
                const sevColor: Record<string, string> = { critical: '#9e2b25', high: '#a67c00', medium: '#52695b', low: '#006c48' }
                const sevBg: Record<string, string> = { critical: '#fbe8e6', high: '#fbf2d9', medium: '#f0f2f1', low: '#e5f2ec' }
                const sevLabel: Record<string, string> = { critical: 'Crítico', high: 'Alto', medium: 'Medio', low: 'Bajo' }

                // Determine which scan to show plan for
                const activePlanScanId = planScanId || (scans.length > 0 ? scans[0].id : null)
                const planDetail = activePlanScanId ? allScanDetails.get(activePlanScanId) : latestDetail
                const activePlanScan = scans.find(s => s.id === activePlanScanId)

                // Auto-generated items from selected scan — with real data
                type AutoDetail = { cells: (string | number)[]; swatch?: string }
                type AutoItem = { title: string; value: string; severity: string; description: string; detailHeaders?: string[]; detailRows?: AutoDetail[] }
                const autoItems: AutoItem[] = []
                if (planDetail?.analysis_data) {
                  const ad = planDetail.analysis_data as AnalysisResult

                  // !important
                  if (ad.importantCount > 0) {
                    const imps = ad.importants || []
                    autoItems.push({
                      severity: ad.importantCount > 50 ? 'critical' : ad.importantCount > 20 ? 'high' : 'medium',
                      title: 'Eliminar !important', value: `${ad.importantCount}`,
                      description: 'Reescribir selectores con mayor especificidad natural.',
                      detailHeaders: ['Propiedad', 'Selector', 'Línea'],
                      detailRows: imps.map(imp => ({ cells: [imp.property, imp.selector, imp.line] })),
                    })
                  }

                  // ID selectors
                  if (ad.idCount > 0) {
                    const idSels = ad.specificityDistribution.filter(s => s.specificity[0] > 0)
                    autoItems.push({
                      severity: ad.idCount > 20 ? 'high' : 'medium',
                      title: 'Reemplazar selectores de ID', value: `${ad.idCount}`,
                      description: 'Cambiar #id por .clase.',
                      detailHeaders: ['Selector', 'Especificidad', 'Línea'],
                      detailRows: idSels.map(s => ({ cells: [s.selector, `(${s.specificity.join(',')})`, s.line] })),
                    })
                  }

                  // Colors
                  if (ad.colors?.length > 0) {
                    const sorted = [...ad.colors].sort((a, b) => b.count - a.count)
                    autoItems.push({
                      severity: ad.colors.length > 50 ? 'critical' : 'high',
                      title: 'Migrar colores a variables DS', value: `${ad.colors.length}`,
                      description: 'Sustituir hardcodeados por tokens.',
                      detailHeaders: ['Color', 'Usos', 'Línea'],
                      detailRows: sorted.map(c => ({ cells: [c.normalized, c.count, c.locations[0]?.line ?? '–'], swatch: c.normalized })),
                    })
                  }

                  // Bad font families
                  const badFam = (ad.fontFamilies || []).filter(f => classifyFamily(f.normalized || f.value) === 'eliminate')
                  if (badFam.length > 0) {
                    autoItems.push({
                      severity: 'high',
                      title: 'Eliminar fuentes no autorizadas', value: `${badFam.length}`,
                      description: 'Reemplazar por Suisse.',
                      detailHeaders: ['Familia', 'Usos', 'Línea ejemplo'],
                      detailRows: [...badFam].sort((a, b) => b.count - a.count).map(f => ({ cells: [f.normalized.replace(/['"]/g, ''), f.count, f.locations[0]?.line ?? '–'] })),
                    })
                  }

                  // Duplicate selectors
                  if (ad.duplicateSelectors?.length > 0) {
                    autoItems.push({
                      severity: 'medium',
                      title: 'Unificar selectores duplicados', value: `${ad.duplicateSelectors.length}`,
                      description: 'Fusionar reglas duplicadas.',
                      detailHeaders: ['Selector', 'Repeticiones', 'Líneas'],
                      detailRows: [...ad.duplicateSelectors].sort((a, b) => b.occurrences.length - a.occurrences.length).map(d => ({
                        cells: [d.key, d.occurrences.length, d.occurrences.slice(0, 5).map(o => o.line).join(', ') + (d.occurrences.length > 5 ? '…' : '')]
                      })),
                    })
                  }

                  // Vendor prefixes
                  if (ad.vendorPrefixCount > 10) autoItems.push({ severity: 'low', title: 'Automatizar vendor prefixes', value: `${ad.vendorPrefixCount}`, description: 'Configurar Autoprefixer.' })
                }

                return (
                  <div className="space-y-6">
                    {/* Header + Scan selector + Add button */}
                    <div className="flex items-center justify-between gap-3">
                      <SectionHeader title="Plan de Acción" tooltip="Acciones para mejorar la calidad del CSS. Las automáticas se generan desde el escaneo seleccionado. Puedes añadir las tuyas." />
                      <div className="flex items-center gap-2 ml-auto">
                        {/* Scan selector */}
                        {scans.length > 1 && (
                          <select
                            value={activePlanScanId || ''}
                            onChange={(e) => {
                              setPlanScanId(e.target.value)
                              setExpandedAutoItems(new Set())
                            }}
                            className="h-8 px-2 pr-7 rounded-lg text-xs font-medium bg-white text-[#1a2e23] appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#006c48]"
                            style={{
                              border: '1px solid rgba(11, 31, 22, 0.14)',
                              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%2352695b' viewBox='0 0 24 24'%3E%3Cpath d='M7 10l5 5 5-5z'/%3E%3C/svg%3E")`,
                              backgroundRepeat: 'no-repeat',
                              backgroundPosition: 'right 6px center',
                            }}
                          >
                            {scans.map((s, idx) => (
                              <option key={s.id} value={s.id}>
                                {s.label || `Escaneo ${scans.length - idx}`}
                                {idx === 0 ? ' (último)' : ''}
                              </option>
                            ))}
                          </select>
                        )}
                        <Button
                          size="sm"
                          className="gap-1.5 h-8"
                          style={{ background: '#012d1d' }}
                          onClick={() => { resetForm(); setShowAddForm(true) }}
                        >
                          <Plus size={14} />
                          Añadir acción
                        </Button>
                      </div>
                    </div>

                    {/* Scan info bar */}
                    {activePlanScan && (
                      <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[#f8f9fa] text-[11px] text-[#52695b]">
                        <span className="font-semibold text-[#1a2e23]">{activePlanScan.label || 'Sin etiqueta'}</span>
                        <span>·</span>
                        <span>{new Date(activePlanScan.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        {planDetail?.analysis_data && (() => {
                          const ad = planDetail.analysis_data as AnalysisResult
                          return (
                            <>
                              <span>·</span>
                              <span>Score: <span className="font-bold" style={{ color: ad.healthScore >= 70 ? '#006c48' : ad.healthScore >= 40 ? '#a67c00' : '#9e2b25' }}>{ad.healthScore}</span></span>
                              <span>·</span>
                              <span>{(ad.fileSize / 1024).toFixed(0)} KB</span>
                            </>
                          )
                        })()}
                        {activePlanScanId !== scans[0]?.id && (
                          <>
                            <span className="ml-auto" />
                            <button
                              onClick={() => { setPlanScanId(null); setExpandedAutoItems(new Set()) }}
                              className="text-[#006c48] font-medium hover:underline"
                            >
                              Ir al último →
                            </button>
                          </>
                        )}
                      </div>
                    )}

                    {/* Add / Edit modal */}
                    {showAddForm && (
                      <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={resetForm}>
                        {/* Backdrop */}
                        <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
                        {/* Modal */}
                        <div
                          className="relative w-full max-w-md mx-4 rounded-2xl p-6 shadow-xl"
                          style={{ background: '#ffffff', border: '1px solid rgba(11, 31, 22, 0.08)' }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-between mb-5">
                            <h3 className="text-base font-semibold text-[#1a2e23]">
                              {editingItemId ? 'Editar acción' : 'Nueva acción'}
                            </h3>
                            <button onClick={resetForm} className="p-1.5 rounded-lg hover:bg-[#f0f2f1] transition-colors">
                              <X size={18} className="text-[#52695b]" />
                            </button>
                          </div>
                          <div className="space-y-4">
                            <div>
                              <label className="block text-sm font-medium text-[#1a2e23] mb-1.5">Título</label>
                              <input
                                type="text"
                                value={formTitle}
                                onChange={(e) => setFormTitle(e.target.value)}
                                placeholder="Ej: Migrar variables de color a tokens DS..."
                                className="w-full px-3 py-2.5 rounded-lg text-sm bg-white text-[#0b1f16] focus:outline-none focus:ring-2 focus:ring-[#006c48]"
                                style={{ border: '1px solid rgba(11, 31, 22, 0.14)' }}
                                autoFocus
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-[#1a2e23] mb-1.5">Prioridad</label>
                              <div className="flex gap-2">
                                {(['critical', 'high', 'medium', 'low'] as ActionPriority[]).map((p) => (
                                  <button
                                    key={p}
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
                              <label className="block text-sm font-medium text-[#1a2e23] mb-1.5">Descripción <span className="text-[#8a9b92] font-normal">(opcional)</span></label>
                              <textarea
                                value={formDescription}
                                onChange={(e) => setFormDescription(e.target.value)}
                                placeholder="Contexto, pasos, notas..."
                                rows={3}
                                className="w-full px-3 py-2.5 rounded-lg text-sm bg-white text-[#0b1f16] resize-none focus:outline-none focus:ring-2 focus:ring-[#006c48]"
                                style={{ border: '1px solid rgba(11, 31, 22, 0.14)' }}
                              />
                            </div>
                            <div className="flex gap-3 pt-2">
                              <Button
                                className="flex-1 h-10"
                                style={{ background: '#012d1d' }}
                                onClick={editingItemId ? handleUpdateItem : handleAddItem}
                                disabled={!formTitle.trim()}
                              >
                                {editingItemId ? 'Guardar cambios' : 'Añadir acción'}
                              </Button>
                              <Button variant="outline" className="flex-1 h-10" onClick={resetForm}>
                                Cancelar
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Unified action items list */}
                    {actionLoading ? (
                      <div className="flex items-center gap-2 py-4 justify-center">
                        <Loader2 size={16} className="animate-spin text-[#006c48]" />
                        <span className="text-sm text-[#52695b]">Cargando acciones...</span>
                      </div>
                    ) : (() => {
                      // Build unified list: manual items first (reorderable), then auto items
                      type UnifiedItem = { kind: 'manual'; item: ActionItem; manualIdx: number } | { kind: 'auto'; title: string; value: string; severity: string; description: string }
                      const unified: UnifiedItem[] = [
                        ...actionItems.map((item, i) => ({ kind: 'manual' as const, item, manualIdx: i })),
                        ...autoItems.map((a) => ({ kind: 'auto' as const, ...a })),
                      ]

                      return unified.length > 0 ? (
                        <div className="space-y-2">
                          {unified.map((entry, i) => {
                            if (entry.kind === 'manual') {
                              const { item, manualIdx } = entry
                              return (
                                <Card key={item.id} className="p-4 group" style={{ borderLeft: `3px solid ${sevColor[item.priority]}` }}>
                                  <div className="flex items-start gap-3">
                                    {/* Reorder buttons */}
                                    <div className="flex flex-col gap-0.5 shrink-0 pt-0.5">
                                      <button
                                        onClick={() => handleMoveItem(manualIdx, 'up')}
                                        disabled={manualIdx === 0}
                                        className="p-0.5 rounded hover:bg-[#f0f2f1] disabled:opacity-20 transition-opacity"
                                      >
                                        <ChevronUp size={14} className="text-[#52695b]" />
                                      </button>
                                      <button
                                        onClick={() => handleMoveItem(manualIdx, 'down')}
                                        disabled={manualIdx === actionItems.length - 1}
                                        className="p-0.5 rounded hover:bg-[#f0f2f1] disabled:opacity-20 transition-opacity"
                                      >
                                        <ChevronDown size={14} className="text-[#52695b]" />
                                      </button>
                                    </div>
                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-1">
                                        <Badge className="text-[10px] px-1.5 py-0" style={{ background: sevBg[item.priority], color: sevColor[item.priority] }}>
                                          {sevLabel[item.priority]}
                                        </Badge>
                                        <h4 className="text-sm font-semibold text-[#1a2e23]">{item.title}</h4>
                                      </div>
                                      {item.description && (
                                        <p className="text-xs text-[#52695b] mt-0.5">{item.description}</p>
                                      )}
                                    </div>
                                    {/* Actions */}
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                      <button onClick={() => startEdit(item)} className="p-1.5 rounded hover:bg-[#f0f2f1] transition-colors" title="Editar">
                                        <Pencil size={13} className="text-[#52695b]" />
                                      </button>
                                      <button onClick={() => handleDeleteItem(item.id)} className="p-1.5 rounded hover:bg-[#fbe8e6] transition-colors" title="Eliminar">
                                        <Trash2 size={13} className="text-[#9e2b25]" />
                                      </button>
                                    </div>
                                  </div>
                                </Card>
                              )
                            } else {
                              const autoIdx = i - actionItems.length
                              const isExpanded = expandedAutoItems.has(autoIdx)
                              const hasDetails = entry.detailHeaders && entry.detailRows && entry.detailRows.length > 0
                              const PREVIEW = 10
                              const visibleRows = isExpanded ? entry.detailRows : entry.detailRows?.slice(0, PREVIEW)

                              return (
                                <Card key={`auto-${i}`} className="p-4" style={{ borderLeft: `3px solid ${sevColor[entry.severity]}` }}>
                                  <div
                                    className={`flex items-start justify-between gap-4 ${hasDetails ? 'cursor-pointer' : ''}`}
                                    onClick={() => {
                                      if (!hasDetails) return
                                      setExpandedAutoItems(prev => {
                                        const next = new Set(prev)
                                        next.has(autoIdx) ? next.delete(autoIdx) : next.add(autoIdx)
                                        return next
                                      })
                                    }}
                                  >
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-1">
                                        <Badge className="text-[10px] px-1.5 py-0" style={{ background: sevBg[entry.severity], color: sevColor[entry.severity] }}>
                                          {sevLabel[entry.severity]}
                                        </Badge>
                                        <Badge className="text-[10px] px-1.5 py-0" style={{ background: 'rgba(0, 108, 72, 0.08)', color: '#006c48', border: '1px solid rgba(0, 108, 72, 0.18)' }}>
                                          Auto
                                        </Badge>
                                        <h4 className="text-sm font-semibold text-[#1a2e23]">{entry.title}</h4>
                                      </div>
                                      <p className="text-xs text-[#52695b]">{entry.description}</p>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                      <span className="text-sm font-bold text-[#1a2e23]">{entry.value}</span>
                                      {hasDetails && (
                                        isExpanded
                                          ? <ChevronUp size={14} className="text-[#52695b]" />
                                          : <ChevronDown size={14} className="text-[#52695b]" />
                                      )}
                                    </div>
                                  </div>

                                  {/* Expandable detail table */}
                                  {hasDetails && isExpanded && (
                                    <div className="mt-3 rounded-lg border border-[#f0f2f1] overflow-hidden">
                                      <div className="overflow-x-auto">
                                        <table className="w-full text-[11px]">
                                          <thead>
                                            <tr className="bg-[#f8f9fa]">
                                              {entry.detailHeaders!.map((h, hi) => (
                                                <th key={hi} className="text-left py-1.5 px-2 font-medium text-[#52695b] uppercase tracking-wider">{h}</th>
                                              ))}
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {visibleRows!.map((row, ri) => (
                                              <tr key={ri} className="border-t border-[#f0f2f1]" style={{ background: ri % 2 === 0 ? '#fef2f1' : '#fef2f180' }}>
                                                {row.cells.map((cell, ci) => (
                                                  <td key={ci} className="py-1.5 px-2 font-mono text-[#1a2e23] truncate max-w-[280px]">
                                                    {ci === 0 && row.swatch ? (
                                                      <span className="inline-flex items-center gap-1.5">
                                                        <span className="inline-block w-3 h-3 rounded-sm border border-[#f0f2f1] shrink-0" style={{ backgroundColor: row.swatch }} />
                                                        {cell}
                                                      </span>
                                                    ) : cell}
                                                  </td>
                                                ))}
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                      {entry.detailRows!.length > PREVIEW && (
                                        <div className="text-center py-1.5 border-t border-[#f0f2f1] bg-[#f8f9fa]">
                                          <span className="text-[10px] text-[#52695b]">
                                            {isExpanded
                                              ? `Mostrando todos (${entry.detailRows!.length})`
                                              : `${PREVIEW} de ${entry.detailRows!.length}`}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </Card>
                              )
                            }
                          })}
                        </div>
                      ) : (
                        <Card className="p-8 text-center" style={{ background: '#e5f2ec' }}>
                          <CheckCircle size={32} className="mx-auto mb-2 text-[#006c48]" />
                          <p className="text-sm font-medium text-[#006c48]">Sin acciones pendientes. Tu CSS está en buen estado.</p>
                        </Card>
                      )
                    })()}
                  </div>
                )
              })()}
            </div>
          ) : (
            <Card className="p-8 text-center">
              <p className="text-[#3d5a4a]">No hay escaneos para este proyecto. Crea uno en "Nuevo escaneo".</p>
            </Card>
          )
        ) : (
          <Card className="p-8 text-center">
            <p className="text-[#3d5a4a]">Selecciona un proyecto para continuar.</p>
          </Card>
        )}
      </div>

      {/* ScanDetailModal for future use */}
      {selectedScanId && latestDetail && (
        <ScanDetailModal
          scanId={latestDetail.id}
          analysis_data={latestDetail.analysis_data}
          w3c_validation={latestDetail.w3c_validation}
          ds_coverage={latestDetail.ds_coverage}
          onClose={() => setSelectedScanId(null)}
          {...(latestDetail as any)}
        />
      )}
    </div>
  )
}
