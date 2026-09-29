import { useState, useEffect, useMemo, useRef, useId } from 'react'
import type { ReactNode } from 'react'
import { getScanDetail, isAbortError } from '@/lib/scan-storage'
import type { ScanDetail } from '@/lib/scan-storage'
import type { AnalysisResult } from '@/types/analysis'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { getScoreBand } from '@/lib/score-band'
import { X, Copy, Download, ChevronDown, ChevronRight, Check, Loader2 } from 'lucide-react'

interface ScanDetailModalProps {
  scanId: string
  onClose: () => void
}

export function ScanDetailModal({ scanId, onClose }: ScanDetailModalProps) {
  const [scan, setScan] = useState<ScanDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cssOpen, setCssOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)

  // Ref al último onClose: el listener de Escape se registra una sola vez y
  // no debe quedarse con un closure antiguo.
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose })

  useEffect(() => {
    // Cancela la descarga (varios MB) si el modal se cierra o cambia de escaneo
    // antes de terminar, y descarta su resultado.
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    setScan(null)
    getScanDetail(scanId, controller.signal)
      .then((detail) => {
        if (!controller.signal.aborted) setScan(detail)
      })
      .catch((err) => {
        if (controller.signal.aborted || isAbortError(err)) return
        console.error('Error loading scan detail:', err)
        setError(err instanceof Error && err.message ? err.message : 'Error al cargar los detalles del escaneo')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [scanId])

  // Escape cierra en cualquier estado (también mientras carga). Al cerrar se
  // devuelve el foco al elemento que abrió el modal.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    dialogRef.current?.focus()
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      previouslyFocused?.focus?.()
    }
  }, [])

  // The full CSS is stored in analysis_data.raw — pull it out for view/copy/download
  const rawCss = useMemo<string>(() => {
    const ad = scan?.analysis_data as AnalysisResult | undefined
    return typeof ad?.raw === 'string' ? ad.raw : ''
  }, [scan])

  const cssSizeKb = useMemo(() => (rawCss ? (new Blob([rawCss]).size / 1024).toFixed(1) : '0'), [rawCss])

  function downloadCss() {
    if (!rawCss || !scan) return
    const safeLabel = scan.label.replace(/[^a-z0-9-_]+/gi, '_')
    const dateStamp = new Date(scan.created_at).toISOString().slice(0, 10)
    const blob = new Blob([rawCss], { type: 'text/css' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${safeLabel}_${dateStamp}.css`
    link.click()
    URL.revokeObjectURL(url)
  }

  async function copyCss() {
    if (!rawCss) return
    try {
      await navigator.clipboard.writeText(rawCss)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch (err) {
      console.error('Error copying CSS:', err)
    }
  }


  // Contenedor común a todos los estados: un único nodo con role="dialog" que
  // recibe el foco al abrir.
  const renderDialog = (children: ReactNode, extraClass = '') => (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
      className={`fixed inset-0 bg-[#012d1d]/40 backdrop-blur-sm flex items-center justify-center z-50 focus:outline-none ${extraClass}`}
    >
      {children}
    </div>
  )

  if (loading) {
    return renderDialog(
      <Card className="w-96 p-6 rounded-2xl relative">
        <h2 id={titleId} className="sr-only">Detalle del escaneo</h2>
        <button
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute top-3 right-3 p-1 rounded-lg text-[#3d5a4a] hover:text-[#1a2e23] hover:bg-[#f0f2f1]"
        >
          <X size={18} />
        </button>
        <p className="flex items-center justify-center gap-2 text-center text-[#3d5a4a]">
          <Loader2 size={16} className="animate-spin text-[#006c48]" />
          Cargando...
        </p>
      </Card>
    )
  }

  if (error || !scan) {
    return renderDialog(
      <Card className="w-96 p-6 rounded-2xl">
        <h2 id={titleId} className="sr-only">Detalle del escaneo</h2>
        <p role="alert" className="text-center text-[#9e2b25]">{error || 'Escaneo no encontrado'}</p>
        <Button onClick={onClose} variant="outline" className="w-full mt-4">
          Cerrar
        </Button>
      </Card>
    )
  }

  return renderDialog(
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto p-8 rounded-2xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 id={titleId} className="text-2xl font-bold text-[#1a2e23]">{scan.label}</h2>
            <p className="text-sm text-[#3d5a4a] mt-1">
              {new Date(scan.created_at).toLocaleDateString('es-ES', {
                year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
              })}
            </p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="text-[#3d5a4a] hover:text-[#1a2e23]">
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
                  <Badge style={{ backgroundColor: getScoreBand(scan.health_score).bg, color: getScoreBand(scan.health_score).color }}>
                    {scan.health_score} · {getScoreBand(scan.health_score).label}
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

          {/* ── CSS analizado: ver / copiar / descargar ── */}
          <div>
            <h3 className="text-lg font-semibold text-[#1a2e23] mb-3">CSS analizado</h3>
            {rawCss ? (
              <div className="border border-[#f0f2f1] rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-[#f9faf9] border-b border-[#f0f2f1]">
                  <button
                    onClick={() => setCssOpen(o => !o)}
                    className="flex items-center gap-2 text-sm font-medium text-[#1a2e23] hover:text-[#006c48]"
                  >
                    {cssOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    {cssOpen ? 'Ocultar' : 'Ver'} CSS completo
                    <span className="text-[11px] text-[#3d5a4a] font-normal">
                      ({cssSizeKb} KB · {scan.line_count.toLocaleString()} líneas)
                    </span>
                  </button>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={copyCss}
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 text-xs"
                      title="Copiar al portapapeles"
                    >
                      {copied ? <Check size={13} className="text-[#006c48]" /> : <Copy size={13} />}
                      {copied ? 'Copiado' : 'Copiar'}
                    </Button>
                    <Button
                      onClick={downloadCss}
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 text-xs"
                      title="Descargar como .css"
                    >
                      <Download size={13} />
                      Descargar .css
                    </Button>
                  </div>
                </div>
                {cssOpen && (
                  <pre className="text-[11px] leading-[1.5] font-mono text-[#1a2e23] bg-white p-4 overflow-auto max-h-[400px] whitespace-pre">
                    {rawCss}
                  </pre>
                )}
              </div>
            ) : (
              <div className="bg-[#fef6e0] border border-[#a67c00]/20 rounded-xl p-4">
                <p className="text-sm text-[#a67c00]">
                  Este escaneo se guardó antes de añadir el almacenamiento del CSS completo,
                  o el campo <code className="font-mono">analysis_data.raw</code> no está disponible.
                  Los nuevos escaneos sí guardan el CSS íntegro.
                </p>
              </div>
            )}
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
      </Card>,
    'p-4',
  )
}
