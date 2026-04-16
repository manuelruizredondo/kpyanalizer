import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import {
  createProject,
  getProjectScans,
  getLatestScanDetail,
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
} from 'lucide-react'

const HG5_URL = 'https://hg5.netlify.app/output.css'
const CORS_PROXY = 'https://lqgdrkwabcjrnnthlrmi.supabase.co/functions/v1/cors-proxy'

// ─── Metric Card ───────────────────────────────────────────────────
function MetricCard({
  icon: Icon,
  label,
  value,
  unit,
  color = '#006c48',
  delta,
  invertDelta = false,
}: {
  icon: React.ElementType
  label: string
  value: string | number
  unit?: string
  color?: string
  delta?: number | null
  invertDelta?: boolean // true = lower is better (e.g. !important count)
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
        <p className="text-xs text-[#3d5a4a] truncate">{label}</p>
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

// ─── Main Component ─────────────────────────────────────────────────
export function DashboardPage() {
  const { profile } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [scans, setScans] = useState<Scan[]>([])
  const [latestDetail, setLatestDetail] = useState<ScanDetail | null>(null)
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
  const hg5FetchedRef = useRef(false)

  // ── Load projects ──
  useEffect(() => {
    loadProjects()
  }, [])

  const loadProjects = async () => {
    try {
      setLoading(true)
      setError(null)

      // First check auth is valid with a short timeout
      console.log('[Dashboard] Checking auth...')
      const authTimeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('auth_timeout')), 6000)
      )
      try {
        const { data: { user: u }, error: authErr } = await Promise.race([
          supabase.auth.getUser(),
          authTimeout,
        ])
        console.log('[Dashboard] Auth result:', u?.email, authErr?.message)
        if (authErr || !u) {
          setError('Tu sesión ha expirado. Vuelve a iniciar sesión.')
          setLoading(false)
          return
        }
      } catch (authE) {
        console.error('[Dashboard] Auth check failed:', authE)
        if (authE instanceof Error && authE.message === 'auth_timeout') {
          setError('La verificación de sesión tardó demasiado. Recarga la página o vuelve a iniciar sesión.')
        } else {
          setError('Error al verificar la sesión.')
        }
        setLoading(false)
        return
      }

      // Now fetch projects - try SDK first, fallback to REST
      const queryTimeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('query_timeout')), 8000)
      )

      let projectsList: Project[]
      try {
        console.log('[Dashboard] Fetching projects via SDK...')
        const { data, error: queryErr } = await Promise.race([
          supabase.from('projects').select('*').order('created_at', { ascending: false }),
          queryTimeout,
        ])
        console.log('[Dashboard] SDK result:', data?.length, 'projects, error:', queryErr?.message)
        if (queryErr) throw queryErr
        projectsList = (data || []) as Project[]
      } catch (sdkErr) {
        // SDK timed out or failed - try direct REST as fallback
        console.warn('[Dashboard] SDK query failed, trying REST fallback:', sdkErr)
        const session = (await supabase.auth.getSession()).data.session
        const restResp = await Promise.race([
          fetch('https://lqgdrkwabcjrnnthlrmi.supabase.co/rest/v1/projects?select=*&order=created_at.desc', {
            headers: {
              'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxxZ2Rya3dhYmNqcm5udGhscm1pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzMzIzMTQsImV4cCI6MjA5MTkwODMxNH0.0qhUexm2vPc-wDnX-G7w5Gg82Y2_Jow_v-9kWqL29AQ',
              'Authorization': `Bearer ${session?.access_token}`,
              'Content-Type': 'application/json',
            }
          }),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('La conexión tardó demasiado. Verifica tu conexión a internet.')), 8000))
        ])
        if (!restResp.ok) throw new Error(`REST error: ${restResp.status}`)
        projectsList = await restResp.json()
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

  const loadScans = async (projectId: string) => {
    try {
      setScansLoading(true)

      // Fetch scans with timeout
      let scansList: Scan[]
      try {
        const t = new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000))
        scansList = await Promise.race([getProjectScans(projectId), t])
      } catch {
        // REST fallback
        const session = (await supabase.auth.getSession()).data.session
        const r = await fetch(
          `https://lqgdrkwabcjrnnthlrmi.supabase.co/rest/v1/scans?select=*&project_id=eq.${projectId}&order=created_at.desc`,
          {
            headers: {
              'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxxZ2Rya3dhYmNqcm5udGhscm1pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzMzIzMTQsImV4cCI6MjA5MTkwODMxNH0.0qhUexm2vPc-wDnX-G7w5Gg82Y2_Jow_v-9kWqL29AQ',
              'Authorization': `Bearer ${session?.access_token}`,
              'Content-Type': 'application/json',
            }
          }
        )
        scansList = r.ok ? await r.json() : []
      }

      setScans(scansList)
      if (scansList.length > 0) {
        try {
          const t2 = new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000))
          const detail = await Promise.race([getLatestScanDetail(projectId), t2])
          setLatestDetail(detail)
        } catch {
          setLatestDetail(null)
        }
      } else {
        setLatestDetail(null)
      }
    } catch (err) {
      console.error('Error loading scans:', err)
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

        <div className="space-y-2">
          {projects.map((project) => (
            <div
              key={project.id}
              className={`p-3 rounded-lg cursor-pointer transition-colors ${
                selectedProjectId === project.id ? 'bg-[#e0f5ec]' : 'hover:bg-[#f8f9fa]'
              }`}
            >
              <button onClick={() => setSelectedProjectId(project.id)} className="w-full text-left">
                <h3 className="font-medium text-[#1a2e23] text-sm">{project.name}</h3>
                {project.description && (
                  <p className="text-xs text-[#3d5a4a] mt-0.5 truncate">{project.description}</p>
                )}
              </button>
              {profile?.role === 'super_admin' && (
                <button
                  onClick={() => handleDeleteProject(project.id)}
                  className="mt-2 w-full text-xs text-[#9e2b25] hover:text-[#7a1e1a] py-1"
                >
                  Eliminar proyecto
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
                    <h2 className="text-lg font-semibold text-[#1a2e23]">CSS Health Score</h2>
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
                <h2 className="text-lg font-semibold text-[#1a2e23] mb-4">Metricas del ultimo escaneo</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  <MetricCard icon={FileText} label="Peso" value={(latestScan.file_size / 1024).toFixed(1)} unit="KB" delta={previousScan ? +((latestScan.file_size - previousScan.file_size) / 1024).toFixed(1) : null} invertDelta />
                  <MetricCard icon={Ruler} label="Lineas" value={latestScan.line_count.toLocaleString()} color="#2a9d6e" delta={getDelta(latestScan.line_count, previousScan?.line_count)} invertDelta />
                  <MetricCard icon={Hash} label="Clases" value={latestScan.class_count.toLocaleString()} color="#006c48" delta={getDelta(latestScan.class_count, previousScan?.class_count)} />
                  <MetricCard icon={AtSign} label="IDs" value={latestScan.id_count.toLocaleString()} color="#a67c00" delta={getDelta(latestScan.id_count, previousScan?.id_count)} invertDelta />
                  <MetricCard icon={AlertTriangle} label="!important" value={latestScan.important_count.toLocaleString()} color="#9e2b25" delta={getDelta(latestScan.important_count, previousScan?.important_count)} invertDelta />
                  <MetricCard icon={Variable} label="Variables CSS" value={latestScan.variable_count.toLocaleString()} color="#2a9d6e" delta={getDelta(latestScan.variable_count, previousScan?.variable_count)} />
                  <MetricCard icon={Layers} label="Selectores" value={latestScan.total_selectors.toLocaleString()} delta={getDelta(latestScan.total_selectors, previousScan?.total_selectors)} invertDelta />
                  <MetricCard icon={FileCode} label="Declaraciones" value={latestScan.total_declarations.toLocaleString()} delta={getDelta(latestScan.total_declarations, previousScan?.total_declarations)} invertDelta />
                  <MetricCard icon={Copy} label="Unicas" value={latestScan.unique_declarations.toLocaleString()} color="#5cc49a" delta={getDelta(latestScan.unique_declarations, previousScan?.unique_declarations)} invertDelta />
                  <MetricCard icon={Recycle} label="Ratio reutilizacion" value={(latestScan.reuse_ratio * 100).toFixed(1)} unit="%" color={latestScan.reuse_ratio >= 0.5 ? '#006c48' : '#9e2b25'} delta={previousScan ? +((latestScan.reuse_ratio - previousScan.reuse_ratio) * 100).toFixed(1) : null} />
                </div>
              </div>

              {/* ══════════════════════════════════════════════════════════════
                   SECTION 2 — W3C Validation + Design System Coverage
                 ══════════════════════════════════════════════════════════════ */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* W3C Validation */}
                <Card className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <ShieldCheck size={20} className="text-[#006c48]" />
                    <h3 className="text-lg font-semibold text-[#1a2e23]">Validacion W3C</h3>
                  </div>
                  {latestDetail?.w3c_validation ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-6">
                        <div className="text-center">
                          <p className="text-3xl font-bold text-[#9e2b25]">
                            {latestDetail.w3c_validation.errorCount}
                          </p>
                          <p className="text-xs text-[#3d5a4a]">Errores</p>
                        </div>
                        <div className="text-center">
                          <p className="text-3xl font-bold text-[#a67c00]">
                            {latestDetail.w3c_validation.warningCount}
                          </p>
                          <p className="text-xs text-[#3d5a4a]">Warnings</p>
                        </div>
                        <div className="ml-auto">
                          <Badge
                            className={
                              latestDetail.w3c_validation.valid
                                ? 'bg-[#e0f5ec] text-[#006c48]'
                                : 'bg-[#fef2f1] text-[#9e2b25]'
                            }
                          >
                            {latestDetail.w3c_validation.valid ? 'Valido' : 'Con errores'}
                          </Badge>
                        </div>
                      </div>
                      {latestDetail.w3c_validation.errors.length > 0 && (
                        <div className="mt-3 max-h-40 overflow-y-auto space-y-1">
                          {latestDetail.w3c_validation.errors.slice(0, 5).map((err, i) => (
                            <p key={i} className="text-xs text-[#9e2b25] bg-[#fef2f1] rounded px-2 py-1">
                              {err}
                            </p>
                          ))}
                          {latestDetail.w3c_validation.errors.length > 5 && (
                            <p className="text-xs text-[#3d5a4a]">
                              +{latestDetail.w3c_validation.errors.length - 5} errores mas...
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-[#3d5a4a]">
                      No hay datos de validacion W3C. Ejecuta la validacion desde la seccion Analizar.
                    </p>
                  )}
                </Card>

                {/* Design System Coverage */}
                <Card className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Palette size={20} className="text-[#006c48]" />
                    <h3 className="text-lg font-semibold text-[#1a2e23]">Cobertura Design System</h3>
                  </div>
                  {latestDetail?.ds_coverage ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-4">
                        <ScoreRing score={Math.round(latestDetail.ds_coverage.overallCoverage)} size={100} />
                        <div className="flex-1 space-y-3">
                          <CoverageBar label="Colores" value={latestDetail.ds_coverage.colors} color="#006c48" />
                          <CoverageBar label="Tipografia" value={latestDetail.ds_coverage.fontSizes} color="#2a9d6e" />
                          <CoverageBar label="Spacing" value={latestDetail.ds_coverage.spacing} color="#5cc49a" />
                          <CoverageBar label="Z-index" value={latestDetail.ds_coverage.zIndex} color="#a67c00" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-[#3d5a4a]">
                      No hay datos de cobertura. Carga tus tokens de Design System desde la seccion Analizar.
                    </p>
                  )}
                </Card>
              </div>

              {/* ══════════════════════════════════════════════════════════════
                   SECTION 2b — HolyGrail5 Live Comparison
                 ══════════════════════════════════════════════════════════════ */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-[#1a2e23]">Comparativa con HolyGrail5</h2>
                    <p className="text-sm text-[#3d5a4a]">Cruce en tiempo real de tu CSS con el framework HG5</p>
                  </div>
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
                </div>

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
                                {hg5Coverage.colors.redundant.sort((a,b) => b.count - a.count).map((item, i) => (
                                  <div key={i} className="flex items-center gap-1.5 bg-[#fef2f1] rounded-lg px-2.5 py-1.5">
                                    <div className="w-4 h-4 rounded border shrink-0" style={{ backgroundColor: item.value }} />
                                    <span className="text-xs font-mono">{item.value}</span>
                                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{item.count}x</Badge>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {hg5Coverage.fontSizes.redundant.length > 0 && (
                            <div>
                              <h4 className="text-xs font-semibold text-[#1a2e23] mb-2">
                                Font-sizes redundantes ({hg5Coverage.fontSizes.redundant.length})
                              </h4>
                              <div className="flex flex-wrap gap-2">
                                {hg5Coverage.fontSizes.redundant.sort((a,b) => b.count - a.count).map((item, i) => (
                                  <div key={i} className="bg-[#fef2f1] rounded-lg px-2.5 py-1.5">
                                    <span className="text-xs font-mono">{item.value}</span>
                                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-1.5">{item.count}x</Badge>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {hg5Coverage.spacing.redundant.length > 0 && (
                            <div>
                              <h4 className="text-xs font-semibold text-[#1a2e23] mb-2">
                                Spacing redundante ({hg5Coverage.spacing.redundant.length})
                              </h4>
                              <div className="flex flex-wrap gap-2">
                                {hg5Coverage.spacing.redundant.sort((a,b) => b.count - a.count).map((item, i) => (
                                  <div key={i} className="bg-[#fef2f1] rounded-lg px-2.5 py-1.5">
                                    <span className="text-xs font-mono">{item.value}</span>
                                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-1.5">{item.count}x</Badge>
                                  </div>
                                ))}
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
                          {hg5Coverage.colors.mismatches.slice(0, 20).map((m, i) => (
                            <div key={i} className="flex items-center gap-1.5 bg-[#f8f9fa] rounded-lg px-2.5 py-1.5">
                              <div className="w-4 h-4 rounded border shrink-0" style={{ backgroundColor: m.value }} />
                              <span className="text-xs font-mono">{m.value}</span>
                              {m.closestDsValue && (
                                <>
                                  <span className="text-[10px] text-[#3d5a4a]">→</span>
                                  <div className="w-3 h-3 rounded border shrink-0" style={{ backgroundColor: m.closestDsValue }} />
                                  <span className="text-[10px] font-mono text-[#006c48]">{m.closestDsValue}</span>
                                </>
                              )}
                            </div>
                          ))}
                          {hg5Coverage.colors.mismatches.length > 20 && (
                            <span className="text-xs text-[#3d5a4a] self-center">
                              +{hg5Coverage.colors.mismatches.length - 20} mas
                            </span>
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
                <h2 className="text-lg font-semibold text-[#1a2e23] mb-4">Evolucion</h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Weight & Lines */}
                  <Card className="p-6">
                    <h3 className="text-sm font-semibold text-[#1a2e23] mb-3">Peso y Lineas</h3>
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
                    <h3 className="text-sm font-semibold text-[#1a2e23] mb-3">Selectores y Declaraciones</h3>
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
                    <h3 className="text-sm font-semibold text-[#1a2e23] mb-3">!important e IDs</h3>
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
                    <h3 className="text-sm font-semibold text-[#1a2e23] mb-3">Ratio de Reutilizacion</h3>
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
                    <h3 className="text-sm font-semibold text-[#1a2e23] mb-3">Composicion del CSS</h3>
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
                <h2 className="text-lg font-semibold text-[#1a2e23] mb-4">Historial de escaneos</h2>
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
