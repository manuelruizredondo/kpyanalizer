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
    if (score >= 70) return 'bg-green-100 text-green-800'
    if (score >= 40) return 'bg-yellow-100 text-yellow-800'
    return 'bg-red-100 text-red-800'
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
      <div className="w-64 bg-white border-r border-gray-200 p-6">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Proyectos</h2>

          {!showNewProjectForm ? (
            <Button
              onClick={() => setShowNewProjectForm(true)}
              className="w-full"
              size="sm"
            >
              Nuevo proyecto
            </Button>
          ) : (
            <div className="space-y-3 p-3 bg-gray-50 rounded-lg">
              <input
                type="text"
                placeholder="Nombre del proyecto"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <textarea
                placeholder="Descripción (opcional)"
                value={newProjectDescription}
                onChange={(e) => setNewProjectDescription(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
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
                  ? 'bg-blue-50 border-2 border-blue-500'
                  : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'
              }`}
            >
              <button
                onClick={() => setSelectedProjectId(project.id)}
                className="w-full text-left"
              >
                <h3 className="font-medium text-gray-900 text-sm">
                  {project.name}
                </h3>
                {project.description && (
                  <p className="text-xs text-gray-400 mt-0.5 truncate">
                    {project.description}
                  </p>
                )}
              </button>
              {profile?.role === 'super_admin' && (
                <button
                  onClick={() => handleDeleteProject(project.id)}
                  className="mt-2 w-full text-xs text-red-600 hover:text-red-800 py-1"
                >
                  Eliminar proyecto
                </button>
              )}
            </div>
          ))}
        </div>

        {projects.length === 0 && !loading && (
          <div className="text-center py-8">
            <p className="text-sm text-gray-500">No hay proyectos aún</p>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8">
        {selectedProject ? (
          <div className="space-y-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {selectedProject.name}
              </h1>
              <p className="text-gray-600 mt-2">
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
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Evolución del Score de Salud
                    </h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={healthScoreChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis domain={[0, 100]} />
                        <Tooltip />
                        <Line type="monotone" dataKey="score" stroke="#3b82f6" strokeWidth={2} name="Score" />
                      </LineChart>
                    </ResponsiveContainer>
                  </Card>

                  <Card className="p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Valores Hardcodeados
                    </h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={hardcodedChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Area type="monotone" dataKey="colores" stackId="1" stroke="#ef4444" fill="#fca5a5" />
                        <Area type="monotone" dataKey="fuentes" stackId="1" stroke="#f59e0b" fill="#fcd34d" />
                        <Area type="monotone" dataKey="spacing" stackId="1" stroke="#10b981" fill="#a7f3d0" />
                        <Area type="monotone" dataKey="z-index" stackId="1" stroke="#8b5cf6" fill="#ddd6fe" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </Card>

                  <Card className="p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Tendencia de Duplicados
                    </h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={duplicatesChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="selectores" stroke="#3b82f6" strokeWidth={2} />
                        <Line type="monotone" dataKey="declaraciones" stroke="#ec4899" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </Card>

                  {latestScanBreakdown.length > 0 && (
                    <Card className="p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">
                        Desglose del Último Escaneo
                      </h3>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={latestScanBreakdown}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="value" fill="#3b82f6" />
                        </BarChart>
                      </ResponsiveContainer>
                    </Card>
                  )}
                </div>

                <Card className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Escaneos
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-3 px-4 font-semibold text-gray-700">Etiqueta</th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-700">Fecha</th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-700">Score</th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-700">Tamaño</th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-700">Selectores</th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-700">Declaraciones</th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-700">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {scans.map((scan) => (
                          <tr key={scan.id} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="py-3 px-4">{scan.label}</td>
                            <td className="py-3 px-4">
                              {new Date(scan.created_at).toLocaleDateString('es-ES')}
                            </td>
                            <td className="py-3 px-4">
                              <Badge className={getHealthScoreBadgeColor(scan.health_score)}>
                                {scan.health_score}
                              </Badge>
                            </td>
                            <td className="py-3 px-4">
                              {(scan.file_size / 1024).toFixed(1)} KB
                            </td>
                            <td className="py-3 px-4">{scan.total_selectors}</td>
                            <td className="py-3 px-4">{scan.total_declarations}</td>
                            <td className="py-3 px-4">
                              <div className="flex gap-2">
                                <button
                                  onClick={() => setSelectedScanId(scan.id)}
                                  className="text-blue-600 hover:text-blue-800"
                                >
                                  <Eye size={16} />
                                </button>
                                <button
                                  onClick={() => handleDeleteScan(scan.id)}
                                  className="text-red-600 hover:text-red-800"
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
                <p className="text-gray-500">
                  No hay escaneos en este proyecto aún. Realiza un análisis en
                  la sección "Analizar" para comenzar.
                </p>
              </Card>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center py-24">
            <p className="text-gray-500 text-lg">Crea un proyecto para comenzar</p>
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
