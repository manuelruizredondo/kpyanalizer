import { useState, useEffect, useRef, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import {
  createProject,
  deleteScan,
  deleteProject,
} from '@/lib/scan-storage'
import type { Project, Scan, ScanDetail } from '@/lib/scan-storage'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScanDetailModal } from './ScanDetailModal'
import { parseDsTokens } from '@/lib/ds-token-parser'
import { compareDsTokens } from '@/lib/ds-comparator'
import type { DsTokenSet, DsCoverageResult as FullDsCoverage } from '@/types/design-system'
import type { AnalysisResult } from '@/types/analysis'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import {
  Trash2,
  Eye,
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
  RefreshCw,
  Info,
  XCircle,
  Bold,
  CheckCircle,
  Grid3X3,
  Box,
} from 'lucide-react'

const HG5_URL = 'https://hg5.netlify.app/output.css'

// ─── Weight helpers (same as TypographyTab) ────────────────────
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
  if (isNaN(n)) return '#3d5a4a'
  if (n <= 300) return '#5cc49a'
  if (n <= 500) return '#2a9d6e'
  if (n <= 700) return '#006c48'
  return '#1a2e23'
}
const DS_WEIGHT_TARGET: Record<string, string | null> = {
  "100": null, "200": "100", "300": "100",
  "400": null, "500": "400", "600": null,
  "700": null, "800": "700", "900": "700",
}

// ─── Font classification (same logic as TypographyTab) ──────────
const DS_FONT_KEYWORD = 'suisse'
const GENERIC_FAMILIES = new Set([
  'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui',
  'ui-serif', 'ui-sans-serif', 'ui-monospace', 'ui-rounded', 'math',
  'emoji', 'fangsong', 'inherit', 'initial', 'unset', 'revert',
  'arial', 'helvetica', 'times new roman', 'times', 'courier new',
  'courier', 'georgia', 'verdana', 'tahoma', 'trebuchet ms',
  'palatino linotype', 'palatino', 'impact', 'lucida console',
  'lucida sans unicode', 'lucida grande', 'segoe ui', 'roboto',
])
function classifyFamily(normalized: string): 'ds' | 'generic' | 'eliminate' {
  const lower = normalized.toLowerCase().replace(/['"]/g, '').trim()
  if (lower.includes(DS_FONT_KEYWORD)) return 'ds'
  if (GENERIC_FAMILIES.has(lower)) return 'generic'
  return 'eliminate'
}
const CORS_PROXY = 'https://lqgdrkwabcjrnnthlrmi.supabase.co/functions/v1/cors-proxy'

// ─── Info Tooltip ──────────────────────────────────────────────────
function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="relative group inline-flex">
      <Info size={13} className="text-[#3d5a4a]/50 hover:text-[#006c48] cursor-help transition-colors" />
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 rounded-lg bg-[#1a2e23] text-white text-xs leading-relaxed px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-lg">
        {text}
        <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#1a2e23]" />
      </span>
    </span>
  )
}

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

// ─── Score Ring ─────────────────────────────────────────────────────
function ScoreRing({ score, size = 120 }: { score: number; size?: number }) {
  const radius = (size - 12) / 2
  const circumference = 2 * Math.PI * radius
  const progress = (score / 100) * circumference
  const color = score >= 70 ? '#006c48' : score >= 40 ? '#a67c00' : '#9e2b25'

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#f0f2f1" strokeWidth={10} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={10}
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold" style={{ color }}>
          {score}
        </span>
        <span className="text-xs text-[#3d5a4a]">/ 100</span>
      </div>
    </div>
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
// downIsGood = true → green if value went down, red if up (for errors, legacy counts)
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
  const { profile } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [scans, setScans] = useState<Scan[]>([])
  const [latestDetail, setLatestDetail] = useState<ScanDetail | null>(null)
  const [allDetails, setAllDetails] = useState<Map<string, ScanDetail>>(new Map())
  const [loading, setLoading] = useState(true)
  const [scansLoading, setScansLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showNewProjectForm, setShowNewProjectForm] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectDescription, setNewProjectDescription] = useState('')
  const [selectedScanId, setSelectedScanId] = useState<string | null>(null)

  // ── HG5 live comparison state ──
  const [hg5Tokens, setHg5Tokens] = useState<DsTokenSet | null>(null)
  const [hg5Coverage, setHg5Coverage] = useState<FullDsCoverage | null>(null)
  const [hg5Loading, setHg5Loading] = useState(false)
  const [hg5Error, setHg5Error] = useState<string | null>(null)
  const [showAllMismatches, setShowAllMismatches] = useState(false)
  const hg5FetchedRef = useRef(false)

  // ── Load projects ──
  useEffect(() => {
    loadProjects()
  }, [])

  const loadProjects = async () => {
    try {
      setLoading(true)
      setError(null)

      // Use getSession (local, no network) instead of getUser (network call that hangs)
      console.log('[Dashboard] Checking local session...')
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setError('No hay sesión activa. Inicia sesión para continuar.')
        setLoading(false)
        return
      }
      console.log('[Dashboard] Session found for:', session.user.email)

      // Fetch projects via direct REST call (bypasses SDK issues)
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
        // Get ALL scan details for historical charts
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
          setAllDetails(detailMap)

          // Set latest detail
          const latestD = detailMap.get(scansList[0].id)
          setLatestDetail(latestD || null)
        } catch (detailErr) {
          console.warn('[Dashboard] Could not load scan details:', detailErr)
          setLatestDetail(null)
          setAllDetails(new Map())
        }
      } else {
        setLatestDetail(null)
        setAllDetails(new Map())
      }
    } catch (err) {
      console.error('[Dashboard] Error loading scans:', err)
      setScans([])
      setLatestDetail(null)
    } finally {
      setScansLoading(false)
    }
  }

  // ── Fetch HG5 tokens and compare against latest analysis ──
  const fetchHg5Comparison = async (analysisData: AnalysisResult) => {
    setHg5Loading(true)
    setHg5Error(null)
    try {
      const proxyUrl = `${CORS_PROXY}?url=${encodeURIComponent(HG5_URL)}`
      const resp = await fetch(proxyUrl)
      if (!resp.ok) throw new Error(`Error ${resp.status}`)
      const css = await resp.text()
      const tokens = parseDsTokens(css, 'output.css')
      setHg5Tokens(tokens)
      const coverage = compareDsTokens(
        analysisData.colors,
        analysisData.fontSizes,
        analysisData.spacingValues,
        analysisData.zIndexValues,
        tokens
      )
      setHg5Coverage(coverage)
    } catch (e) {
      setHg5Error(e instanceof Error ? e.message : 'Error al cargar HolyGrail5')
    } finally {
      setHg5Loading(false)
    }
  }

  // ── Auto-fetch HG5 when latest detail is available ──
  useEffect(() => {
    if (latestDetail?.analysis_data && !hg5FetchedRef.current) {
      hg5FetchedRef.current = true
      fetchHg5Comparison(latestDetail.analysis_data)
    }
  }, [latestDetail])

  // ── Handlers ──
  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return
    try {
      const newProjectId = await createProject(newProjectName, newProjectDescription || undefined)
      await loadProjects()
      setSelectedProjectId(newProjectId)
      setNewProjectName('')
      setNewProjectDescription('')
      setShowNewProjectForm(false)
    } catch (error) {
      console.error('Error creating project:', error)
    }
  }

  const handleDeleteScan = async (scanId: string) => {
    if (!window.confirm('¿Deseas eliminar este escaneo?')) return
    try {
      await deleteScan(scanId)
      if (selectedProjectId) await loadScans(selectedProjectId)
    } catch (error) {
      console.error('Error deleting scan:', error)
    }
  }

  const handleDeleteProject = async (projectId: string) => {
    if (!window.confirm('¿Deseas eliminar este proyecto y todos sus escaneos?')) return
    try {
      await deleteProject(projectId)
      const updated = projects.filter((p) => p.id !== projectId)
      setProjects(updated)
      if (selectedProjectId === projectId) {
        setSelectedProjectId(updated.length > 0 ? updated[0].id : null)
        setScans([])
        setLatestDetail(null)
      }
    } catch (error) {
      console.error('Error deleting project:', error)
    }
  }

  // ── Derived data ──
  const selectedProject = projects.find((p) => p.id === selectedProjectId)
  const latestScan = scans.length > 0 ? scans[0] : null
  const previousScan = scans.length > 1 ? scans[1] : null
  const chronologicalScans = [...scans].reverse()

  const getHealthScoreBadgeColor = (score: number) => {
    if (score >= 70) return 'bg-[#e0f5ec] text-[#006c48]'
    if (score >= 40) return 'bg-[#fef6e0] text-[#a67c00]'
    return 'bg-[#fef2f1] text-[#9e2b25]'
  }

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
    selectores: s.total_selectors,
    declaraciones: s.total_declarations,
    unicas: s.unique_declarations,
  }))

  const issuesChartData = chronologicalScans.map((s) => ({
    date: new Date(s.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }),
    '!important': s.important_count,
    IDs: s.id_count,
  }))

  const reuseChartData = chronologicalScans.map((s) => ({
    date: new Date(s.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }),
    ratio: +(s.reuse_ratio * 100).toFixed(1),
  }))

  // ── Legacy reduction chart data (from scan details) ──
  const legacyChartData = useMemo(() => {
    if (chronologicalScans.length === 0) return []
    return chronologicalScans.map((s) => {
      const detail = allDetails.get(s.id)
      const ad = detail?.analysis_data as AnalysisResult | undefined

      // Colors hardcoded
      const colorsCount = ad?.colors?.length || 0

      // Font families to eliminate
      const families = ad?.fontFamilies || []
      const eliminateFamilies = families.filter(f => classifyFamily(f.normalized || f.value) === 'eliminate').length

      // Font weights needing consolidation
      const weights = ad?.fontWeights || []
      const weightGroups = new Map<string, boolean>()
      for (const w of weights) {
        const target = DS_WEIGHT_TARGET[w.normalized]
        if (target !== undefined && target !== null) weightGroups.set(w.normalized, true)
      }
      const weightActions = weightGroups.size

      // Spacing: px not multiple of 8
      const spacing = ad?.spacingValues || []
      const spacingBadPx = spacing.filter(sv => {
        const n = parseFloat(sv.normalized)
        const isPx = /px$/i.test(sv.normalized) || sv.normalized === '0' || /^\d+$/.test(sv.normalized)
        if (!isPx || isNaN(n)) return false
        return n !== 0 && n % 8 !== 0
      }).length

      // Z-index irregulars
      const zValues = ad?.zIndexValues || []
      const zIrregulars = zValues.filter(z => {
        const n = parseInt(z.value, 10)
        return !isNaN(n) && n !== 0 && n % 1000 !== 0
      }).length

      // Validation errors
      const w3cErrors = detail?.w3c_validation?.errorCount || 0

      return {
        date: new Date(s.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }),
        colorsCount,
        eliminateFamilies,
        weightActions,
        spacingBadPx,
        zIrregulars,
        w3cErrors,
      }
    })
  }, [chronologicalScans, allDetails])

  const compositionChartData = latestScan
    ? [
        { name: 'Clases', value: latestScan.class_count, fill: '#006c48' },
        { name: 'IDs', value: latestScan.id_count, fill: '#a67c00' },
        { name: '!important', value: latestScan.important_count, fill: '#9e2b25' },
        { name: 'Variables', value: latestScan.variable_count, fill: '#2a9d6e' },
      ]
    : []

  // ── Loading / Error states ──
  if (loading && projects.length === 0) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-gray-500">Cargando...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <AlertTriangle size={32} className="text-[#9e2b25]" />
        <p className="text-red-600 text-center max-w-md">{error}</p>
        <div className="flex gap-3">
          <Button onClick={loadProjects} variant="outline" size="sm">
            Reintentar
          </Button>
          <Button
            onClick={async () => {
              await supabase.auth.signOut()
              window.location.reload()
            }}
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

  // ── Render ──
  return (
    <div className="flex min-h-[calc(100vh-73px)] w-full">
      {/* ─── Sidebar ─── */}
      <div className="w-64 shrink-0 bg-white rounded-2xl m-[10px] p-6 shadow-sm self-start sticky top-[10px]">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-[#1a2e23] mb-4">Proyectos</h2>

          {!showNewProjectForm ? (
            <Button onClick={() => setShowNewProjectForm(true)} className="w-full" size="sm">
              Nuevo proyecto
            </Button>
          ) : (
            <div className="space-y-3 p-3 bg-[#f8f9fa] rounded-xl">
              <input
                type="text"
                placeholder="Nombre del proyecto"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                className="w-full px-3 py-2 bg-white rounded-lg border-0 text-sm focus:outline-none focus:ring-2 focus:ring-[#006c48]"
              />
              <textarea
                placeholder="Descripción (opcional)"
                value={newProjectDescription}
                onChange={(e) => setNewProjectDescription(e.target.value)}
                className="w-full px-3 py-2 bg-white rounded-lg border-0 text-sm focus:outline-none focus:ring-2 focus:ring-[#006c48] resize-none"
                rows={2}
              />
              <div className="flex gap-2">
                <Button onClick={handleCreateProject} size="sm" className="flex-1">
                  Crear
                </Button>
                <Button
                  onClick={() => {
                    setShowNewProjectForm(false)
                    setNewProjectName('')
                    setNewProjectDescription('')
                  }}
                  size="sm"
                  variant="outline"
                  className="flex-1"
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-1">
          {projects.map((project) => (
            <div
              key={project.id}
              onClick={() => setSelectedProjectId(project.id)}
              className={`group relative flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                selectedProjectId === project.id ? 'bg-[#e0f5ec]' : 'hover:bg-[#f8f9fa]'
              }`}
            >
              <div className="min-w-0 flex-1">
                <h3 className="font-medium text-[#1a2e23] text-sm truncate">{project.name}</h3>
                {project.description && (
                  <p className="text-xs text-[#3d5a4a] mt-0.5 truncate">{project.description}</p>
                )}
              </div>
              {profile?.role === 'super_admin' && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteProject(project.id) }}
                  className="shrink-0 p-1 rounded text-[#9e2b25]/0 group-hover:text-[#9e2b25] hover:!text-[#7a1e1a] hover:bg-[#fef2f1] transition-all"
                  title="Eliminar proyecto"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>

        {projects.length === 0 && !loading && (
          <div className="text-center py-8">
            <p className="text-sm text-[#3d5a4a]">No hay proyectos aun</p>
          </div>
        )}
      </div>

      {/* ─── Main Content ─── */}
      <div className="flex-1 min-w-0 p-8 space-y-8">
        {scansLoading ? (
          <div className="flex items-center justify-center py-24 gap-3">
            <Loader2 className="animate-spin text-[#006c48]" size={24} />
            <p className="text-[#3d5a4a]">Cargando escaneos...</p>
          </div>
        ) : selectedProject ? (
          scans.length > 0 && latestScan ? (
            <>
              {/* ── Header ── */}
              <div className="flex items-end justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-[#1a2e23]">{selectedProject.name}</h1>
                  <p className="text-[#3d5a4a] mt-1">
                    {scans.length} escaneo{scans.length !== 1 ? 's' : ''} · Ultima actualizacion:{' '}
                    {new Date(latestScan.created_at).toLocaleDateString('es-ES', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                </div>
                <Badge className={`text-base px-4 py-1 ${getHealthScoreBadgeColor(latestScan.health_score)}`}>
                  Health Score: {latestScan.health_score}
                </Badge>
              </div>

              {/* ══════════════════════════════════════════════════════════════
                   HERO — CSS Health Score Line Chart
                 ══════════════════════════════════════════════════════════════ */}
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

              {/* ══════════════════════════════════════════════════════════════
                   SECTION 1 — Metrics Cards
                 ══════════════════════════════════════════════════════════════ */}
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

              {/* ══════════════════════════════════════════════════════════════
                   SECTION 2 — Typography, CSS Validation & Design System Coverage
                 ══════════════════════════════════════════════════════════════ */}
              {(() => {
                const ad = latestDetail?.analysis_data as AnalysisResult | undefined
                const families = ad?.fontFamilies || []
                const weights = ad?.fontWeights || []
                const sizes = ad?.fontSizes || []

                // Classify families
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
                              {/* Mini pie chart */}
                              {pieData.length > 0 && (
                                <div className="shrink-0">
                                  <ResponsiveContainer width={90} height={90}>
                                    <PieChart>
                                      <Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius={24} outerRadius={42} paddingAngle={2}>
                                        {pieData.map((d, i) => (
                                          <Cell key={i} fill={d.color} />
                                        ))}
                                      </Pie>
                                      <Tooltip formatter={(v: number, name: string) => [`${v} usos`, name]} />
                                    </PieChart>
                                  </ResponsiveContainer>
                                </div>
                              )}

                              <div className="flex-1 space-y-2">
                                {/* Suisse coverage */}
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-[#3d5a4a]">Cobertura Suisse</span>
                                  <Badge className={suissePct >= 70 ? 'bg-[#e0f5ec] text-[#006c48]' : suissePct >= 40 ? 'bg-[#fef6e0] text-[#a67c00]' : 'bg-[#fef2f1] text-[#9e2b25]'}>
                                    {suissePct}%
                                  </Badge>
                                </div>
                                <div className="h-1.5 bg-[#f0f2f1] rounded-full overflow-hidden">
                                  <div className="h-full rounded-full bg-[#006c48] transition-all" style={{ width: `${suissePct}%` }} />
                                </div>

                                {/* Quick stats */}
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

                            {/* Fonts to eliminate */}
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

                    {/* ── Font Weight Consolidation Table ── */}
                    {weights.length > 0 && (() => {
                      const groups = new Map<string, { normalized: string; variants: { value: string; count: number }[]; totalCount: number }>()
                      for (const w of weights) {
                        const key = w.normalized
                        if (!groups.has(key)) groups.set(key, { normalized: key, variants: [], totalCount: 0 })
                        const g = groups.get(key)!
                        g.variants.push({ value: w.value, count: w.count })
                        g.totalCount += w.count
                      }
                      const allGroups = [...groups.values()].sort((a, b) => {
                        const na = parseInt(a.normalized, 10), nb = parseInt(b.normalized, 10)
                        if (!isNaN(na) && !isNaN(nb)) return na - nb
                        return a.normalized.localeCompare(b.normalized)
                      })
                      const actionsCount = allGroups.filter(g => DS_WEIGHT_TARGET[g.normalized] != null).length
                        + allGroups.filter(g => g.variants.length > 1).length

                      return (
                        <Card className="p-6">
                          <div className="flex items-center gap-2 mb-1">
                            <Bold size={20} className="text-[#006c48]" />
                            <h3 className="text-lg font-semibold text-[#1a2e23]">Traslado de Grosores</h3>
                            <InfoTooltip text="Pesos aprobados del DS: 100, 400, 600 y 700. El resto se consolida al peso aprobado mas cercano." />
                          </div>
                          {actionsCount > 0 && (
                            <p className="text-xs text-[#9e2b25] mb-3">
                              {actionsCount} accion{actionsCount !== 1 ? 'es' : ''} pendiente{actionsCount !== 1 ? 's' : ''}
                            </p>
                          )}
                          <div className="overflow-hidden rounded-lg border border-[#f0f2f1]">
                            <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
                              <colgroup>
                                <col style={{ width: '55px' }} />
                                <col style={{ width: '80px' }} />
                                <col style={{ width: '120px' }} />
                                <col style={{ width: '50px' }} />
                                <col />
                              </colgroup>
                              <thead>
                                <tr className="bg-[#f8f9fa]">
                                  <th className="text-center py-2 px-2 text-[11px] font-semibold text-[#1a2e23]">Peso</th>
                                  <th className="text-left py-2 px-2 text-[11px] font-semibold text-[#1a2e23]">Nombre</th>
                                  <th className="text-left py-2 px-2 text-[11px] font-semibold text-[#1a2e23]">Valores</th>
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
                                      <td className="py-1.5 px-2 text-center">
                                        <div
                                          className={`inline-block w-7 text-center rounded px-1 py-0.5 text-[9px] font-semibold text-white ${needsConsolidation ? 'line-through opacity-60' : ''}`}
                                          style={{ backgroundColor: getWeightBarColor(g.normalized) }}
                                        >
                                          {g.normalized}
                                        </div>
                                      </td>
                                      <td className={`py-1.5 px-2 text-[10px] ${needsConsolidation ? 'text-[#9e2b25] line-through' : 'text-[#3d5a4a]'}`}>
                                        {getWeightLabel(g.normalized)}
                                      </td>
                                      <td className="py-1.5 px-2">
                                        <div className="flex flex-wrap gap-1">
                                          {g.variants.map((v, i) => (
                                            <span key={i} className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-mono ${
                                              needsConsolidation ? 'bg-[#fef2f1] text-[#9e2b25]' : hasDupes ? 'bg-[#fef6e0] text-[#a67c00]' : 'bg-[#f0f2f1] text-[#1a2e23]'
                                            }`}>
                                              {v.value}
                                              <span className="text-[8px] opacity-60">{v.count}x</span>
                                            </span>
                                          ))}
                                        </div>
                                      </td>
                                      <td className="py-1.5 px-2 text-center text-[10px] font-semibold text-[#1a2e23] tabular-nums">{g.totalCount}</td>
                                      <td className="py-1.5 px-2">
                                        {needsConsolidation ? (
                                          <div className="flex items-center gap-1">
                                            <Badge className="bg-[#fef2f1] text-[#9e2b25] text-[8px] px-1.5 py-0 shrink-0">Consolidar</Badge>
                                            <span className="text-[9px] text-[#9e2b25]">
                                              → {dsTarget} ({getWeightLabel(dsTarget!)})
                                            </span>
                                          </div>
                                        ) : hasDupes ? (
                                          <div className="flex items-center gap-1">
                                            <Badge className="bg-[#fef6e0] text-[#a67c00] text-[8px] px-1.5 py-0 shrink-0">Unificar</Badge>
                                            <span className="text-[9px] text-[#a67c00]">→ usar {g.normalized}</span>
                                          </div>
                                        ) : (
                                          <Badge className="bg-[#e0f5ec] text-[#006c48] text-[8px] px-1.5 py-0">OK</Badge>
                                        )}
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        </Card>
                      )
                    })()}

                    {/* ── Hardcoded Values Summary ── */}
                    {ad && (
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Colors card */}
                        <Card className="p-6">
                          <div className="flex items-center gap-2 mb-3">
                            <Palette size={18} className="text-[#006c48]" />
                            <h3 className="text-sm font-semibold text-[#1a2e23]">Colores Hardcodeados</h3>
                          </div>
                          {ad.colors.length > 0 ? (
                            <div className="space-y-3">
                              <p className="text-3xl font-bold text-[#1a2e23]">{ad.colors.length}</p>
                              <p className="text-xs text-[#3d5a4a]">colores escritos directamente en el CSS</p>
                              <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                                {[...ad.colors].sort((a, b) => b.count - a.count).slice(0, 20).map((c, i) => (
                                  <div key={i} className="w-5 h-5 rounded border border-black/10 shrink-0" style={{ backgroundColor: c.normalized }} title={`${c.value} (${c.count}x)`} />
                                ))}
                                {ad.colors.length > 20 && <span className="text-[10px] text-[#3d5a4a] self-center ml-1">+{ad.colors.length - 20}</span>}
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm text-[#3d5a4a]">Sin colores hardcodeados</p>
                          )}
                        </Card>

                        {/* Spacing card */}
                        {(() => {
                          const spacing = ad.spacingValues || []
                          const isPx = (val: string) => /px$/i.test(val) || val === '0' || /^\d+$/.test(val)
                          const isPercent = (val: string) => /%$/.test(val) || /v[wh]$/i.test(val)
                          const pxVals = spacing.filter(s => isPx(s.normalized))
                          const pctVals = spacing.filter(s => isPercent(s.normalized))
                          const otherVals = spacing.filter(s => !isPx(s.normalized) && !isPercent(s.normalized))
                          const pxBad = pxVals.filter(s => {
                            const n = parseFloat(s.normalized)
                            return isNaN(n) || (n !== 0 && n % 8 !== 0)
                          })

                          return (
                            <Card className="p-6">
                              <div className="flex items-center gap-2 mb-3">
                                <Grid3X3 size={18} className="text-[#006c48]" />
                                <h3 className="text-sm font-semibold text-[#1a2e23]">Spacing</h3>
                                <InfoTooltip text="Valores de margin/padding/gap. Los px deben ser multiplos de 8. Porcentajes y otras unidades se muestran aparte." />
                              </div>
                              {spacing.length > 0 ? (
                                <div className="space-y-3">
                                  <p className="text-3xl font-bold text-[#1a2e23]">{spacing.length}</p>
                                  <p className="text-xs text-[#3d5a4a]">valores de spacing hardcodeados</p>

                                  <div className="grid grid-cols-3 gap-2">
                                    <div className="text-center p-2 rounded-lg bg-[#f8f9fa]">
                                      <p className="text-sm font-bold text-[#1a2e23]">{pxVals.length}</p>
                                      <p className="text-[9px] text-[#3d5a4a]">px</p>
                                    </div>
                                    <div className="text-center p-2 rounded-lg bg-[#f0f4ff]">
                                      <p className="text-sm font-bold text-[#2c5282]">{pctVals.length}</p>
                                      <p className="text-[9px] text-[#3d5a4a]">% / vw / vh</p>
                                    </div>
                                    <div className="text-center p-2 rounded-lg bg-[#f8f9fa]">
                                      <p className="text-sm font-bold text-[#3d5a4a]">{otherVals.length}</p>
                                      <p className="text-[9px] text-[#3d5a4a]">rem / em / otro</p>
                                    </div>
                                  </div>

                                  {pxBad.length > 0 ? (
                                    <div className="flex items-start gap-2 p-2 bg-[#fef2f1] rounded-lg">
                                      <AlertTriangle size={14} className="text-[#9e2b25] shrink-0 mt-0.5" />
                                      <div>
                                        <p className="text-xs font-semibold text-[#9e2b25]">{pxBad.length} px fuera de la grid 8</p>
                                        <p className="text-[10px] text-[#9e2b25]/70 truncate">
                                          {pxBad.slice(0, 5).map(s => s.value).join(', ')}
                                          {pxBad.length > 5 ? ` +${pxBad.length - 5}` : ''}
                                        </p>
                                      </div>
                                    </div>
                                  ) : pxVals.length > 0 ? (
                                    <div className="flex items-center gap-2 p-2 bg-[#e0f5ec] rounded-lg">
                                      <CheckCircle size={12} className="text-[#006c48]" />
                                      <p className="text-[11px] text-[#006c48] font-medium">Todos los px siguen la grid de 8</p>
                                    </div>
                                  ) : null}
                                </div>
                              ) : (
                                <p className="text-sm text-[#3d5a4a]">Sin spacing hardcodeado</p>
                              )}
                            </Card>
                          )
                        })()}

                        {/* Z-index card */}
                        {(() => {
                          const zValues = ad.zIndexValues || []
                          const parsed = zValues.map(z => ({ ...z, num: parseInt(z.value, 10) })).filter(z => !isNaN(z.num))
                          const negatives = parsed.filter(z => z.num < 0)
                          const irregulars = parsed.filter(z => z.num !== 0 && z.num % 1000 !== 0)
                          // Count how many of the 10 standard depth layers (0–9000) are used
                          const STANDARD_LAYERS = 10 // 0, 1000, 2000 … 9000
                          const usedStandard = new Set(
                            parsed.filter(z => z.num >= 0 && z.num < 10000).map(z => Math.floor(z.num / 1000) * 1000)
                          )
                          const outOfRange = parsed.filter(z => z.num >= 10000)
                          const usedDepths = new Set(parsed.filter(z => z.num >= 0).map(z => Math.floor(z.num / 1000) * 1000))

                          return (
                            <Card className="p-6">
                              <div className="flex items-center gap-2 mb-3">
                                <Box size={18} className="text-[#006c48]" />
                                <h3 className="text-sm font-semibold text-[#1a2e23]">Z-index</h3>
                                <InfoTooltip text="Valores z-index. Deben ir de 1000 en 1000. Cada rango se reserva para un tipo de elemento UI." />
                              </div>
                              {zValues.length > 0 ? (
                                <div className="space-y-3">
                                  <div className="flex items-baseline gap-2">
                                    <p className="text-3xl font-bold text-[#1a2e23]">{zValues.length}</p>
                                    <p className="text-xs text-[#3d5a4a]">valores en {usedStandard.size} de {STANDARD_LAYERS} capas</p>
                                  </div>

                                  <div className="grid grid-cols-2 gap-2">
                                    <div className="text-center p-2 rounded-lg bg-[#f8f9fa]">
                                      <p className="text-sm font-bold text-[#1a2e23]">{usedStandard.size}</p>
                                      <p className="text-[9px] text-[#3d5a4a]">capas usadas</p>
                                    </div>
                                    <div className="text-center p-2 rounded-lg bg-[#f8f9fa]">
                                      <p className="text-sm font-bold text-[#3d5a4a]">{STANDARD_LAYERS - usedStandard.size}</p>
                                      <p className="text-[9px] text-[#3d5a4a]">capas libres</p>
                                    </div>
                                  </div>

                                  {irregulars.length > 0 && (
                                    <div className="flex items-start gap-2 p-2 bg-[#fef2f1] rounded-lg">
                                      <AlertTriangle size={14} className="text-[#9e2b25] shrink-0 mt-0.5" />
                                      <div>
                                        <p className="text-xs font-semibold text-[#9e2b25]">{irregulars.length} fuera de la escala ×1000</p>
                                        <p className="text-[10px] text-[#9e2b25]/70 truncate">
                                          {irregulars.slice(0, 5).map(z => z.value).join(', ')}
                                          {irregulars.length > 5 ? ` +${irregulars.length - 5}` : ''}
                                        </p>
                                      </div>
                                    </div>
                                  )}

                                  {outOfRange.length > 0 && (
                                    <div className="flex items-start gap-2 p-2 bg-[#fef2f1] rounded-lg">
                                      <AlertTriangle size={14} className="text-[#9e2b25] shrink-0 mt-0.5" />
                                      <p className="text-xs text-[#9e2b25]">
                                        <strong>{outOfRange.length}</strong> valor{outOfRange.length !== 1 ? 'es' : ''} por encima de 9999
                                      </p>
                                    </div>
                                  )}

                                  {negatives.length > 0 && (
                                    <div className="flex items-start gap-2 p-2 bg-[#fef6e0] rounded-lg">
                                      <AlertTriangle size={14} className="text-[#a67c00] shrink-0 mt-0.5" />
                                      <p className="text-xs text-[#a67c00]">
                                        <strong>{negatives.length}</strong> valor{negatives.length !== 1 ? 'es' : ''} negativo{negatives.length !== 1 ? 's' : ''}
                                      </p>
                                    </div>
                                  )}

                                  {irregulars.length === 0 && negatives.length === 0 && outOfRange.length === 0 && (
                                    <div className="flex items-center gap-2 p-2 bg-[#e0f5ec] rounded-lg">
                                      <CheckCircle size={12} className="text-[#006c48]" />
                                      <p className="text-[11px] text-[#006c48] font-medium">Escala limpia — todo en multiplos de 1000</p>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <p className="text-sm text-[#3d5a4a]">Sin z-index hardcodeado</p>
                              )}
                            </Card>
                          )
                        })()}
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* ══════════════════════════════════════════════════════════════
                   SECTION 2a — Legacy Reduction Charts
                 ══════════════════════════════════════════════════════════════ */}
              {legacyChartData.length > 1 && (
                <div>
                  <SectionHeader
                    title="Reduccion de Legacy"
                    tooltip="Evolucion de los valores hardcodeados, errores y deuda tecnica CSS a lo largo de los escaneos. El objetivo es que todas las lineas bajen hasta cero."
                  />
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Hardcoded Colors */}
                    <Card className="p-6">
                      <ChartTitle
                        title="Colores Hardcodeados"
                        tooltip="Cantidad de colores escritos directamente en el CSS. Deben reemplazarse por variables del Design System."
                        first={legacyChartData[0]?.colorsCount}
                        last={legacyChartData[legacyChartData.length - 1]?.colorsCount}
                      />
                      <ResponsiveContainer width="100%" height={200}>
                        <AreaChart data={legacyChartData}>
                          <defs>
                            <linearGradient id="gradColors" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#9e2b25" stopOpacity={0.2} />
                              <stop offset="95%" stopColor="#9e2b25" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f1" />
                          <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} />
                          <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                          <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: '12px' }} />
                          <Area type="monotone" dataKey="colorsCount" stroke="#9e2b25" strokeWidth={2} fill="url(#gradColors)" name="Colores" dot={{ r: 3 }} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </Card>

                    {/* Fonts to Eliminate */}
                    <Card className="p-6">
                      <ChartTitle
                        title="Fuentes a Eliminar"
                        tooltip="Familias tipograficas que no son Suisse ni genericas. Deben reemplazarse por Suisse."
                        first={legacyChartData[0]?.eliminateFamilies}
                        last={legacyChartData[legacyChartData.length - 1]?.eliminateFamilies}
                      />
                      <ResponsiveContainer width="100%" height={200}>
                        <AreaChart data={legacyChartData}>
                          <defs>
                            <linearGradient id="gradFonts" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#a67c00" stopOpacity={0.2} />
                              <stop offset="95%" stopColor="#a67c00" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f1" />
                          <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} />
                          <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                          <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: '12px' }} />
                          <Area type="monotone" dataKey="eliminateFamilies" stroke="#a67c00" strokeWidth={2} fill="url(#gradFonts)" name="Fuentes" dot={{ r: 3 }} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </Card>

                    {/* Spacing — px fuera de grid 8 */}
                    <Card className="p-6">
                      <ChartTitle
                        title="Spacing fuera de Grid 8"
                        tooltip="Valores de spacing en px que no son multiplos de 8. Deben ajustarse a la escala de 8px."
                        first={legacyChartData[0]?.spacingBadPx}
                        last={legacyChartData[legacyChartData.length - 1]?.spacingBadPx}
                      />
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={legacyChartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f1" />
                          <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} />
                          <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                          <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: '12px' }} />
                          <Bar dataKey="spacingBadPx" fill="#9e2b25" radius={[4, 4, 0, 0]} name="px fuera de grid 8" />
                        </BarChart>
                      </ResponsiveContainer>
                    </Card>

                    {/* Z-index irregulares */}
                    <Card className="p-6">
                      <ChartTitle
                        title="Z-index Irregulares"
                        tooltip="Valores z-index que no son multiplos de 1000. Deben ajustarse a la escala de profundidad."
                        first={legacyChartData[0]?.zIrregulars}
                        last={legacyChartData[legacyChartData.length - 1]?.zIrregulars}
                      />
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={legacyChartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f1" />
                          <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} />
                          <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                          <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: '12px' }} />
                          <Bar dataKey="zIrregulars" fill="#a67c00" radius={[4, 4, 0, 0]} name="Z-index irregulares" />
                        </BarChart>
                      </ResponsiveContainer>
                    </Card>

                    {/* Weight consolidation actions */}
                    <Card className="p-6">
                      <ChartTitle
                        title="Grosores a Consolidar"
                        tooltip="Pesos tipograficos que deben trasladarse a los pesos aprobados del DS (100, 400, 600, 700)."
                        first={legacyChartData[0]?.weightActions}
                        last={legacyChartData[legacyChartData.length - 1]?.weightActions}
                      />
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={legacyChartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f1" />
                          <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} />
                          <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                          <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: '12px' }} />
                          <Bar dataKey="weightActions" fill="#5cc49a" radius={[4, 4, 0, 0]} name="Grosores a consolidar" />
                        </BarChart>
                      </ResponsiveContainer>
                    </Card>

                    {/* Validation Errors */}
                    <Card className="p-6">
                      <ChartTitle
                        title="Errores de Validacion"
                        tooltip="Errores detectados por el validador CSS. Incluye propiedades desconocidas, sintaxis invalida, etc."
                        first={legacyChartData[0]?.w3cErrors}
                        last={legacyChartData[legacyChartData.length - 1]?.w3cErrors}
                      />
                      <ResponsiveContainer width="100%" height={200}>
                        <AreaChart data={legacyChartData}>
                          <defs>
                            <linearGradient id="gradErrors" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#9e2b25" stopOpacity={0.15} />
                              <stop offset="95%" stopColor="#9e2b25" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f1" />
                          <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} />
                          <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                          <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: '12px' }} />
                          <Area type="monotone" dataKey="w3cErrors" stroke="#9e2b25" strokeWidth={2} fill="url(#gradErrors)" name="Errores" dot={{ r: 3 }} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </Card>
                  </div>
                </div>
              )}

              {/* ══════════════════════════════════════════════════════════════
                   SECTION 2b — HolyGrail5 Live Comparison
                 ══════════════════════════════════════════════════════════════ */}
              <div>
                <SectionHeader title="Comparativa con HolyGrail5" tooltip="Cruce automatico de tu CSS con el framework HolyGrail5. Muestra que valores ya existen en HG5 (redundantes) y cuales no. Usa esto para eliminar codigo duplicado.">
                  {!hg5Loading && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => {
                        hg5FetchedRef.current = false
                        if (latestDetail?.analysis_data) fetchHg5Comparison(latestDetail.analysis_data)
                      }}
                    >
                      <RefreshCw size={14} />
                      Recargar
                    </Button>
                  )}
                </SectionHeader>

                {hg5Loading ? (
                  <Card className="p-8 flex items-center justify-center gap-3">
                    <Loader2 className="animate-spin text-[#006c48]" size={20} />
                    <p className="text-sm text-[#3d5a4a]">Cargando CSS de HolyGrail5...</p>
                  </Card>
                ) : hg5Error ? (
                  <Card className="p-6">
                    <p className="text-sm text-[#9e2b25]">Error al cargar HG5: {hg5Error}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => {
                        hg5FetchedRef.current = false
                        if (latestDetail?.analysis_data) fetchHg5Comparison(latestDetail.analysis_data)
                      }}
                    >
                      Reintentar
                    </Button>
                  </Card>
                ) : hg5Coverage && hg5Tokens ? (
                  <div className="space-y-4">
                    {/* HG5 overview cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                      <Card className="p-4 col-span-1">
                        <p className="text-xs text-[#3d5a4a] mb-1">Cobertura HG5</p>
                        <p className="text-3xl font-bold" style={{ color: hg5Coverage.overallCoverage >= 50 ? '#006c48' : '#9e2b25' }}>
                          {hg5Coverage.overallCoverage.toFixed(0)}%
                        </p>
                        <p className="text-xs text-[#3d5a4a] mt-1">de tus valores ya estan en HG5</p>
                      </Card>
                      <Card className="p-4">
                        <div className="flex items-center gap-2 mb-1">
                          <Palette size={14} className="text-[#006c48]" />
                          <p className="text-xs text-[#3d5a4a]">Colores</p>
                        </div>
                        <p className="text-xl font-bold text-[#1a2e23]">{hg5Coverage.colors.matchedToDs}/{hg5Coverage.colors.totalUsed}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 h-1.5 bg-[#f0f2f1] rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-[#006c48]" style={{ width: `${hg5Coverage.colors.coverage}%` }} />
                          </div>
                          <span className="text-xs font-medium text-[#3d5a4a]">{hg5Coverage.colors.coverage.toFixed(0)}%</span>
                        </div>
                        {hg5Coverage.colors.redundant.length > 0 && (
                          <p className="text-xs text-[#9e2b25] mt-1">{hg5Coverage.colors.redundant.length} redundantes</p>
                        )}
                      </Card>
                      <Card className="p-4">
                        <div className="flex items-center gap-2 mb-1">
                          <Type size={14} className="text-[#2a9d6e]" />
                          <p className="text-xs text-[#3d5a4a]">Font Sizes</p>
                        </div>
                        <p className="text-xl font-bold text-[#1a2e23]">{hg5Coverage.fontSizes.matchedToDs}/{hg5Coverage.fontSizes.totalUsed}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 h-1.5 bg-[#f0f2f1] rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-[#2a9d6e]" style={{ width: `${hg5Coverage.fontSizes.coverage}%` }} />
                          </div>
                          <span className="text-xs font-medium text-[#3d5a4a]">{hg5Coverage.fontSizes.coverage.toFixed(0)}%</span>
                        </div>
                        {hg5Coverage.fontSizes.redundant.length > 0 && (
                          <p className="text-xs text-[#9e2b25] mt-1">{hg5Coverage.fontSizes.redundant.length} redundantes</p>
                        )}
                      </Card>
                      <Card className="p-4">
                        <div className="flex items-center gap-2 mb-1">
                          <Ruler size={14} className="text-[#5cc49a]" />
                          <p className="text-xs text-[#3d5a4a]">Spacing</p>
                        </div>
                        <p className="text-xl font-bold text-[#1a2e23]">{hg5Coverage.spacing.matchedToDs}/{hg5Coverage.spacing.totalUsed}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 h-1.5 bg-[#f0f2f1] rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-[#5cc49a]" style={{ width: `${hg5Coverage.spacing.coverage}%` }} />
                          </div>
                          <span className="text-xs font-medium text-[#3d5a4a]">{hg5Coverage.spacing.coverage.toFixed(0)}%</span>
                        </div>
                        {hg5Coverage.spacing.redundant.length > 0 && (
                          <p className="text-xs text-[#9e2b25] mt-1">{hg5Coverage.spacing.redundant.length} redundantes</p>
                        )}
                      </Card>
                      <Card className="p-4">
                        <div className="flex items-center gap-2 mb-1">
                          <Layers size={14} className="text-[#a67c00]" />
                          <p className="text-xs text-[#3d5a4a]">Z-index</p>
                        </div>
                        <p className="text-xl font-bold text-[#1a2e23]">{hg5Coverage.zIndex.matchedToDs}/{hg5Coverage.zIndex.totalUsed}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 h-1.5 bg-[#f0f2f1] rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-[#a67c00]" style={{ width: `${hg5Coverage.zIndex.coverage}%` }} />
                          </div>
                          <span className="text-xs font-medium text-[#3d5a4a]">{hg5Coverage.zIndex.coverage.toFixed(0)}%</span>
                        </div>
                        {hg5Coverage.zIndex.redundant.length > 0 && (
                          <p className="text-xs text-[#9e2b25] mt-1">{hg5Coverage.zIndex.redundant.length} redundantes</p>
                        )}
                      </Card>
                    </div>

                    {/* HG5 Redundant values detail */}
                    {(hg5Coverage.colors.redundant.length > 0 || hg5Coverage.fontSizes.redundant.length > 0 || hg5Coverage.spacing.redundant.length > 0) && (
                      <Card className="p-6 border-[#fef2f1]">
                        <div className="flex items-center gap-2 mb-1">
                          <AlertTriangle size={16} className="text-[#9e2b25]" />
                          <h3 className="text-sm font-semibold text-[#9e2b25]">
                            Valores redundantes — ya existen en HolyGrail5
                          </h3>
                        </div>
                        <p className="text-xs text-[#3d5a4a] mb-4">
                          Puedes eliminarlos de tu CSS y usar las clases/variables del framework.
                        </p>
                        <div className="space-y-4">
                          {hg5Coverage.colors.redundant.length > 0 && (
                            <div>
                              <h4 className="text-xs font-semibold text-[#1a2e23] mb-2">
                                Colores redundantes ({hg5Coverage.colors.redundant.length})
                              </h4>
                              <div className="flex flex-wrap gap-2">
                                {hg5Coverage.colors.redundant.sort((a,b) => b.count - a.count).map((item, i) => {
                                  const varName = hg5Tokens.varNames[item.value]
                                  return (
                                  <div key={i} className="flex items-center gap-1.5 bg-[#fef2f1] rounded-lg px-2.5 py-1.5">
                                    <div className="w-4 h-4 rounded border shrink-0" style={{ backgroundColor: item.value }} />
                                    <span className="text-xs font-mono">{item.value}</span>
                                    {varName && (
                                      <>
                                        <span className="text-[10px] text-[#3d5a4a]">→</span>
                                        <span className="text-[10px] font-mono text-[#006c48]">{varName}</span>
                                      </>
                                    )}
                                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{item.count}x</Badge>
                                  </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                          {hg5Coverage.fontSizes.redundant.length > 0 && (
                            <div>
                              <h4 className="text-xs font-semibold text-[#1a2e23] mb-2">
                                Font-sizes redundantes ({hg5Coverage.fontSizes.redundant.length})
                              </h4>
                              <div className="flex flex-wrap gap-2">
                                {hg5Coverage.fontSizes.redundant.sort((a,b) => b.count - a.count).map((item, i) => {
                                  const varName = hg5Tokens.varNames[item.value]
                                  return (
                                  <div key={i} className="flex items-center gap-1.5 bg-[#fef2f1] rounded-lg px-2.5 py-1.5">
                                    <span className="text-xs font-mono">{item.value}</span>
                                    {varName && (
                                      <>
                                        <span className="text-[10px] text-[#3d5a4a]">→</span>
                                        <span className="text-[10px] font-mono text-[#006c48]">{varName}</span>
                                      </>
                                    )}
                                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{item.count}x</Badge>
                                  </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                          {hg5Coverage.spacing.redundant.length > 0 && (
                            <div>
                              <h4 className="text-xs font-semibold text-[#1a2e23] mb-2">
                                Spacing redundante ({hg5Coverage.spacing.redundant.length})
                              </h4>
                              <div className="flex flex-wrap gap-2">
                                {hg5Coverage.spacing.redundant.sort((a,b) => b.count - a.count).map((item, i) => {
                                  const varName = hg5Tokens.varNames[item.value]
                                  return (
                                  <div key={i} className="flex items-center gap-1.5 bg-[#fef2f1] rounded-lg px-2.5 py-1.5">
                                    <span className="text-xs font-mono">{item.value}</span>
                                    {varName && (
                                      <>
                                        <span className="text-[10px] text-[#3d5a4a]">→</span>
                                        <span className="text-[10px] font-mono text-[#006c48]">{varName}</span>
                                      </>
                                    )}
                                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{item.count}x</Badge>
                                  </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </Card>
                    )}

                    {/* HG5 Mismatches - values NOT in framework */}
                    {hg5Coverage.colors.mismatches.length > 0 && (
                      <Card className="p-6">
                        <h3 className="text-sm font-semibold text-[#1a2e23] mb-1">
                          Colores fuera de HG5 ({hg5Coverage.colors.mismatches.length})
                        </h3>
                        <p className="text-xs text-[#3d5a4a] mb-3">
                          Estos colores no existen en HolyGrail5. Se sugiere el token HG5 mas cercano.
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {(showAllMismatches ? hg5Coverage.colors.mismatches : hg5Coverage.colors.mismatches.slice(0, 20)).map((m, i) => {
                            const varName = m.closestDsValue ? hg5Tokens.varNames[m.closestDsValue] : null
                            return (
                            <div key={i} className="flex items-center gap-1.5 bg-[#f8f9fa] rounded-lg px-2.5 py-1.5">
                              <div className="w-4 h-4 rounded border shrink-0" style={{ backgroundColor: m.value }} />
                              <span className="text-xs font-mono">{m.value}</span>
                              {m.closestDsValue && (
                                <>
                                  <span className="text-[10px] text-[#3d5a4a]">→</span>
                                  <div className="w-3 h-3 rounded border shrink-0" style={{ backgroundColor: m.closestDsValue }} />
                                  <span className="text-[10px] font-mono text-[#006c48]" title={m.closestDsValue}>
                                    {varName || m.closestDsValue}
                                  </span>
                                </>
                              )}
                            </div>
                            )
                          })}
                          {hg5Coverage.colors.mismatches.length > 20 && (
                            <button
                              onClick={() => setShowAllMismatches(!showAllMismatches)}
                              className="text-xs font-medium text-[#006c48] hover:text-[#004d33] self-center px-2 py-1 rounded hover:bg-[#e0f5ec] transition-colors cursor-pointer"
                            >
                              {showAllMismatches
                                ? 'Ver menos'
                                : `+${hg5Coverage.colors.mismatches.length - 20} mas`}
                            </button>
                          )}
                        </div>
                      </Card>
                    )}

                    {/* HG5 Tokens Summary */}
                    <Card className="p-4 bg-[#f8f9fa]">
                      <p className="text-xs text-[#3d5a4a]">
                        <strong>HolyGrail5</strong> contiene {hg5Tokens.colors.length} colores, {hg5Tokens.fontSizes.length} font-sizes, {hg5Tokens.spacing.length} espaciados y {hg5Tokens.zIndex.length} z-index definidos como tokens.
                      </p>
                    </Card>
                  </div>
                ) : null}
              </div>

              {/* ══════════════════════════════════════════════════════════════
                   SECTION 3 — Evolution Charts
                 ══════════════════════════════════════════════════════════════ */}
              <div>
                <SectionHeader title="Evolucion" tooltip="Graficos que muestran como han cambiado los KPIs de tu CSS a lo largo de los escaneos. Te ayuda a detectar tendencias y regresiones." />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Weight & Lines */}
                  <Card className="p-6">
                    <div className="flex items-center gap-1.5 mb-3">
                      <h3 className="text-sm font-semibold text-[#1a2e23]">Peso y Lineas</h3>
                      <InfoTooltip text="Evolucion del tamano del archivo (KB) y numero de lineas. Un CSS que crece sin control puede afectar el rendimiento." />
                    </div>
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={weightChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f1" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Legend />
                        <Line yAxisId="left" type="monotone" dataKey="peso" stroke="#012d1d" strokeWidth={2} name="Peso (KB)" />
                        <Line yAxisId="right" type="monotone" dataKey="lineas" stroke="#5cc49a" strokeWidth={2} name="Lineas" />
                      </LineChart>
                    </ResponsiveContainer>
                  </Card>

                  {/* Selectors & Declarations */}
                  <Card className="p-6">
                    <div className="flex items-center gap-1.5 mb-3">
                      <h3 className="text-sm font-semibold text-[#1a2e23]">Selectores y Declaraciones</h3>
                      <InfoTooltip text="Cantidad de reglas CSS (selectores) y propiedades escritas (declaraciones). La linea 'Unicas' muestra cuantas no se repiten." />
                    </div>
                    <ResponsiveContainer width="100%" height={250}>
                      <AreaChart data={selectorsChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f1" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Legend />
                        <Area type="monotone" dataKey="selectores" stroke="#012d1d" fill="rgba(1,45,29,0.1)" strokeWidth={2} name="Selectores" />
                        <Area type="monotone" dataKey="declaraciones" stroke="#006c48" fill="rgba(0,108,72,0.1)" strokeWidth={2} name="Declaraciones" />
                        <Area type="monotone" dataKey="unicas" stroke="#5cc49a" fill="rgba(92,196,154,0.1)" strokeWidth={2} name="Unicas" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </Card>

                  {/* !important & IDs */}
                  <Card className="p-6">
                    <div className="flex items-center gap-1.5 mb-3">
                      <h3 className="text-sm font-semibold text-[#1a2e23]">!important e IDs</h3>
                      <InfoTooltip text="Indicadores de problemas de especificidad. Menos !important e IDs = CSS mas facil de mantener y predecible." />
                    </div>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={issuesChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f1" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="!important" fill="#9e2b25" radius={[4, 4, 0, 0]} name="!important" />
                        <Bar dataKey="IDs" fill="#a67c00" radius={[4, 4, 0, 0]} name="IDs" />
                      </BarChart>
                    </ResponsiveContainer>
                  </Card>

                  {/* Reuse Ratio */}
                  <Card className="p-6">
                    <div className="flex items-center gap-1.5 mb-3">
                      <h3 className="text-sm font-semibold text-[#1a2e23]">Ratio de Reutilizacion</h3>
                      <InfoTooltip text="Porcentaje de declaraciones que se repiten. Un ratio alto significa CSS eficiente con estilos compartidos entre componentes." />
                    </div>
                    <ResponsiveContainer width="100%" height={250}>
                      <AreaChart data={reuseChartData}>
                        <defs>
                          <linearGradient id="reuseGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#2a9d6e" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#2a9d6e" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f1" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                        <Tooltip formatter={(v) => `${v}%`} />
                        <Area type="monotone" dataKey="ratio" stroke="#2a9d6e" strokeWidth={2} fill="url(#reuseGrad)" name="Reutilizacion" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </Card>

                  {/* Composition Bar */}
                  <Card className="p-6">
                    <div className="flex items-center gap-1.5 mb-3">
                      <h3 className="text-sm font-semibold text-[#1a2e23]">Composicion del CSS</h3>
                      <InfoTooltip text="Distribucion de los tipos de selectores y propiedades en tu CSS. Idealmente, las clases dominan y los IDs/!important son minimos." />
                    </div>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={compositionChartData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f1" />
                        <XAxis type="number" tick={{ fontSize: 11 }} />
                        <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={80} />
                        <Tooltip />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]} name="Cantidad">
                          {compositionChartData.map((entry, index) => (
                            <rect key={index} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </Card>
                </div>
              </div>

              {/* ══════════════════════════════════════════════════════════════
                   SECTION 4 — Scans History Table
                 ══════════════════════════════════════════════════════════════ */}
              <div>
                <SectionHeader title="Historial de escaneos" tooltip="Tabla con todos los escaneos guardados de este proyecto. Haz clic en el icono de ojo para ver el detalle completo de cada analisis." />
                <Card className="p-0 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-[#f8f9fa]">
                          <th className="text-left py-3 px-4 font-semibold text-[#1a2e23]">Etiqueta</th>
                          <th className="text-left py-3 px-4 font-semibold text-[#1a2e23]">Fecha</th>
                          <th className="text-center py-3 px-4 font-semibold text-[#1a2e23]">Score</th>
                          <th className="text-right py-3 px-4 font-semibold text-[#1a2e23]">Peso</th>
                          <th className="text-right py-3 px-4 font-semibold text-[#1a2e23]">Lineas</th>
                          <th className="text-right py-3 px-4 font-semibold text-[#1a2e23]">Clases</th>
                          <th className="text-right py-3 px-4 font-semibold text-[#1a2e23]">IDs</th>
                          <th className="text-right py-3 px-4 font-semibold text-[#1a2e23]">!imp</th>
                          <th className="text-right py-3 px-4 font-semibold text-[#1a2e23]">Vars</th>
                          <th className="text-right py-3 px-4 font-semibold text-[#1a2e23]">Select.</th>
                          <th className="text-right py-3 px-4 font-semibold text-[#1a2e23]">Decl.</th>
                          <th className="text-right py-3 px-4 font-semibold text-[#1a2e23]">Unicas</th>
                          <th className="text-right py-3 px-4 font-semibold text-[#1a2e23]">Reuso</th>
                          <th className="text-center py-3 px-4 font-semibold text-[#1a2e23]">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {scans.map((scan) => (
                          <tr key={scan.id} className="border-t border-[#f0f2f1] hover:bg-[#f8f9fa] transition-colors">
                            <td className="py-3 px-4 font-medium text-[#1a2e23]">{scan.label}</td>
                            <td className="py-3 px-4 text-[#3d5a4a]">
                              {new Date(scan.created_at).toLocaleDateString('es-ES', {
                                day: '2-digit',
                                month: 'short',
                                year: '2-digit',
                              })}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <Badge className={getHealthScoreBadgeColor(scan.health_score)}>
                                {scan.health_score}
                              </Badge>
                            </td>
                            <td className="py-3 px-4 text-right text-[#1a2e23]">
                              {(scan.file_size / 1024).toFixed(1)} KB
                            </td>
                            <td className="py-3 px-4 text-right text-[#1a2e23]">{scan.line_count.toLocaleString()}</td>
                            <td className="py-3 px-4 text-right text-[#1a2e23]">{scan.class_count.toLocaleString()}</td>
                            <td className="py-3 px-4 text-right text-[#1a2e23]">{scan.id_count.toLocaleString()}</td>
                            <td className="py-3 px-4 text-right text-[#1a2e23]">{scan.important_count.toLocaleString()}</td>
                            <td className="py-3 px-4 text-right text-[#1a2e23]">{scan.variable_count.toLocaleString()}</td>
                            <td className="py-3 px-4 text-right text-[#1a2e23]">{scan.total_selectors.toLocaleString()}</td>
                            <td className="py-3 px-4 text-right text-[#1a2e23]">{scan.total_declarations.toLocaleString()}</td>
                            <td className="py-3 px-4 text-right text-[#1a2e23]">{scan.unique_declarations.toLocaleString()}</td>
                            <td className="py-3 px-4 text-right text-[#1a2e23]">
                              {(scan.reuse_ratio * 100).toFixed(0)}%
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex gap-2 justify-center">
                                <button
                                  onClick={() => setSelectedScanId(scan.id)}
                                  className="p-1.5 rounded-lg text-[#006c48] hover:bg-[#e0f5ec] transition-colors"
                                  title="Ver detalle"
                                >
                                  <Eye size={16} />
                                </button>
                                <button
                                  onClick={() => handleDeleteScan(scan.id)}
                                  className="p-1.5 rounded-lg text-[#9e2b25] hover:bg-[#fef2f1] transition-colors"
                                  title="Eliminar"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            </>
          ) : (
            <Card className="p-12 text-center">
              <p className="text-[#3d5a4a]">
                No hay escaneos en este proyecto aun. Realiza un analisis en la seccion "Analizar" para comenzar.
              </p>
            </Card>
          )
        ) : (
          <div className="flex items-center justify-center py-24">
            <p className="text-[#3d5a4a] text-lg">Crea un proyecto para comenzar</p>
          </div>
        )}
      </div>

      {selectedScanId && <ScanDetailModal scanId={selectedScanId} onClose={() => setSelectedScanId(null)} />}
    </div>
  )
}
