import { useCallback, useState, useEffect, useMemo, useRef } from 'react'
import { saveScan, getProjects, getProjectScans, getScanMetrics } from '@/lib/scan-storage'
import type { Project, Scan, ScanMetricsRow } from '@/lib/scan-storage'
import type { AngularHistoryPoint, KpiHistoryPoint } from '@/components/overview/OverviewTab'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CssInput } from '@/components/input/CssInput'
import { OverviewTab } from '@/components/overview/OverviewTab'
import { HardcodedTab } from '@/components/hardcoded/HardcodedTab'
import { DuplicatesTab } from '@/components/duplicates/DuplicatesTab'
import { SpecificityTab } from '@/components/specificity/SpecificityTab'
import { W3cTab } from '@/components/w3c/W3cTab'
import { DesignSystemTab } from '@/components/designsystem/DesignSystemTab'
import { TypographyTab } from '@/components/typography/TypographyTab'
import { useAnalysis } from '@/hooks/useAnalysis'
import { useW3cValidation } from '@/hooks/useW3cValidation'
import type { ValidationMode } from '@/hooks/useW3cValidation'
import { useDesignSystem } from '@/hooks/useDesignSystem'
import {
  LayoutDashboard,
  Palette,
  Copy,
  BarChart3,
  Globe,
  Component,
  Code,
  Save,
  Type,
} from 'lucide-react'

const TABS = [
  { value: 'overview', icon: LayoutDashboard, label: 'Resumen' },
  { value: 'hardcoded', icon: Palette, label: 'Hardcodeados' },
  { value: 'duplicates', icon: Copy, label: 'Duplicados' },
  { value: 'specificity', icon: BarChart3, label: 'Especificidad' },
  { value: 'typography', icon: Type, label: 'Tipografía' },
  { value: 'w3c', icon: Globe, label: 'W3C' },
  { value: 'ds', icon: Component, label: 'Design System' },
]

const shortDate = (d: Date) => d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })

/**
 * Etiquetas de eje únicas: si dos escaneos caen el mismo día se añade la hora,
 * para que no compartan tick ni tooltip.
 */
function historyLabels(scans: Scan[]): string[] {
  const days = scans.map(s => shortDate(new Date(s.created_at)))
  return scans.map((s, i) => {
    const repeated = days.indexOf(days[i]) !== i || days.lastIndexOf(days[i]) !== i
    if (!repeated) return days[i]
    const time = new Date(s.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    return `${days[i]} ${time}`
  })
}

type SavingState = { state: 'idle' | 'loading' | 'success' | 'error'; message: string }

export default function AnalyzePage() {
  const { css, result, error: analysisError, isAnalyzing, analyze } = useAnalysis()
  const w3c = useW3cValidation()
  const ds = useDesignSystem()
  const { validateLocalDebounced, reset: resetW3c, validate: validateW3c } = w3c
  const { compare: compareDs, tokens: dsTokens, loadTokens, loadFromUrl } = ds
  const [showSaveForm, setShowSaveForm] = useState(false)
  const [projects, setProjects] = useState<Project[]>([])
  const [projectsError, setProjectsError] = useState<string | null>(null)
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [autoLabel, setAutoLabel] = useState('')
  const [savingStatus, setSavingStatus] = useState<SavingState>({ state: 'idle', message: '' })
  const [angularHistory, setAngularHistory] = useState<AngularHistoryPoint[] | undefined>(undefined)
  const [kpiHistory, setKpiHistory] = useState<KpiHistoryPoint[] | undefined>(undefined)
  // Se incrementa tras guardar para recargar historial y etiqueta.
  const [historyVersion, setHistoryVersion] = useState(0)
  const closeFormTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => () => clearTimeout(closeFormTimerRef.current), [])

  // Load projects on mount so the trend chart can show history without opening the save form
  useEffect(() => {
    let cancelled = false
    getProjects()
      .then((list) => {
        if (cancelled) return
        setProjects(list)
        // Default-select the most recent project so the Angular trend chart populates immediately
        setSelectedProjectId((prev) => prev || (list[0]?.id ?? ''))
      })
      .catch((err) => {
        console.error(err)
        if (!cancelled) setProjectsError('No se pudieron cargar los proyectos.')
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Auto-generate label when project is selected + load Angular & KPI history for trend charts
  useEffect(() => {
    if (!selectedProjectId) {
      setAutoLabel('')
      setAngularHistory(undefined)
      setKpiHistory(undefined)
      return
    }
    const controller = new AbortController()
    const load = async () => {
      const scans = await getProjectScans(selectedProjectId)
      if (controller.signal.aborted) return
      const dateStr = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
      setAutoLabel(`Escaneo #${scans.length + 1} — ${dateStr}`)

      // Las tendencias solo necesitan contadores: se leen de la vista ligera
      // `scan_metrics` (KB) en vez de descargar el analysis_data completo (MB)
      // de cada escaneo. Los escaneos sin métricas se omiten en lugar de
      // pintarse como ceros, que parecerían una mejora real.
      const ordered = [...scans].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      )
      const rows = await getScanMetrics(ordered.map(s => s.id), controller.signal)
      if (controller.signal.aborted) return
      const byScan = new Map<string, ScanMetricsRow>(rows.map(m => [m.scan_id, m]))
      const withMetrics = ordered.filter(s => byScan.has(s.id))
      const labels = historyLabels(withMetrics)

      setAngularHistory(withMetrics.map((s, i) => {
        const m = byScan.get(s.id)!
        return {
          date: labels[i],
          total: m.angular_count,
          host: m.ang_host,
          hostContext: m.ang_host_context,
          ngDeep: m.ang_ng_deep,
          deepCombinator: m.ang_deep_combinator,
        }
      }))
      setKpiHistory(withMetrics.map((s, i) => {
        const m = byScan.get(s.id)!
        return {
          date: labels[i],
          ids: m.id_count,
          vendor: m.vendor_prefix_count,
          universal: m.universal_count,
          pseudoElements: m.pseudo_elements,
          pseudoClasses: m.pseudo_classes,
          host: m.ang_host,
          ngDeep: m.ang_ng_deep,
          mediaQueries: m.media_queries,
          keyframes: m.keyframes_count,
          important: m.important_count,
          duplicateSelectors: m.dup_selectors,
        }
      }))
    }
    load().catch((err) => {
      if (controller.signal.aborted) return
      console.error('[Analyze] Error loading history:', err)
      const dateStr = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
      setAutoLabel(`Escaneo — ${dateStr}`)
      setAngularHistory(undefined)
      setKpiHistory(undefined)
    })
    return () => controller.abort()
  }, [selectedProjectId, historyVersion])

  // La cobertura DS depende del CSS Y de los tokens: se recalcula cuando
  // cambia cualquiera de los dos (antes solo al cargar tokens o abrir la
  // pestaña, y se guardaba la cobertura del CSS anterior).
  useEffect(() => {
    if (result && dsTokens) compareDs(result, dsTokens)
  }, [result, dsTokens, compareDs])

  // Append the current (unsaved) scan as the latest projected point
  const angularHistoryWithCurrent: AngularHistoryPoint[] | undefined = useMemo(() => {
    if (!angularHistory || !result) return angularHistory
    const current: AngularHistoryPoint = {
      date: `${shortDate(new Date())} (actual)`,
      total: result.angularEncapsulationCount,
      host: result.angularEncapsulationBreakdown.host,
      hostContext: result.angularEncapsulationBreakdown.hostContext,
      ngDeep: result.angularEncapsulationBreakdown.ngDeep,
      deepCombinator: result.angularEncapsulationBreakdown.deepCombinator,
      isCurrent: true,
    }
    return [...angularHistory, current]
  }, [angularHistory, result])

  const kpiHistoryWithCurrent: KpiHistoryPoint[] | undefined = useMemo(() => {
    if (!kpiHistory || !result) return kpiHistory
    const current: KpiHistoryPoint = {
      date: `${shortDate(new Date())} (actual)`,
      ids: result.idCount,
      vendor: result.vendorPrefixCount,
      universal: result.universalSelectorCount,
      pseudoElements: result.pseudoElementCount,
      pseudoClasses: result.pseudoClassCount,
      host: result.angularEncapsulationBreakdown.host,
      ngDeep: result.angularEncapsulationBreakdown.ngDeep,
      mediaQueries: result.mediaQueries.length,
      keyframes: result.keyframes.length,
      important: result.importantCount,
      duplicateSelectors: result.duplicateSelectors.length,
      isCurrent: true,
    }
    return [...kpiHistory, current]
  }, [kpiHistory, result])

  const handleCssChange = useCallback(
    (newCss: string) => {
      analyze(newCss)
      // Validación local automática, con debounce (parse + lexer completos).
      if (newCss.trim()) {
        validateLocalDebounced(newCss)
      } else {
        resetW3c()
      }
    },
    [analyze, validateLocalDebounced, resetW3c]
  )

  const handleW3cValidate = useCallback((mode?: ValidationMode) => {
    if (css) validateW3c(css, mode)
  }, [css, validateW3c])

  const resetSaveForm = () => {
    clearTimeout(closeFormTimerRef.current)
    setShowSaveForm(false)
    setSavingStatus({ state: 'idle', message: '' })
  }

  const handleSaveScan = async () => {
    if (!selectedProjectId || !autoLabel || !result) {
      setSavingStatus({
        state: 'error',
        message: 'Selecciona un proyecto para guardar',
      })
      return
    }

    try {
      setSavingStatus({ state: 'loading', message: 'Guardando escaneo...' })

      await saveScan(
        selectedProjectId,
        autoLabel,
        result,
        w3c.result ? {
          valid: w3c.result.valid ?? true,
          errorCount: w3c.result.errorCount ?? 0,
          warningCount: w3c.result.warningCount ?? 0,
          errors: (w3c.result.errors ?? []).map(e => e.message || ''),
          warnings: (w3c.result.warnings ?? []).map(w => w.message || ''),
        } : undefined,
        ds.coverage ? {
          colors: ds.coverage.colors?.coverage ?? 0,
          fontSizes: ds.coverage.fontSizes?.coverage ?? 0,
          spacing: ds.coverage.spacing?.coverage ?? 0,
          zIndex: ds.coverage.zIndex?.coverage ?? 0,
          overallCoverage: ds.coverage.overallCoverage ?? 0,
        } : undefined
      )

      setSavingStatus({
        state: 'success',
        message: 'Escaneo guardado correctamente',
      })
      // Se conserva el proyecto seleccionado (antes se vaciaba y desaparecían
      // las gráficas de tendencia) y se recarga el historial con el nuevo punto.
      setHistoryVersion(v => v + 1)
      clearTimeout(closeFormTimerRef.current)
      closeFormTimerRef.current = setTimeout(resetSaveForm, 2000)
    } catch (error) {
      setSavingStatus({
        state: 'error',
        message: error instanceof Error && error.message
          ? `Error al guardar el escaneo: ${error.message}`
          : 'Error al guardar el escaneo',
      })
      console.error('Error saving scan:', error)
    }
  }

  return (
    <div className="space-y-6 py-8 px-8 max-w-[1440px] mx-auto w-full">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[#1a2e23]">Analizar CSS</h2>
          <p className="text-sm text-[#52695b] mt-1">
            Pega o arrastra tu CSS compilado para obtener métricas de calidad
          </p>
        </div>
        {result && (
          <Button
            onClick={() => (showSaveForm ? resetSaveForm() : setShowSaveForm(true))}
            size="sm"
            className="gap-2 h-9"
            style={{ background: '#012d1d' }}
            aria-expanded={showSaveForm}
          >
            <Save size={16} aria-hidden="true" />
            Guardar escaneo
          </Button>
        )}
      </div>

      <CssInput value={css} onChange={handleCssChange} isAnalyzing={isAnalyzing} />

      {analysisError && (
        <div className="rounded-lg p-3" role="alert" style={{ background: '#fbe8e6', border: '1px solid rgba(158, 43, 37, 0.2)' }}>
          <p className="text-sm text-[#9e2b25]">{analysisError}</p>
        </div>
      )}

      {showSaveForm && result && (
        <Card className="p-6" style={{ background: '#e5f2ec', border: '1px solid rgba(0, 108, 72, 0.15)' }}>
          <h3 className="text-base font-semibold text-[#1a2e23] mb-4">
            Guardar Escaneo
          </h3>
          <div className="space-y-4">
            <div>
              <label htmlFor="save-scan-project" className="block text-sm font-medium text-[#1a2e23] mb-1">
                Proyecto
              </label>
              <select
                id="save-scan-project"
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#006c48] bg-white text-[#0b1f16]"
                style={{ border: '1px solid rgba(11, 31, 22, 0.14)' }}
              >
                <option value="">Selecciona un proyecto</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              {projectsError && (
                <p className="text-xs text-[#9e2b25] mt-1" role="alert">{projectsError}</p>
              )}
            </div>

            {autoLabel && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(11, 31, 22, 0.08)' }}>
                <span className="text-xs text-[#52695b]">Etiqueta:</span>
                <span className="text-sm font-medium text-[#1a2e23]">{autoLabel}</span>
              </div>
            )}

            {savingStatus.message && (
              <div
                className="text-sm p-2 rounded-lg"
                role={savingStatus.state === 'error' ? 'alert' : 'status'}
                style={{
                  background: savingStatus.state === 'error' ? '#fbe8e6' : savingStatus.state === 'success' ? '#e5f2ec' : '#f0f2f1',
                  color: savingStatus.state === 'error' ? '#9e2b25' : savingStatus.state === 'success' ? '#006c48' : '#1a2e23',
                }}
              >
                {savingStatus.message}
              </div>
            )}

            <div className="flex gap-3">
              <Button
                onClick={handleSaveScan}
                disabled={
                  // 'success' también bloquea: evita guardar un duplicado con la
                  // misma etiqueta durante los 2s antes de cerrar el formulario.
                  savingStatus.state === 'loading' ||
                  savingStatus.state === 'success' ||
                  !selectedProjectId ||
                  !autoLabel
                }
                className="flex-1"
                style={{ background: '#012d1d' }}
              >
                {savingStatus.state === 'loading' ? 'Guardando...' : 'Guardar'}
              </Button>
              <Button
                onClick={resetSaveForm}
                variant="outline"
                className="flex-1"
              >
                Cancelar
              </Button>
            </div>
          </div>
        </Card>
      )}

      {result && (
        <Tabs defaultValue="overview">
          <div className="overflow-x-auto pb-px" style={{ borderBottom: '1px solid rgba(11, 31, 22, 0.08)' }}>
            {/* Un único tablist: con uno por pestaña, las flechas no navegaban
                y los lectores de pantalla anunciaban "pestaña 1 de 1". */}
            <TabsList className="bg-transparent p-0 h-auto flex justify-start items-center gap-1 rounded-none">
              {TABS.map(({ value, icon: Icon, label }) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className="group relative px-3 py-3 text-[12px] font-medium transition-colors bg-transparent rounded-none shadow-none data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-[#0b1f16] text-[#52695b] gap-1.5"
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  {label}
                  {/* Subrayado de la pestaña activa (antes dependía de una
                      variable CSS que nunca se definía y no se veía nunca). */}
                  <span
                    aria-hidden="true"
                    className="absolute bottom-0 left-0 right-0 h-0.5 opacity-0 transition-opacity group-data-[state=active]:opacity-100"
                    style={{ background: '#006c48' }}
                  />
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <div className="mt-6">
            <TabsContent value="overview">
              <OverviewTab result={result} angularHistory={angularHistoryWithCurrent} kpiHistory={kpiHistoryWithCurrent} />
            </TabsContent>
            <TabsContent value="hardcoded">
              <HardcodedTab result={result} dsCoverage={ds.coverage} dsTokens={ds.tokens} />
            </TabsContent>
            <TabsContent value="duplicates">
              <DuplicatesTab result={result} />
            </TabsContent>
            <TabsContent value="specificity">
              <SpecificityTab result={result} />
            </TabsContent>
            <TabsContent value="typography">
              <TypographyTab result={result} />
            </TabsContent>
            <TabsContent value="w3c">
              <W3cTab
                result={w3c.result}
                isValidating={w3c.isValidating}
                error={w3c.error}
                onValidate={handleW3cValidate}
                hasCss={!!css}
                mode={w3c.mode}
                onModeChange={w3c.setMode}
              />
            </TabsContent>
            <TabsContent value="ds">
              <DesignSystemTab
                tokens={ds.tokens}
                coverage={ds.coverage}
                error={ds.error}
                fileName={ds.fileName}
                loading={ds.loading}
                onLoadTokens={loadTokens}
                onLoadFromUrl={async (url: string) => {
                  await loadFromUrl(url)
                }}
                onReset={ds.reset}
                result={result}
              />
            </TabsContent>
          </div>
        </Tabs>
      )}

      {!result && !analysisError && (
        <div className="text-center py-16">
          <Code className="h-16 w-16 mx-auto mb-4 text-[#52695b]/30" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-[#52695b] mb-2">
            Pega o arrastra tu CSS para empezar
          </h2>
          <p className="text-sm text-[#8a9b92] max-w-md mx-auto">
            KPY CSS Analyzer evaluará tu CSS compilado y te mostrará métricas
            de calidad, valores hardcodeados, duplicados, validación W3C y
            cobertura de Design System.
          </p>
        </div>
      )}
    </div>
  )
}
