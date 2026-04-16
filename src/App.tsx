import { useCallback, useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { LoginPage } from '@/components/auth/LoginPage'
import { AppLayout } from '@/components/layout/AppLayout'
import { DashboardPage } from '@/components/dashboard/DashboardPage'
import { saveScan, getProjects } from '@/lib/scan-storage'
import type { Project } from '@/lib/scan-storage'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CssInput } from '@/components/input/CssInput'
import { OverviewTab } from '@/components/overview/OverviewTab'
import { HardcodedTab } from '@/components/hardcoded/HardcodedTab'
import { DuplicatesTab } from '@/components/duplicates/DuplicatesTab'
import { W3cTab } from '@/components/w3c/W3cTab'
import { DesignSystemTab } from '@/components/designsystem/DesignSystemTab'
import { useAnalysis } from '@/hooks/useAnalysis'
import { useW3cValidation } from '@/hooks/useW3cValidation'
import { useDesignSystem } from '@/hooks/useDesignSystem'
import {
  LayoutDashboard,
  Palette,
  Copy,
  Globe,
  Component,
  Code,
  Save,
} from 'lucide-react'

function AnalyzePage() {
  const { css, result, error: analysisError, analyze } = useAnalysis()
  const w3c = useW3cValidation()
  const ds = useDesignSystem()
  const [showSaveForm, setShowSaveForm] = useState(false)
  const [projects, setProjects] = useState<Project[]>([])
  const [saveFormData, setSaveFormData] = useState({
    projectId: '',
    label: '',
  })
  const [savingStatus, setSavingStatus] = useState<{
    state: 'idle' | 'loading' | 'success' | 'error'
    message: string
  }>({ state: 'idle', message: '' })

  useEffect(() => {
    if (showSaveForm) {
      getProjects().then(setProjects).catch(console.error)
    }
  }, [showSaveForm])

  const handleCssChange = useCallback(
    (newCss: string) => {
      analyze(newCss)
      w3c.reset()
    },
    [analyze, w3c]
  )

  const handleW3cValidate = useCallback(() => {
    if (css) w3c.validate(css)
  }, [css, w3c])

  const handleLoadTokens = useCallback(
    (content: string, fileName: string) => {
      const parsed = ds.loadTokens(content, fileName)
      if (parsed && result) {
        ds.compare(result, parsed)
      }
    },
    [ds, result]
  )

  const handleTabChange = useCallback(
    (tab: string) => {
      if (tab === 'ds' && ds.tokens && result) {
        ds.compare(result, ds.tokens)
      }
    },
    [ds, result]
  )

  const handleSaveScan = async () => {
    if (!saveFormData.projectId || !saveFormData.label.trim() || !result) {
      setSavingStatus({
        state: 'error',
        message: 'Por favor completa todos los campos requeridos',
      })
      return
    }

    try {
      setSavingStatus({ state: 'loading', message: 'Guardando escaneo...' })

      await saveScan(
        saveFormData.projectId,
        saveFormData.label,
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
      setTimeout(() => {
        setShowSaveForm(false)
        setSaveFormData({ projectId: '', label: '' })
        setSavingStatus({ state: 'idle', message: '' })
      }, 2000)
    } catch (error) {
      setSavingStatus({
        state: 'error',
        message: 'Error al guardar el escaneo',
      })
      console.error('Error saving scan:', error)
    }
  }

  return (
    <div className="space-y-6 py-6 px-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#1a2e23] font-['Plus_Jakarta_Sans']">Analizar CSS</h2>
          <p className="text-[#3d5a4a] mt-1">
            Pega o arrastra tu CSS compilado para obtener métricas de calidad
          </p>
        </div>
        {result && (
          <Button
            onClick={() => setShowSaveForm(!showSaveForm)}
            size="lg"
            className="gap-2"
          >
            <Save size={18} />
            Guardar escaneo
          </Button>
        )}
      </div>

      <CssInput value={css} onChange={handleCssChange} />

      {analysisError && (
        <div className="rounded-md bg-destructive/10 p-3">
          <p className="text-sm text-destructive">{analysisError}</p>
        </div>
      )}

      {showSaveForm && result && (
        <Card className="p-6 bg-[#e0f5ec] border-0">
          <h3 className="text-lg font-semibold text-[#1a2e23] mb-4">
            Guardar Escaneo
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#1a2e23] mb-1">
                Proyecto
              </label>
              <select
                value={saveFormData.projectId}
                onChange={(e) =>
                  setSaveFormData({ ...saveFormData, projectId: e.target.value })
                }
                className="w-full px-3 py-2 bg-white rounded-xl border-0 text-sm focus:outline-none focus:ring-2 focus:ring-[#006c48]"
              >
                <option value="">Selecciona un proyecto</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#1a2e23] mb-1">
                Etiqueta del Escaneo
              </label>
              <input
                type="text"
                value={saveFormData.label}
                onChange={(e) =>
                  setSaveFormData({ ...saveFormData, label: e.target.value })
                }
                placeholder="ej: Versión 1.0, Revisión Q2..."
                className="w-full px-3 py-2 bg-white rounded-xl border-0 text-sm focus:outline-none focus:ring-2 focus:ring-[#006c48]"
              />
            </div>

            {savingStatus.message && (
              <div
                className={`text-sm p-2 rounded-xl ${
                  savingStatus.state === 'error'
                    ? 'bg-[#fef2f1] text-[#9e2b25]'
                    : savingStatus.state === 'success'
                      ? 'bg-[#e0f5ec] text-[#006c48]'
                      : 'bg-[#f0f2f1] text-[#1a2e23]'
                }`}
              >
                {savingStatus.message}
              </div>
            )}

            <div className="flex gap-3">
              <Button
                onClick={handleSaveScan}
                disabled={
                  savingStatus.state === 'loading' ||
                  !saveFormData.projectId ||
                  !saveFormData.label.trim()
                }
                className="flex-1"
              >
                {savingStatus.state === 'loading' ? 'Guardando...' : 'Guardar'}
              </Button>
              <Button
                onClick={() => {
                  setShowSaveForm(false)
                  setSavingStatus({ state: 'idle', message: '' })
                }}
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
        <Tabs defaultValue="overview" onValueChange={handleTabChange}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview" className="gap-1.5 text-xs">
              <LayoutDashboard className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Resumen</span>
            </TabsTrigger>
            <TabsTrigger value="hardcoded" className="gap-1.5 text-xs">
              <Palette className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Hardcodeados</span>
            </TabsTrigger>
            <TabsTrigger value="duplicates" className="gap-1.5 text-xs">
              <Copy className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Duplicados</span>
            </TabsTrigger>
            <TabsTrigger value="w3c" className="gap-1.5 text-xs">
              <Globe className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">W3C</span>
            </TabsTrigger>
            <TabsTrigger value="ds" className="gap-1.5 text-xs">
              <Component className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Design System</span>
            </TabsTrigger>
          </TabsList>

          <div className="mt-6">
            <TabsContent value="overview">
              <OverviewTab result={result} />
            </TabsContent>
            <TabsContent value="hardcoded">
              <HardcodedTab result={result} />
            </TabsContent>
            <TabsContent value="duplicates">
              <DuplicatesTab result={result} />
            </TabsContent>
            <TabsContent value="w3c">
              <W3cTab
                result={w3c.result}
                isValidating={w3c.isValidating}
                error={w3c.error}
                onValidate={handleW3cValidate}
                hasCss={!!css}
              />
            </TabsContent>
            <TabsContent value="ds">
              <DesignSystemTab
                tokens={ds.tokens}
                coverage={ds.coverage}
                error={ds.error}
                fileName={ds.fileName}
                onLoadTokens={handleLoadTokens}
                result={result}
              />
            </TabsContent>
          </div>
        </Tabs>
      )}

      {!result && !analysisError && (
        <div className="text-center py-16">
          <Code className="h-16 w-16 mx-auto mb-4 text-[#3d5a4a]/30" />
          <h2 className="text-lg font-semibold text-[#3d5a4a] mb-2">
            Pega o arrastra tu CSS para empezar
          </h2>
          <p className="text-sm text-[#3d5a4a] max-w-md mx-auto">
            KPY CSS Analyzer evaluará tu CSS compilado y te mostrará métricas
            de calidad, valores hardcodeados, duplicados, validación W3C y
            cobertura de Design System.
          </p>
        </div>
      )}
    </div>
  )
}

export default function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-[#3d5a4a]">Cargando...</p>
      </div>
    )
  }

  if (!user) {
    return <LoginPage />
  }

  return (
    <Routes>
      <Route
        path="/analyze"
        element={
          <AppLayout>
            <AnalyzePage />
          </AppLayout>
        }
      />
      <Route
        path="/dashboard"
        element={
          <AppLayout>
            <DashboardPage />
          </AppLayout>
        }
      />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
