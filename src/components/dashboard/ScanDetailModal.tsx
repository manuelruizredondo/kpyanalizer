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
    if (score >= 70) return 'bg-[#e0f5ec] text-[#006c48]'
    if (score >= 40) return 'bg-[#fef6e0] text-[#a67c00]'
    return 'bg-[#fef2f1] text-[#9e2b25]'
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-[#012d1d]/40 backdrop-blur-sm flex items-center justify-center z-50">
        <Card className="w-96 p-6 rounded-2xl">
          <p className="text-center text-[#3d5a4a]">Cargando...</p>
        </Card>
      </div>
    )
  }

  if (error || !scan) {
    return (
      <div className="fixed inset-0 bg-[#012d1d]/40 backdrop-blur-sm flex items-center justify-center z-50">
        <Card className="w-96 p-6 rounded-2xl">
          <p className="text-center text-[#9e2b25]">{error || 'Escaneo no encontrado'}</p>
          <Button onClick={onClose} variant="outline" className="w-full mt-4">
            Cerrar
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-[#012d1d]/40 backdrop-blur-sm flex items-center justify-center z-50">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto p-8 rounded-2xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-[#1a2e23]">{scan.label}</h2>
            <p className="text-sm text-[#3d5a4a] mt-1">
              {new Date(scan.created_at).toLocaleDateString('es-ES', {
                year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
              })}
            </p>
          </div>
          <button onClick={onClose} className="text-[#3d5a4a] hover:text-[#1a2e23]">
            <X size={24} />
          </button>
        </div>

        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-[#1a2e23] mb-3">Información General</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#f0f2f1] p-4 rounded-xl border-0">
                <p className="text-sm text-[#3d5a4a]">Score de Salud</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge className={getScoreBadge(scan.health_score)}>
                    {scan.health_score}
                  </Badge>
                </div>
              </div>
              <div className="bg-[#f0f2f1] p-4 rounded-xl border-0">
                <p className="text-sm text-[#3d5a4a]">Tamaño de Archivo</p>
                <p className="text-lg font-semibold text-[#1a2e23]">
                  {(scan.file_size / 1024).toFixed(2)} KB
                </p>
              </div>
              <div className="bg-[#f0f2f1] p-4 rounded-xl border-0">
                <p className="text-sm text-[#3d5a4a]">Líneas</p>
                <p className="text-lg font-semibold text-[#1a2e23]">{scan.line_count}</p>
              </div>
              <div className="bg-[#f0f2f1] p-4 rounded-xl border-0">
                <p className="text-sm text-[#3d5a4a]">Ratio de Reúso</p>
                <p className="text-lg font-semibold text-[#1a2e23]">
                  {(scan.reuse_ratio * 100).toFixed(1)}%
                </p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-[#1a2e23] mb-3">Métricas CSS</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-[#f0f2f1] p-4 rounded-xl border-0">
                <p className="text-sm text-[#3d5a4a]">Selectores</p>
                <p className="text-lg font-semibold text-[#1a2e23]">{scan.total_selectors}</p>
              </div>
              <div className="bg-[#f0f2f1] p-4 rounded-xl border-0">
                <p className="text-sm text-[#3d5a4a]">Declaraciones</p>
                <p className="text-lg font-semibold text-[#1a2e23]">{scan.total_declarations}</p>
              </div>
              <div className="bg-[#f0f2f1] p-4 rounded-xl border-0">
                <p className="text-sm text-[#3d5a4a]">Únicas</p>
                <p className="text-lg font-semibold text-[#1a2e23]">{scan.unique_declarations}</p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-[#1a2e23] mb-3">Código Problemático</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-[#fef2f1] p-4 rounded-xl border border-[#9e2b25]/20">
                <p className="text-sm text-[#9e2b25]">!important</p>
                <p className="text-lg font-semibold text-[#9e2b25]">{scan.important_count}</p>
              </div>
              <div className="bg-[#fef2f1] p-4 rounded-xl border border-[#9e2b25]/20">
                <p className="text-sm text-[#9e2b25]">Selectores ID</p>
                <p className="text-lg font-semibold text-[#9e2b25]">{scan.id_count}</p>
              </div>
              <div className="bg-[#e0f5ec] p-4 rounded-xl border border-[#006c48]/20">
                <p className="text-sm text-[#006c48]">Clases</p>
                <p className="text-lg font-semibold text-[#006c48]">{scan.class_count}</p>
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
