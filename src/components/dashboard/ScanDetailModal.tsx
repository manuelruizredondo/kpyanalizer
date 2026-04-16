import { useState, useEffect } from 'react'
import { getScanDetail } from '@/lib/scan-storage'
import type { ScanDetail } from '@/lib/scan-storage'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { X } from 'lucide-react'

interface ScanDetailModalProps {
  scanId: string
  onClose: () => void
}

export function ScanDetailModal({ scanId, onClose }: ScanDetailModalProps) {
  const [scan, setScan] = useState<ScanDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadScanDetail = async () => {
      try {
        setLoading(true)
        setError(null)
        const detail = await getScanDetail(scanId)
        setScan(detail)
      } catch (err) {
        setError('Error al cargar los detalles del escaneo')
        console.error('Error loading scan detail:', err)
      } finally {
        setLoading(false)
      }
    }

    loadScanDetail()
  }, [scanId])

  const getScoreBadge = (score: number) => {
    if (score >= 70) return 'bg-green-100 text-green-800'
    if (score >= 40) return 'bg-yellow-100 text-yellow-800'
    return 'bg-red-100 text-red-800'
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <Card className="w-96 p-6">
          <p className="text-center text-gray-500">Cargando...</p>
        </Card>
      </div>
    )
  }

  if (error || !scan) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <Card className="w-96 p-6">
          <p className="text-center text-red-500">{error || 'Escaneo no encontrado'}</p>
          <Button onClick={onClose} variant="outline" className="w-full mt-4">
            Cerrar
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{scan.label}</h2>
            <p className="text-sm text-gray-500 mt-1">
              {new Date(scan.created_at).toLocaleDateString('es-ES', {
                year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
              })}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>

        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Información General</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Score de Salud</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge className={getScoreBadge(scan.health_score)}>
                    {scan.health_score}
                  </Badge>
                </div>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Tamaño de Archivo</p>
                <p className="text-lg font-semibold text-gray-900">
                  {(scan.file_size / 1024).toFixed(2)} KB
                </p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Líneas</p>
                <p className="text-lg font-semibold text-gray-900">{scan.line_count}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Ratio de Reúso</p>
                <p className="text-lg font-semibold text-gray-900">
                  {(scan.reuse_ratio * 100).toFixed(1)}%
                </p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Métricas CSS</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Selectores</p>
                <p className="text-lg font-semibold text-gray-900">{scan.total_selectors}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Declaraciones</p>
                <p className="text-lg font-semibold text-gray-900">{scan.total_declarations}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Únicas</p>
                <p className="text-lg font-semibold text-gray-900">{scan.unique_declarations}</p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Código Problemático</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                <p className="text-sm text-red-600">!important</p>
                <p className="text-lg font-semibold text-red-900">{scan.important_count}</p>
              </div>
              <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                <p className="text-sm text-red-600">Selectores ID</p>
                <p className="text-lg font-semibold text-red-900">{scan.id_count}</p>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-600">Clases</p>
                <p className="text-lg font-semibold text-blue-900">{scan.class_count}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex gap-3">
          <Button onClick={onClose} variant="outline" className="flex-1">
            Cerrar
          </Button>
          <Button
            onClick={() => {
              const dataStr = JSON.stringify(scan, null, 2)
              const dataBlob = new Blob([dataStr], { type: 'application/json' })
              const url = URL.createObjectURL(dataBlob)
              const link = document.createElement('a')
              link.href = url
              link.download = `scan_${scan.id}.json`
              link.click()
              URL.revokeObjectURL(url)
            }}
            className="flex-1"
          >
            Descargar JSON
          </Button>
        </div>
      </Card>
    </div>
  )
}
