import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import {
  getProjects,
  createProject,
  getProjectScans,
  deleteScan,
  deleteProject,
} from '@/lib/scan-storage'
import type { Project, Scan } from '@/lib/scan-storage'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScanDetailModal } from './ScanDetailModal'
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
import { Trash2, Eye } from 'lucide-react'

export function DashboardPage() {
  const { profile } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [scans, setScans] = useState<Scan[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewProjectForm, setShowNewProjectForm] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectDescription, setNewProjectDescription] = useState('')
  const [selectedScanId, setSelectedScanId] = useState<string | null>(null)

  useEffect(() => {
    loadProjects()
  }, [])

  const loadProjects = async () => {
    try {
      setLoading(true)
      const projectsList = await getProjects()
      setProjects(projectsList)
      if (projectsList.length > 0 && !selectedProjectId) {
        setSelectedProjectId(projectsList[0].id)
      }
    } catch (error) {
      console.error('Error loading projects:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (selectedProjectId) {
      loadScans(selectedProjectId)
    }
  }, [selectedProjectId])

  const loadScans = async (projectId: string) => {
    try {
      const scansList = await getProjectScans(projectId)
      setScans(scansList)
    } catch (error) {
      console.error('Error loading scans:', error)
    }
  }

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
      if (selectedProjectId) {
        await loadScans(selectedProjectId)
      }
    } catch (error) {
      console.error('Error deleting scan:', error)
    }
  }

  const handleDeleteProject = async (projectId: string) => {
    if (!window.confirm('¿Deseas eliminar este proyecto y todos sus escaneos?'))
      return

    try {
      await deleteProject(projectId)
      const updated = projects.filter((p) => p.id !== projectId)
      setProjects(updated)
      if (selectedProjectId === projectId) {
        setSelectedProjectId(updated.length > 0 ? updated[0].id : null)
        setScans([])
      }
    } catch (error) {
      console.error('Error deleting project:', error)
    }
  }

  const selectedProject = projects.find((p) => p.id === selectedProjectId)

  const getHealthScoreBadgeColor = (score: number) => {
    if (score >= 70) return 'bg-[#e0f5ec] text-[#006c48]'
    if (score >= 40) return 'bg-[#fef6e0] text-[#a67c00]'
    return 'bg-[#fef2f1] text-[#9e2b25]'
  }

  // Charts data - use scans in chronological order (oldest first)
  const chronologicalScans = [...scans].reverse()

  const healthScoreChartData = chronologicalScans.map((scan) => ({
    date: new Date(scan.created_at).toLocaleDateString('es-ES'),
    score: scan.health_score,
  }))

  const hardcodedChartData = chronologicalScans.map((scan) => ({
    date: new Date(scan.created_at).toLocaleDateString('es-ES'),
    colores: scan.class_count,
    fuentes: scan.id_count,
    spacing: scan.important_count,
    'z-index': scan.variable_count,
  }))

  const duplicatesChartData = chronologicalScans.map((scan) => ({
    date: new Date(scan.created_at).toLocaleDateString('es-ES'),
    selectores: scan.total_selectors,
    declaraciones: scan.total_declarations,
  }))

  const latestScan = scans.length > 0 ? scans[0] : null
  const latestScanBreakdown = latestScan
    ? [
        { name: '!important', value: latestScan.important_count },
        { name: 'IDs', value: latestScan.id_count },
        { name: 'Variables', value: latestScan.variable_count },
      ]
    : []

  if (loading && projects.length === 0) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-gray-500">Cargando...</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-[calc(100vh-73px)]">
      {/* Left Sidebar */}
      <div className="w-64 bg-[#f0f2f1] border-0 p-6">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-[#1a2e23] mb-4">Proyectos</h2>

          {!showNewProjectForm ? (
            <Button
              onClick={() => setShowNewProjectForm(true)}
              className="w-full"
              size="sm"
            >
              Nuevo proyecto
            </Button>
          ) : (
            <div className="space-y-3 p-3 bg-white rounded-xl border-0">
              <input
                type="text"
                placeholder="Nombre del proyecto"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                className="w-full px-3 py-2 bg-[#f8f9fa] rounded-xl border-0 text-sm focus:outline-none focus:ring-2 focus:ring-[#006c48]"
              />
              <textarea
                placeholder="Descripción (opcional)"
                value={newProjectDescription}
                onChange={(e) => setNewProjectDescription(e.target.value)}
                className="w-full px-3 py-2 bg-[#f8f9fa] rounded-xl border-0 text-sm focus:outline-none focus:ring-2 focus:ring-[#006c48] resize-none"
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
                selectedProjectId === project.id
                  ? 'bg-[#e0f5ec] border-0'
                  : 'bg-white/60 border-0 hover:bg-white'
              }`}
            >
              <button
                onClick={() => setSelectedProjectId(project.id)}
                className="w-full text-left"
              >
                <h3 className="font-medium text-[#1a2e23] text-sm">
                  {project.name}
                </h3>
                {project.description && (
                  <p className="text-xs text-[#3d5a4a] mt-0.5 truncate">
                    {project.description}
                  </p>
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
            <p className="text-sm text-[#3d5a4a]">No hay proyectos aún</p>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8">
        {selectedProject ? (
          <div className="space-y-8">
            <div>
              <h1 className="text-3xl font-bold text-[#1a2e23]">
                {selectedProject.name}
              </h1>
              <p className="text-[#3d5a4a] mt-2">
                {scans.length} escaneo{scans.length !== 1 ? 's' : ''} •{' '}
                {latestScan
                  ? `Última actualización: ${new Date(latestScan.created_at).toLocaleDateString('es-ES')}`
                  : 'Sin escaneos'}
              </p>
            </div>

            {scans.length > 0 ? (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card className="p-6">
                    <h3 className="text-lg font-semibold text-[#1a2e23] mb-4">
                      Evolución del Score de Salud
                    </h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={healthScoreChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis domain={[0, 100]} />
                        <Tooltip />
                        <Line type="monotone" dataKey="score" stroke="#012d1d" strokeWidth={2} name="Score" />
                      </LineChart>
                    </ResponsiveContainer>
                  </Card>

                  <Card className="p-6">
                    <h3 className="text-lg font-semibold text-[#1a2e23] mb-4">
                      Valores Hardcodeados
                    </h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={hardcodedChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Area type="monotone" dataKey="colores" stackId="1" stroke="#9e2b25" fill="rgba(158,43,37,0.2)" />
                        <Area type="monotone" dataKey="fuentes" stackId="1" stroke="#a67c00" fill="rgba(166,124,0,0.2)" />
                        <Area type="monotone" dataKey="spacing" stackId="1" stroke="#2a9d6e" fill="rgba(42,157,110,0.2)" />
                        <Area type="monotone" dataKey="z-index" stackId="1" stroke="#5cc49a" fill="rgba(92,196,154,0.2)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </Card>

                  <Card className="p-6">
                    <h3 className="text-lg font-semibold text-[#1a2e23] mb-4">
                      Tendencia de Duplicados
                    </h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={duplicatesChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="selectores" stroke="#012d1d" strokeWidth={2} />
                        <Line type="monotone" dataKey="declaraciones" stroke="#006c48" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </Card>

                  {latestScanBreakdown.length > 0 && (
                    <Card className="p-6">
                      <h3 className="text-lg font-semibold text-[#1a2e23] mb-4">
                        Desglose del Último Escaneo
                      </h3>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={latestScanBreakdown}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="value" fill="#006c48" />
                        </BarChart>
                      </ResponsiveContainer>
                    </Card>
                  )}
                </div>

                <Card className="p-6">
                  <h3 className="text-lg font-semibold text-[#1a2e23] mb-4">
                    Escaneos
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-0 border-b-0">
                          <th className="text-left py-3 px-4 font-semibold text-[#1a2e23]">Etiqueta</th>
                          <th className="text-left py-3 px-4 font-semibold text-[#1a2e23]">Fecha</th>
                          <th className="text-left py-3 px-4 font-semibold text-[#1a2e23]">Score</th>
                          <th className="text-left py-3 px-4 font-semibold text-[#1a2e23]">Tamaño</th>
                          <th className="text-left py-3 px-4 font-semibold text-[#1a2e23]">Selectores</th>
                          <th className="text-left py-3 px-4 font-semibold text-[#1a2e23]">Declaraciones</th>
                          <th className="text-left py-3 px-4 font-semibold text-[#1a2e23]">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {scans.map((scan) => (
                          <tr key={scan.id} className="border-0 hover:bg-[#f0f2f1]">
                            <td className="py-3 px-4 text-[#1a2e23]">{scan.label}</td>
                            <td className="py-3 px-4 text-[#1a2e23]">
                              {new Date(scan.created_at).toLocaleDateString('es-ES')}
                            </td>
                            <td className="py-3 px-4">
                              <Badge className={getHealthScoreBadgeColor(scan.health_score)}>
                                {scan.health_score}
                              </Badge>
                            </td>
                            <td className="py-3 px-4 text-[#1a2e23]">
                              {(scan.file_size / 1024).toFixed(1)} KB
                            </td>
                            <td className="py-3 px-4 text-[#1a2e23]">{scan.total_selectors}</td>
                            <td className="py-3 px-4 text-[#1a2e23]">{scan.total_declarations}</td>
                            <td className="py-3 px-4">
                              <div className="flex gap-2">
                                <button
                                  onClick={() => setSelectedScanId(scan.id)}
                                  className="text-[#006c48] hover:text-[#004d35]"
                                >
                                  <Eye size={16} />
                                </button>
                                <button
                                  onClick={() => handleDeleteScan(scan.id)}
                                  className="text-[#9e2b25] hover:text-[#7a1e1a]"
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
              </>
            ) : (
              <Card className="p-12 text-center">
                <p className="text-[#3d5a4a]">
                  No hay escaneos en este proyecto aún. Realiza un análisis en
                  la sección "Analizar" para comenzar.
                </p>
              </Card>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center py-24">
            <p className="text-[#3d5a4a] text-lg">Crea un proyecto para comenzar</p>
          </div>
        )}
      </div>

      {selectedScanId && (
        <ScanDetailModal
          scanId={selectedScanId}
          onClose={() => setSelectedScanId(null)}
        />
      )}
    </div>
  )
}
